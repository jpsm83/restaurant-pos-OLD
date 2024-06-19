import connectDB from "@/app/lib/db";
import { NextResponse } from "next/server";
import { Types } from "mongoose";

// import models
import BusinessGood from "@/app/lib/models/businessGood";
import Promotion from "@/app/lib/models/promotion";
import Order from "@/app/lib/models/order";
import { IBusinessGood } from "@/app/lib/interface/IBusinessGood";
import { ingredientsHelper } from "../utils/ingredientsHelper";
import { setMenuHelper } from "../utils/setMenuHelper";

// @desc    Get business good by ID
// @route   GET /businessGoods/:businessGoodId
// @access  Private
export const GET = async (context: { params: { businessGoodId: Types.ObjectId } }) => {
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
  context: { params: { businessGoodId: Types.ObjectId } }
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
    } = req.body as unknown as IBusinessGood;

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
    ).lean()) as IBusinessGood;
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
    const updateBusinessGoodObj: IBusinessGood = {
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
export const DELETE = async (context: { params: { businessGoodId: Types.ObjectId } }) => {
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
