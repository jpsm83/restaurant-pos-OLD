import connectDB from "@/lib/db";
import { NextResponse } from "next/server";
import { Types } from "mongoose";
import convert from "convert-units";


// import models
import BusinessGood from "@/lib/models/businessGood";
import SupplierGood from "@/lib/models/supplierGood";
import Promotion from "@/lib/models/promotion";
import Order from "@/lib/models/order";

interface IngredientsInterface {
  ingredient: Types.ObjectId;
  measurementUnit: convert.Unit;
  requiredQuantity: number;
  costOfRequiredQuantity?: number;
  [key: string]: string | number | undefined | Types.ObjectId;
}

interface BusinessGoodInterface {
  name: string;
  keyword: string;
  category: string;
  subCategory: string;
  onMenu: boolean;
  available: boolean;
  sellingPrice: number;
  business: Types.ObjectId;
  ingredients?: IngredientsInterface[];
  setMenu?: Types.ObjectId[];
  costPrice?: number;
  description?: string;
  allergens?: string[];
  image?: string;
  deliveryTime?: number;
}

const ingredientsArrayValidation = (
  ingredientsArray: IngredientsInterface[]
) => {
  // ingredients: [
  //    {
  //      ingredient: "6612cd163684524f0bb078da",
  //      measurementUnit: "kg",
  //      requiredQuantity: 10,
  //      costOfRequiredQuantity: 100,
  //    },
  //    {
  //      ingredient: "6612cd163684524f0bb078da",
  //      measurementUnit: "kg",
  //      requiredQuantity: 10,
  //      costOfRequiredQuantity: 100,
  //    },
  // ];

  // check if the ingredientsArray is an array
  if (!Array.isArray(ingredientsArray) || !ingredientsArray.length) {
    return "Invalid ingredients array";
  }

  const requiredFields = ["ingredient", "measurementUnit", "requiredQuantity"];
  for (const ingredient of ingredientsArray) {
    for (const field of requiredFields) {
      if (!ingredient[field]) {
        return `Missing ${field} in ingredients array`;
      }
    }
  }

  return true;
};

const calculateCostOfRequiredQuantity = (
  businessGoodIngredient: IngredientsInterface,
  supplierGoodDoc: any
) => {
  if (
    supplierGoodDoc.measurementUnit === businessGoodIngredient.measurementUnit
  ) {
    return (
      supplierGoodDoc.pricePerUnit * businessGoodIngredient.requiredQuantity
    );
  } else {
    const convertedQuantity = convert(businessGoodIngredient.requiredQuantity)
      .from(businessGoodIngredient.measurementUnit)
      .to(supplierGoodDoc.measurementUnit);
    return supplierGoodDoc.pricePerUnit * convertedQuantity;
  }
};

// helper function to set ingredients
const ingredientsHelper = async (
  ingredients: IngredientsInterface[],
  allergensArray: string[] | undefined,
  obj: BusinessGoodInterface
) => {
  const ingredientsArrayValidationResult =
    ingredientsArrayValidation(ingredients);
  if (ingredientsArrayValidationResult === true) {
    let ingredientsArray = [];

    for (let ingredient of ingredients) {
      const supplierGoodDoc = await SupplierGood.findOne({
        _id: ingredient.ingredient,
      })
        .select("measurementUnit pricePerUnit allergens")
        .lean();

      let ingredientObj = {
        ingredient: ingredient.ingredient,
        measurementUnit: ingredient.measurementUnit || "",
        requiredQuantity: ingredient.requiredQuantity || undefined,
        costOfRequiredQuantity: ingredient.costOfRequiredQuantity || undefined,
      };

      if (ingredient.measurementUnit && ingredient.requiredQuantity) {
        ingredientObj.costOfRequiredQuantity = calculateCostOfRequiredQuantity(
          ingredient,
          supplierGoodDoc
        );
      }
      ingredientsArray.push(ingredientObj);

      // add allergens from supplier goods to allergensArray if they are not already there
      //@ts-ignore
      (supplierGoodDoc?.allergens as string[] | undefined)?.forEach(
        (allergen) => {
          if (!allergensArray?.includes(allergen)) {
            allergensArray?.push(allergen);
          }
        }
      );
    }

    obj.costPrice = ingredientsArray.reduce((acc, ingredient) => {
      if (ingredient.costOfRequiredQuantity) {
        acc += ingredient.costOfRequiredQuantity;
      }
      return acc;
    }, 0);

    // @ts-ignore
    obj.ingredients = ingredientsArray.length ? ingredientsArray : undefined;
    obj.setMenu = undefined;
    return true;
  } else {
    return ingredientsArrayValidationResult;
  }
};

