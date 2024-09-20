import { NextResponse } from "next/server";
import { IDailySalesReport } from "@/app/lib/interface/IDailySalesReport";

// import utils
import connectDb from "@/app/lib/utils/connectDb";
import { createDailySalesReport } from "../dailySalesReports/utils/createDailySalesReport";
import { handleApiError } from "@/app/lib/utils/handleApiError";

// import models
import DailySalesReport from "@/app/lib/models/dailySalesReport";
import User from "@/app/lib/models/user";
import BusinessGood from "@/app/lib/models/businessGood";
import Order from "@/app/lib/models/order";
import SalesLocation from "@/app/lib/models/salesLocation";
import { ISalesLocation } from "@/app/lib/interface/ISalesLocation";
import { createSalesLocation } from "./utils/createSalesLocation";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";
import Business from "@/app/lib/models/business";

// @desc    Get all salesLocations
// @route   GET /salesLocations
// @access  Private
export const GET = async (req: Request) => {
  try {
    // connect before first call to DB
    await connectDb();

    const salesLocations = await SalesLocation.find()
      .populate({
        path: "openedById",
        select: "username currentShiftRole",
        model: User,
      })
      .populate({
        path: "responsibleById",
        select: "username currentShiftRole",
        model: User,
      })
      .populate({
        path: "closedById",
        select: "username currentShiftRole",
        model: User,
      })
      .populate({
        path: "ordersIds",
        select:
          "billingStatus orderStatus orderPrice orderNetPrice paymentMethod allergens promotionApplyed discountPercentage createdAt businessGoods",
        populate: {
          path: "businessGoods",
          select: "name mainCategory subCategory allergens sellingPrice",
          model: BusinessGood,
        },
        model: Order,
      })
      .lean();

    return !salesLocations?.length
      ? new NextResponse(
          JSON.stringify({ message: "No salesLocations found!" }),
          {
            status: 404,
            headers: { "Content-Type": "application/json" },
          }
        )
      : new NextResponse(JSON.stringify(salesLocations), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        });
  } catch (error) {
    return handleApiError("Get all salesLocations failed!", error);
  }
};

// first create a empty salesLocation, then update it with the ordersIds
// @desc    Create new salesLocations
// @route   POST /salesLocations
// @access  Private
export const POST = async (req: Request) => {
  try {
    const {
      salesLocationReference,
      guests,
      status = "Occupied",
      openedById,
      businessId,
      clientName,
    } = (await req.json()) as ISalesLocation;

    // check required fields
    if (!salesLocationReference || !guests || !openedById || !businessId) {
      return new NextResponse(
        JSON.stringify({
          message:
            "SalesLocationReference, guest, openedById and businessId are required!",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // validate ids
    if (isObjectIdValid([openedById, businessId]) !== true) {
      return new NextResponse(
        JSON.stringify({
          message: "OpenedBy or businessId not valid!",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // connect before first call to DB
    await connectDb();

    // check salesLocationReference exists in the business
    if (
      !(await Business.exists({
        _id: businessId,
        "businessSalesLocation.locationReferenceName": salesLocationReference,
      }))
    ) {
      return new NextResponse(
        JSON.stringify({
          message: `SalesLocationReference ${salesLocationReference} does not exist in this business!`,
        }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // **** IMPORTANT ****
    // dailySalesReport is created when the first salesLocation of the day is created
    const dailySalesReport: IDailySalesReport | null =
      await DailySalesReport.findOne({
        isDailyReportOpen: true,
        businessId,
      })
        .select("dailyReferenceNumber")
        .lean();

    const dailyReferenceNumber = dailySalesReport
      ? dailySalesReport.dailyReferenceNumber
      : await createDailySalesReport(businessId);

    if (
      await SalesLocation.exists({
        dailyReferenceNumber: dailyReferenceNumber,
        businessId,
        salesLocationReference,
        status: { $ne: "Closed" },
      })
    ) {
      return new NextResponse(
        JSON.stringify({
          message: `SalesLocation ${salesLocationReference} already exists and it is not closed!`,
        }),
        { status: 409, headers: { "Content-Type": "application/json" } }
      );
    }

    // create new salesLocation
    const newSalesLocationObj = {
      dailyReferenceNumber,
      salesLocationReference,
      guests,
      status,
      openedById,
      responsibleById: openedById,
      businessId,
      clientName,
    };

    // we use a outside function to create the salesLocation because this function is used in other places
    // create new salesLocation
    await createSalesLocation(newSalesLocationObj);

    return new NextResponse(
      JSON.stringify({
        message: `SalesLocation ${salesLocationReference} created successfully!`,
      }),
      {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return handleApiError("Create salesLocation failed!", error);
  }
};
