import connectDB from "@/lib/db";
import { NextResponse } from "next/server";
import { Types } from "mongoose";
import convert from "convert-units";

// import models
import BusinessGood from "@/lib/models/businessGood";
import SupplierGood from "@/lib/models/supplierGood";

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

// @desc    Get all business goods
// @route   GET /businessGoods
// @access  Private
export const GET = async () => {
  try {
    // connect before first call to DB
    await connectDB();
    const businessGoods = await BusinessGood.find()
      .populate("ingredients.ingredient", "name category")
      .lean();
    return !businessGoods.length
      ? new NextResponse(
          JSON.stringify({ message: "No business goods found" }),
          { status: 404 }
        )
      : new NextResponse(JSON.stringify(businessGoods), { status: 200 });
  } catch (error: any) {
    return new NextResponse("Error: " + error, { status: 500 });
  }
};

// @desc    Create new business good
// @route   POST /businessGoods
// @access  Private
export const POST = async (req: Request) => {
  try {
    const {
      name,
      keyword,
      category,
      subCategory,
      onMenu,
      available,
      sellingPrice,
      business,
      ingredients,
      setMenu,
      description,
      allergens,
      image,
      deliveryTime,
    } = req.body as unknown as BusinessGoodInterface;

    // check required fields
    if (
      !name ||
      !keyword ||
      !category ||
      !subCategory ||
      onMenu === undefined ||
      available === undefined ||
      !sellingPrice ||
      !business
    ) {
      return new NextResponse(
        JSON.stringify({
          message:
            "Name, keyword, category, subcategory, onMenu, available, sellingPrice and business are required!",
        }),
        { status: 400 }
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

    // check for duplicate business good
    const duplicateBusinessGood = await BusinessGood.findOne({
      business,
      name,
    });

    if (duplicateBusinessGood) {
      return new NextResponse(
        JSON.stringify({
          message: `${name} already exists on business goods!`,
        }),
        { status: 400 }
      );
    }

    // create a business good object
    let businessGoodObj: BusinessGoodInterface = {
      name,
      keyword,
      category,
      subCategory,
      onMenu,
      available,
      sellingPrice,
      business,
      description: description || undefined,
      image: image || undefined,
      deliveryTime: deliveryTime || undefined,
    };

    let allergensArray = [...(allergens ?? [])];

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
        businessGoodObj
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
        businessGoodObj
      );
      if (setMenuHelperResult !== true) {
        return new NextResponse(
          JSON.stringify({ message: setMenuHelperResult }),
          { status: 400 }
        );
      }
    }

    // update the allergens array
    businessGoodObj.allergens = allergensArray;

    // create the new business good
    const businessGood = await BusinessGood.create(businessGoodObj);

    return businessGood
      ? new NextResponse(
          JSON.stringify({
            message: `Business good ${name} created successfully!`,
          }),
          { status: 201 }
        )
      : new NextResponse(
          JSON.stringify({ message: "Failed to create business good!" }),
          { status: 500 }
        );
  } catch (error: any) {
    return new NextResponse("Error: " + error, { status: 500 });
  }
};