// helper function to set setMenu
const setMenuHelper = async (
  setMenu: Types.ObjectId[],
  allergensArray: string[] | undefined,
  obj: BusinessGoodInterface
) => {
  if (Array.isArray(setMenu) && setMenu.length) {
    const businessGoods = await BusinessGood.find({
      _id: { $in: setMenu },
    })
      .select("costPrice allergens")
      .lean();

    obj.costPrice = businessGoods.reduce(
      (acc, businessGood) => acc + businessGood.costPrice,
      0
    );

    // add allergens from supplier goods to allergensArray if they are not already there
    businessGoods.forEach((businessGood) => {
      businessGood.allergens.forEach((allergen: string) => {
        if (!allergensArray?.includes(allergen)) {
          allergensArray?.push(allergen);
        }
      });
    });

    obj.setMenu = setMenu;
    obj.ingredients = undefined;
    return true;
  } else {
    return "Invalid setMenu array";
  }
};

// @desc    Get business good by ID
// @route   GET /businessGoods/:businessGoodId
// @access  Private
export const GET = async (context: { params: any }) => {
  try {
    const businessGoodId = context.params.businessGoodId;

    if (!businessGoodId || !Types.ObjectId.isValid(businessGoodId)) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid businessGoodId" }),
        {
          status: 400,
        }
      );
    }

    // connect before first call to DB
    await connectDB();

    const businessGood = await BusinessGood.findById(businessGoodId)
      .populate("ingredients.ingredient", "name category")
      .lean();

    return !businessGood
      ? new NextResponse(
          JSON.stringify({ message: "No business good found" }),
          { status: 404 }
        )
      : new NextResponse(JSON.stringify(businessGood), { status: 200 });
  } catch (error: any) {
    return new NextResponse("Error: " + error, { status: 500 });
  }
};

// @desc    Update business good by ID
// @route   PUT /businessGoods/:businessGoodId
// @access  Private
export const PATCH = async (
  req: Request,
  context: { params: any }
) => {
  try {
    const businessGoodId = context.params.businessGoodId;
    const {
      name,
      keyword,
      category,
      subCategory,
      onMenu,
      available,
      sellingPrice,
      ingredients,
      setMenu,
      description,
      allergens,
      image,
      deliveryTime,
    } = req.body as unknown as BusinessGoodInterface;

    // check if businessGoodId is valid
    if (!businessGoodId || !Types.ObjectId.isValid(businessGoodId)) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid businessGoodId" }),
        {
          status: 400,
        }
      );
    }

    // one of the two fields should be present (ingredients or setMenu)
    if (!ingredients && !setMenu) {
      return new NextResponse(
        JSON.stringify({ message: "Ingredients or setMenu is required!" }),
        { status: 400 }
      );
    } else if (ingredients && setMenu) {
      return new NextResponse(
        JSON.stringify({
          message: "Only one of ingredients or setMenu is required!",
        }),
        { status: 400 }
      );
    }

    // connect before first call to DB
    await connectDB();

    // check if the business good exists
    const businessGood = (await BusinessGood.findById(
      businessGoodId
    ).lean()) as BusinessGoodInterface;
    if (!businessGood) {
      return new NextResponse(
        JSON.stringify({ message: "Business good not found!" }),
        { status: 404 }
      );
    }

    // check for duplicate names
    const duplicateBusinessGood = await BusinessGood.findOne({
      _id: { $ne: businessGoodId },
      business: businessGood.business,
      name,
    });

    if (duplicateBusinessGood) {
      return new NextResponse(
        JSON.stringify({ message: `Business good ${name} already exists!` }),
        { status: 409 }
      );
    }

    // prepare the update object
    const updateBusinessGoodObj: BusinessGoodInterface = {
      name: name || businessGood.name,
      keyword: keyword || businessGood.keyword,
      category: category || businessGood.category,
      subCategory: subCategory || businessGood.subCategory,
      onMenu: onMenu || businessGood.onMenu,
      available: available || businessGood.available,
      sellingPrice: sellingPrice || businessGood.sellingPrice,
      business: businessGood.business,
      ingredients: ingredients || businessGood.ingredients,
      setMenu: setMenu || businessGood.setMenu,
      description: description || businessGood.description,
      image: image || businessGood.image,
      deliveryTime: deliveryTime || businessGood.deliveryTime,
    };

    let allergensArray = [...(allergens || [])];

    // if ingredients exist, validate the ingredients array and create the ingredients array with objects
    // const ingredients = [
    //    {
    //      ingredient: "6612cd163684524f0bb078da",
    //      measurementUnit: "kg",
    //      requiredQuantity: 10,
    //      costOfRequiredQuantity: 100,
    //    },
    //    {
    //      ingredient: "6612cd163684524f0bb078da",
    //      measurementUnit: "kg",
    //      requiredQuantity: 10,
    //      costOfRequiredQuantity: 100,
    //    },
    // ];

    if (ingredients) {
      const ingredientsHelperResult = await ingredientsHelper(
        ingredients,
        allergensArray,
        updateBusinessGoodObj
      );
      if (ingredientsHelperResult !== true) {
        return new NextResponse(
          JSON.stringify({ message: ingredientsHelperResult }),
          { status: 400 }
        );
      }
    }

    // if setMenu exist, validate the setMenu array
    // const setMenu: [
    //     "60d1f26734a5d2a41c8d2a5b",
    //     "60d1f26734a5d2a41c8d2a5c"
    //   ],
    if (setMenu) {
      const setMenuHelperResult = await setMenuHelper(
        setMenu,
        allergensArray,
        updateBusinessGoodObj
      );
      if (setMenuHelperResult !== true) {
        return new NextResponse(
          JSON.stringify({ message: setMenuHelperResult }),
          { status: 400 }
        );
      }
    }

    // update the allergens array
    updateBusinessGoodObj.allergens = allergensArray;

    // update the business good
    await BusinessGood.findByIdAndUpdate(
      { _id: businessGoodId },
      updateBusinessGoodObj,
      {
        new: true,
        usefindAndModify: false,
      }
    );

    return new NextResponse(
      JSON.stringify({
        message: `Business good ${name} updated successfully!`,
      }),
      { status: 200 }
    );
  } catch (error: any) {
    return new NextResponse("Error: " + error, { status: 500 });
  }
};

