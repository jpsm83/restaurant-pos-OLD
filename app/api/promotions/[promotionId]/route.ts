import { NextResponse } from "next/server";
import connectDB from "@/lib/db";

// imported models
import Promotion from "@/lib/models/promotion";
import { Types } from "mongoose";
import { IPromotion } from "@/app/interface/IPromotion";
import { validateDateAndTime } from "../utils/validateDateAndTime";
import { validateDaysOfTheWeek } from "../utils/validateDaysOfTheWeek";

// when bill is printed, check if orders have a promotion base on their order time
// if they have a promotion, apply it to the order updating its price and promotionApplied field

// @desc    Get promotion by ID
// @route   GET /promotion/:promotionId
// @access  Private
export const GET = async (context: { params: any }) => {
  try {
    const promotionId = context.params.promotionId;
    // check if the promotionId is valid
    if (!promotionId || !Types.ObjectId.isValid(promotionId)) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid promotionId" }),
        {
          status: 400,
        }
      );
    }

    // connect before first call to DB
    await connectDB();

    const promotion = await Promotion.findById(promotionId)
      .populate("businessGoodsToApply", "name sellingPrice")
      .lean();

    return !promotion
      ? new NextResponse(JSON.stringify({ message: "Promotion  not found!" }), {
          status: 404,
        })
      : new NextResponse(JSON.stringify(promotion), { status: 200 });
  } catch (error: any) {
    return new NextResponse("Error: " + error, { status: 500 });
  }
};

// @desc    Update promotion by ID
// @route   PATCH /promotion/:promotionId
// @access  Private
export const PATCH = async (
  req: Request,
  context: { params: any }
) => {
  try {
    const promotionId = context.params.promotionId;
    // check if the promotionId is valid
    if (!promotionId || !Types.ObjectId.isValid(promotionId)) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid promotionId" }),
        {
          status: 400,
        }
      );
    }

    // connect before first call to DB
    await connectDB();

    const {
      promotionName,
      promotionPeriod,
      weekDays,
      promotionType,
      activePromotion,
      fixedPrice,
      discountPercent,
      twoForOne,
      threeForTwo,
      secondHalfPrice,
      fullComplimentary,
      businessGoodsToApply,
      description,
    } = req.body as unknown as IPromotion;

    // check required fields
    if (
      !promotionName ||
      !promotionPeriod ||
      !weekDays ||
      !promotionType ||
      activePromotion === undefined
    ) {
      return new NextResponse(
        JSON.stringify({
          message:
            "PromotionName, promotionPeriod, weekDays, promotionType and activePromotion are required fields!",
        }),
        { status: 400 }
      );
    }

    // check if the promotion exists
    const promotion: IPromotion | null = await Promotion.findById(
      promotionId
    ).lean();
    if (!promotion) {
      return new NextResponse(
        JSON.stringify({ message: "Promotion not found!" }),
        { status: 404 }
      );
    }

    // check duplicate promotion
    const duplicatePromotion = await Promotion.findOne({
      _id: { $ne: promotionId },
      business: promotion.business,
      promotionName,
    }).lean();
    if (duplicatePromotion) {
      return new NextResponse(
        JSON.stringify({
          message: `Promotion ${promotionName} already exists!`,
        }),
        { status: 400 }
      );
    }

    // prepare update object
    const updateObj = {
      promotionName: promotionName || promotion.promotionName,
      promotionType: promotionType || promotion.promotionType,
      activePromotion: activePromotion || promotion.activePromotion,
      fixedPrice: fixedPrice || promotion.fixedPrice,
      discountPercent: discountPercent || promotion.discountPercent,
      twoForOne: twoForOne || promotion.twoForOne,
      threeForTwo: threeForTwo || promotion.threeForTwo,
      secondHalfPrice: secondHalfPrice || promotion.secondHalfPrice,
      fullComplimentary: fullComplimentary || promotion.fullComplimentary,
      businessGoodsToApply:
        businessGoodsToApply || promotion.businessGoodsToApply,
      description: description || promotion.description,
    };

    // validate dateRange and timeRange
    const validateDateAndTimeResult = validateDateAndTime(
      promotionPeriod,
      updateObj
    );
    if (validateDateAndTimeResult !== true) {
      return new NextResponse(
        JSON.stringify({ message: validateDateAndTimeResult }),
        { status: 400 }
      );
    }

    // validate weekDays
    const validateDaysOfTheWeekResult = validateDaysOfTheWeek(
      weekDays,
      updateObj
    );
    if (validateDaysOfTheWeekResult !== true) {
      return new NextResponse(
        JSON.stringify({ message: validateDaysOfTheWeekResult }),
        { status: 400 }
      );
    }

    // save the updated promotion
    const updatedPromotion = await Promotion.findByIdAndUpdate(
      { _id: promotionId },
      updateObj,
      {
        new: true,
        usefindAndModify: false,
      }
    ).lean();

    return updatedPromotion
      ? new NextResponse(
          JSON.stringify({
            message: `Promotion ${promotionName} updated successfully!`,
          }),
          { status: 200 }
        )
      : new NextResponse(
          JSON.stringify({ message: "Failed to update promotion!" }),
          { status: 400 }
        );
  } catch (error: any) {
    return new NextResponse("Error: " + error, { status: 500 });
  }
};

// @desc    Delete promotion by ID
// @route   DELETE /promotion/:promotionId
// @access  Private
export const DELETE = async (context: { params: any }) => {
  try {
    const promotionId = context.params.promotionId;
    // check if the promotionId is valid
    if (!promotionId || !Types.ObjectId.isValid(promotionId)) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid promotionId" }),
        {
          status: 400,
        }
      );
    }

    // connect before first call to DB
    await connectDB();

    // delete promotion and check if it existed
    const result = await Promotion.deleteOne({ _id: promotionId });

    if (result.deletedCount === 0) {
      return new NextResponse(
        JSON.stringify({ message: "Promotion not found" }),
        { status: 404 }
      );
    }

    return new NextResponse(
      JSON.stringify({ message: `Promotion ${promotionId} deleted!` }),
      { status: 200 }
    );
  } catch (error: any) {
    return new NextResponse("Error: " + error, { status: 500 });
  }
};
