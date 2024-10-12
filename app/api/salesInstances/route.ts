import { NextResponse } from "next/server";
import { IDailySalesReport } from "@/app/lib/interface/IDailySalesReport";

// import utils
import connectDb from "@/app/lib/utils/connectDb";
import { createDailySalesReport } from "../dailySalesReports/utils/createDailySalesReport";
import { handleApiError } from "@/app/lib/utils/handleApiError";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";
import { createSalesInstance } from "./utils/createSalesInstance";

// import interfaces
import { ISalesInstance } from "@/app/lib/interface/ISalesInstance";

// imported models
import DailySalesReport from "@/app/lib/models/dailySalesReport";
import User from "@/app/lib/models/user";
import BusinessGood from "@/app/lib/models/businessGood";
import Order from "@/app/lib/models/order";
import Business from "@/app/lib/models/business";
import SalesInstance from "@/app/lib/models/salesInstance";
import path from "path";
import SalesPoint from "@/app/lib/models/salesPoint";

// @desc    Get all salesInstances
// @route   GET /salesInstances
// @access  Private
export const GET = async (req: Request) => {
  try {
    // connect before first call to DB
    await connectDb();

    const salesInstances = await SalesInstance.find()
      .populate({
        path: "salesPointId",
        select: "salesPointName salesPointType selfOrdering",
        model: SalesPoint,
      })
      .populate({
        path: "openedById responsibleById closedById",
        select: "username currentShiftRole",
        model: User,
      })
      .populate({
        path: "salesGroup.ordersIds",
        select:
          "billingStatus orderStatus orderGrossPrice orderNetPrice paymentMethod allergens promotionApplyed discountPercentage createdAt businessGoodsIds",
        populate: {
          path: "businessGoodsIds",
          select: "name mainCategory subCategory allergens sellingPrice",
          model: BusinessGood,
        },
        model: Order,
      })
      .lean();

    return !salesInstances?.length
      ? new NextResponse(
          JSON.stringify({ message: "No salesInstances found!" }),
          {
            status: 404,
            headers: { "Content-Type": "application/json" },
          }
        )
      : new NextResponse(JSON.stringify(salesInstances), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        });
  } catch (error) {
    return handleApiError("Get all salesInstances failed!", error);
  }
};

// first create a empty salesInstance, then update it with the salesGroup.ordersIds
// @desc    Create new salesInstances
// @route   POST /salesInstances
// @access  Private
export const POST = async (req: Request) => {
  try {
    const {
      salesPointId,
      guests,
      status = "Occupied",
      openedById,
      businessId,
      clientName,
    } = (await req.json()) as ISalesInstance;

    // check required fields
    if (!salesPointId || !guests || !openedById || !businessId) {
      return new NextResponse(
        JSON.stringify({
          message:
            "SalesInstanceReference, guest, openedById and businessId are required!",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // validate ids
    if (isObjectIdValid([salesPointId, openedById, businessId]) !== true) {
      return new NextResponse(
        JSON.stringify({
          message: "OpenedBy or businessId not valid!",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // connect before first call to DB
    await connectDb();

    // check salesPointId exists
    if (
      !(await SalesPoint.exists({
        _id: salesPointId,
      }))
    ) {
      return new NextResponse(
        JSON.stringify({
          message: "Sales point does not exist in this business!",
        }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // **** IMPORTANT ****
    // dailySalesReport is created when the first salesInstance of the day is created
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
      await SalesInstance.exists({
        dailyReferenceNumber: dailyReferenceNumber,
        businessId,
        salesPointId,
        status: { $ne: "Closed" },
      })
    ) {
      return new NextResponse(
        JSON.stringify({
          message: "SalesInstance already exists and it is not closed!",
        }),
        { status: 409, headers: { "Content-Type": "application/json" } }
      );
    }

    // create new salesInstance
    const newSalesInstanceObj = {
      dailyReferenceNumber,
      salesPointId,
      guests,
      status,
      openedById,
      responsibleById: openedById,
      businessId,
      clientName,
    };

    // we use a outside function to create the salesInstance because this function is used in other places
    // create new salesInstance
    await createSalesInstance(newSalesInstanceObj);

    return new NextResponse(
      JSON.stringify({
        message: "SalesInstance created successfully!",
      }),
      {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return handleApiError("Create salesInstance failed!", error);
  }
};
