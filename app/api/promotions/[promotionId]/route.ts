import { NextResponse } from "next/server";
import connectDB from "@/app/lib/db";

// imported models
import Promotion from "@/app/lib/models/promotion";
import { Types } from "mongoose";
import { IPromotion } from "@/app/lib/interface/IPromotion";
import { validateDateAndTime } from "../utils/validateDateAndTime";
import { validateDaysOfTheWeek } from "../utils/validateDaysOfTheWeek";
import { handleApiError } from "@/app/utils/handleApiError";
import { validatePromotionType } from "../utils/validatePromotionType";

// when bill is printed, check if orders have a promotion base on their order time
// if they have a promotion, apply it to the order updating its price and promotionApplied field

// @desc    Get promotion by ID
// @route   GET /promotions/:promotionId
// @access  Private
export const GET = async (
  req: Request,
  context: { params: { promotionId: Types.ObjectId } }
) => {
  try {
    const promotionId = context.params.promotionId;
    // check if the promotionId is valid
    if (!promotionId || !Types.ObjectId.isValid(promotionId)) {
      return new NextResponse("Invalid promotionId!", {
        status: 400,
      });
    }

    // connect before first call to DB
    await connectDB();

    const promotion = await Promotion.findById(promotionId)
      // .populate("businessGoodsToApply", "name sellingPrice")
      .lean();

    return !promotion
      ? new NextResponse("Promotion  not found!", {
          status: 404,
        })
      : new NextResponse(JSON.stringify(promotion), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
  } catch (error) {
    return handleApiError("Get promotion by its id failed!", error);
  }
};

// @desc    Update promotion by ID
// @route   PATCH /promotions/:promotionId
// @access  Private
export const PATCH = async (
  req: Request,
  context: { params: { promotionId: Types.ObjectId } }
) => {
  try {
    const promotionId = context.params.promotionId;
    // check if the promotionId is valid
    if (!promotionId || !Types.ObjectId.isValid(promotionId)) {
      return new NextResponse("Invalid promotionId!", {
        status: 400,
      });
    }

    const {
      promotionName,
      promotionPeriod,
      weekDays,
      activePromotion,
      promotionType,
      businessGoodsToApply,
      description,
    } = (await req.json()) as IPromotion;

    // validate dateRange and timeRange
    if (promotionPeriod) {
      const validateDateAndTimeResult = validateDateAndTime(promotionPeriod);

      if (validateDateAndTimeResult !== true) {
        return new NextResponse(validateDateAndTimeResult, { status: 400 });
      }
    }

    // validate weekDays
    if (weekDays) {
      const validateDaysOfTheWeekResult = validateDaysOfTheWeek(weekDays);

      if (validateDaysOfTheWeekResult !== true) {
        return new NextResponse(validateDaysOfTheWeekResult, { status: 400 });
      }
    }

    // validate promotionType
    if (promotionType) {
      const validatePromotionTypeResult = validatePromotionType(promotionType);
      if (validatePromotionTypeResult !== true) {
        return new NextResponse(validatePromotionTypeResult, { status: 400 });
      }
    }

    // connect before first call to DB
    await connectDB();

    // check if the promotion exists
    const promotion: IPromotion | null = await Promotion.findById(
      promotionId
    ).lean();

    if (!promotion) {
      return new NextResponse("Promotion not found!", { status: 404 });
    }

    // check duplicate promotion
    const duplicatePromotion = await Promotion.findOne({
      _id: { $ne: promotionId },
      business: promotion.business,
      promotionName,
    }).lean();

    if (duplicatePromotion) {
      return new NextResponse(`Promotion ${promotionName} already exists!`, {
        status: 400,
      });
    }

    // prepare update object
    const updatedPromotion = {
      promotionName: promotionName || promotion.promotionName,
      promotionType: promotionType || promotion.promotionType,
      activePromotion: activePromotion || promotion.activePromotion,
      businessGoodsToApply:
        businessGoodsToApply || promotion.businessGoodsToApply,
      description: description || promotion.description,
    };

    // save the updated promotion
    await Promotion.findByIdAndUpdate(promotionId, updatedPromotion, {
      new: true,
    });

    return new NextResponse(
      `Promotion ${updatedPromotion.promotionName} updated successfully!`,
      { status: 200 }
    );
  } catch (error) {
    return handleApiError("Update promotion failed!", error);
  }
};

// @desc    Delete promotion by ID
// @route   DELETE /promotions/:promotionId
// @access  Private
export const DELETE = async (
  req: Request,
  context: { params: { promotionId: Types.ObjectId } }
) => {
  try {
    const promotionId = context.params.promotionId;
    // check if the promotionId is valid
    if (!promotionId || !Types.ObjectId.isValid(promotionId)) {
      return new NextResponse("Invalid promotionId!", {
        status: 400,
      });
    }

    // connect before first call to DB
    await connectDB();

    // delete promotion and check if it existed
    const result = await Promotion.deleteOne({ _id: promotionId });

    if (result.deletedCount === 0) {
      return new NextResponse("Promotion not found!", { status: 404 });
    }

    return new NextResponse(`Promotion ${promotionId} deleted!`, {
      status: 200,
    });
  } catch (error) {
    return handleApiError("Delete promotion failed!", error);
  }
};
