import { NextResponse } from "next/server";
import connectDB from "@/lib/db";

// imported models
import Promotion from "@/lib/models/promotion";
import { IPromotion } from "@/app/interface/IPromotion";
import { validateDateAndTime } from "./utils/validateDateAndTime";
import { validateDaysOfTheWeek } from "./utils/validateDaysOfTheWeek";

// when bill is printed, check if orders have a promotion base on their order time
// if they have a promotion, apply it to the order updating its price and promotionApplied field

// @desc    Get all promotion
// @route   GET /promotion
// @access  Private
export const GET = async () => {
  try {
    // connect before first call to DB
    await connectDB();

    const promotion = await Promotion.find()
      .populate("businessGoodsToApply", "name sellingPrice")
      .lean();

    return !promotion.length
      ? new NextResponse(JSON.stringify({ message: "No promotion  found!" }), {
          status: 404,
        })
      : new NextResponse(JSON.stringify(promotion), { status: 200 });
  } catch (error: any) {
    return new NextResponse("Error: " + error, { status: 500 });
  }
};

// @desc    Create new promotion
// @route   POST /promotion
// @access  Private
export const POST = async (req: Request) => {
  try {
    const {
      promotionName,
      promotionPeriod,
      weekDays,
      promotionType,
      activePromotion,
      business,
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
      activePromotion === undefined ||
      !business
    ) {
      return new NextResponse(
        JSON.stringify({
          message:
            "PromotionName, promotionPeriod, weekDays, promotionType, activePromotion and business are required fields!",
        }),
        { status: 400 }
      );
    }

    // connect before first call to DB
    await connectDB();

    // check for duplicate promotion
    const duplicatePromotion = await Promotion.findOne({
      business,
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

    // create promotion object
    const promotionObj = {
      promotionName,
      promotionType,
      activePromotion,
      business,
      fixedPrice: fixedPrice || undefined,
      discountPercent: discountPercent || undefined,
      twoForOne: twoForOne || undefined,
      threeForTwo: threeForTwo || undefined,
      secondHalfPrice: secondHalfPrice || undefined,
      fullComplimentary: fullComplimentary || undefined,
      businessGoodsToApply: businessGoodsToApply || undefined,
      description: description || undefined,
    };

    // validate dateRange and timeRange
    const validateDateAndTimeResult = validateDateAndTime(
      promotionPeriod,
      promotionObj
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
      promotionObj
    );
    if (validateDaysOfTheWeekResult !== true) {
      return new NextResponse(
        JSON.stringify({ message: validateDaysOfTheWeekResult }),
        { status: 400 }
      );
    }

    // create a new promotion
    const promotion = await Promotion.create(promotionObj);

    // confirm promotion was created
    return promotion
      ? new NextResponse(
          JSON.stringify({
            message: `Promotion ${promotionName} created successfully!`,
          }),
          { status: 201 }
        )
      : new NextResponse(
          JSON.stringify({ message: "Failed to create promotion!" }),
          { status: 400 }
        );
  } catch (error: any) {
    return new NextResponse("Error: " + error, { status: 500 });
  }
};
