import { NextResponse } from "next/server";
import { IDailySalesReport } from "@/app/lib/interface/IDailySalesReport";

// import utils
import connectDb from "@/app/lib/utils/connectDb";
import { createDailySalesReport } from "../dailySalesReports/utils/createDailySalesReport";
import { handleApiError } from "@/app/lib/utils/handleApiError";
import { createSalesLocation } from "./utils/createSalesLocation";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";

// import interfaces
import { ISalesLocation } from "@/app/lib/interface/ISalesLocation";

// imported models
import DailySalesReport from "@/app/lib/models/dailySalesReport";
import User from "@/app/lib/models/user";
import BusinessGood from "@/app/lib/models/businessGood";
import Order from "@/app/lib/models/order";
import Business from "@/app/lib/models/business";
import SalesLocation from "@/app/lib/models/salesLocation";

// @desc    Get all salesLocations
// @route   GET /salesLocations
// @access  Private
export const GET = async (req: Request) => {
  try {
    // connect before first call to DB
    await connectDb();

    // Step 1: Perform the aggregation for businessSalesLocation
    const salesLocations = await SalesLocation.aggregate([
      {
        // Lookup to join with the Business collection
        $lookup: {
          from: "businesses", // MongoDB collection name for the Business model
          localField: "salesLocationReferenceId", // Field from SalesLocation
          foreignField: "businessSalesLocation._id", // Field from Business
          as: "businessData", // Output array with the joined data
        },
      },
      {
        // Unwind the array to get individual business location objects
        $unwind: "$businessData",
      },
      {
        // Project to extract relevant businessSalesLocation details
        $addFields: {
          salesLocationReferenceData: {
            $arrayElemAt: [
              {
                $filter: {
                  input: "$businessData.businessSalesLocation", // Access the array in Business
                  as: "salesLocation",
                  cond: {
                    $eq: ["$$salesLocation._id", "$salesLocationReferenceId"], // Match the salesLocationReferenceId with the _id in the array
                  },
                },
              },
              0,
            ],
          },
        },
      },
      {
        // Project only the locationReferenceName from the salesLocationReferenceData
        $project: {
          businessData: 0, // Remove the original business data
          "salesLocationReferenceData.locationType": 0, // Optionally remove the _id from salesLocationReferenceData if not needed
          "salesLocationReferenceData.selfOrdering": 0, // Optionally remove the _id from salesLocationReferenceData if not needed
          "salesLocationReferenceData.qrCode": 0, // Optionally remove the _id from salesLocationReferenceData if not needed
          "salesLocationReferenceData.qrEnabled": 0, // Optionally remove the _id from salesLocationReferenceData if not needed
        },
      },
    ]);

    // Step 2: Populate the user-related fields and order details
    await SalesLocation.populate(salesLocations, [
      {
        path: "openedById responsibleById closedById",
        select: "username currentShiftRole",
        model: User,
      },
      {
        path: "ordersIds",
        select:
          "billingStatus orderStatus orderPrice orderNetPrice paymentMethod allergens promotionApplyed discountPercentage createdAt businessGoodsIds",
        populate: {
          path: "businessGoodsIds",
          select: "name mainCategory subCategory allergens sellingPrice",
          model: BusinessGood,
        },
        model: Order,
      },
    ]);

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
      salesLocationReferenceId,
      guests,
      status = "Occupied",
      openedById,
      businessId,
      clientName,
    } = (await req.json()) as ISalesLocation;

    // check required fields
    if (!salesLocationReferenceId || !guests || !openedById || !businessId) {
      return new NextResponse(
        JSON.stringify({
          message:
            "SalesLocationReference, guest, openedById and businessId are required!",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // validate ids
    if (
      isObjectIdValid([salesLocationReferenceId, openedById, businessId]) !==
      true
    ) {
      return new NextResponse(
        JSON.stringify({
          message: "OpenedBy or businessId not valid!",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // connect before first call to DB
    await connectDb();

    // check salesLocationReferenceId exists in the business
    if (
      !(await Business.exists({
        _id: businessId,
        "businessSalesLocation._id": salesLocationReferenceId,
      }))
    ) {
      return new NextResponse(
        JSON.stringify({
          message: `SalesLocationReference ${salesLocationReferenceId} does not exist in this business!`,
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
        salesLocationReferenceId,
        status: { $ne: "Closed" },
      })
    ) {
      return new NextResponse(
        JSON.stringify({
          message: `SalesLocation ${salesLocationReferenceId} already exists and it is not closed!`,
        }),
        { status: 409, headers: { "Content-Type": "application/json" } }
      );
    }

    // create new salesLocation
    const newSalesLocationObj = {
      dailyReferenceNumber,
      salesLocationReferenceId,
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
        message: `SalesLocation ${salesLocationReferenceId} created successfully!`,
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