// delete a business goods shouldnt be allowed for data integrity, historical purposes and analytics
// the only case where a business goods should be deleted is if the business itself is deleted
// or if the business good is not used in any order or set menu
// @desc    Delete business good by ID
// @route   DELETE /businessGoods/:businessGoodId
// @access  Private
export const DELETE = async (context: { params: any }) => {
  try {
    const businessGoodId = context.params.businessGoodId;

    // check if businessGoodId is valid
    if (!businessGoodId || !Types.ObjectId.isValid(businessGoodId)) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid businessGoodId" }),
        {
          status: 400,
        }
      );
    }

    // connect before first call to DB
    await connectDB();

    // check if the business good is used in any order
    const businessGoodInOrders = await Order.find({
      businessGoods: businessGoodId,
    }).lean();
    if (businessGoodInOrders.length > 0) {
      return new NextResponse(
        JSON.stringify({
          message: "Cannot delete Business good because it is in some orders!",
        }),
        { status: 400 }
      );
    }

    // check if the business good is used in any set menu
    const businessGoodInSetMenu = await BusinessGood.find({
      setMenu: businessGoodId,
    }).lean();
    if (businessGoodInSetMenu.length > 0) {
      return new NextResponse(
        JSON.stringify({
          message:
            "Cannot delete Business good because it is in some set menu!",
        }),
        { status: 400 }
      );
    }

    // delete and check if the business good exists
    const result = await BusinessGood.deleteOne({ _id: businessGoodId });
    if (result.deletedCount === 0) {
      return new NextResponse(
        JSON.stringify({ message: "Business good not found" }),
        { status: 404 }
      );
    }

    // delete the business good id reference from promotions
    await Promotion.updateMany(
      { businessGoods: businessGoodId },
      { $pull: { businessGoods: businessGoodId } }
    );

    // delete the business good
    await BusinessGood.deleteOne({ _id: businessGoodId });
    
    return new NextResponse(
      JSON.stringify({
        message: `Business good ${businessGoodId} deleted successfully!`,
      }),
      { status: 200 }
    );
  } catch (error: any) {
    return new NextResponse("Error: " + error, { status: 500 });
  }
};
