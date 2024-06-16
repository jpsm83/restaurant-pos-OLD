import connectDB from "@/lib/db";
import { NextResponse } from "next/server";

// import models
import BusinessGood from "@/lib/models/businessGood";
import { IBusinessGood } from "@/app/interface/IBusinessGood";
import { ingredientsHelper } from "./utils/ingredientsHelper";
import { setMenuHelper } from "./utils/setMenuHelper";

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
    } = req.body as unknown as IBusinessGood;

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
    let businessGoodObj: IBusinessGood = {
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