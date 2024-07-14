import connectDB from "@/app/lib/db";
import { NextResponse } from "next/server";
import { ITable } from "@/app/lib/interface/ITable";
import { IDailySalesReport } from "@/app/lib/interface/IDailySalesReport";

// import functions
import { createDailySalesReport } from "../dailySalesReports/utils/createDailySalesReport";
import { addUserToDailySalesReport } from "../dailySalesReports/utils/addUserToDailySalesReport";

// import models
import Business from "@/app/lib/models/business";
import Table from "@/app/lib/models/table";
import DailySalesReport from "@/app/lib/models/dailySalesReport";
import { handleApiError } from "@/app/utils/handleApiError";
import { create } from "domain";
import { createTable } from "./utils/createTable";

// @desc    Get all tables
// @route   GET /tables
// @access  Private
export const GET = async () => {
  try {
    // connect before first call to DB
    await connectDB();

    const tables = await Table.find()
      // .populate("openedBy", "username currentShiftRole")
      // .populate("responsibleBy", "username currentShiftRole")
      // .populate("closedBy", "username currentShiftRole")
      // .populate({
      //   path: "orders",
      //   select:
      //     "billingStatus orderStatus orderPrice orderNetPrice paymentMethod allergens promotionApplyed discountPercentage createdAt",
      //   populate: {
      //     path: "businessGoods",
      //     select: "name category subCategory allergens sellingPrice",
      //   },
      // })
      .lean();

    return !tables?.length
      ? new NextResponse("No tables found!", {
          status: 404,
        })
      : new NextResponse(JSON.stringify(tables), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        });
  } catch (error: any) {
    return handleApiError("Get all tables failed!", error);
  }
};

// first create a empty table, then update it with the orders
// @desc    Create new tables
// @route   POST /tables
// @access  Private
export const POST = async (req: Request) => {
  try {
    const {
      tableReference,
      guests,
      status,
      openedBy,
      responsibleBy,
      business,
      clientName,
    } = (await req.json()) as ITable;

    // check required fields
    if (
      !tableReference ||
      !guests ||
      !status ||
      !openedBy ||
      !responsibleBy ||
      !business
    ) {
      return new NextResponse(
        "TableReference, guest, status, openedBy, responsibleBy and business are required!",
        { status: 400 }
      );
    }

    // connect before first call to DB
    await connectDB();

    // check if there is a daily report for the day already created
    const currentDateNoTime = new Date();
    currentDateNoTime.setHours(0, 0, 0, 0);
    const currentDateUnix = currentDateNoTime.getTime();

    const dailySalesReport: IDailySalesReport | null =
      await DailySalesReport.findOne({
        dayReferenceNumber: currentDateUnix,
        business,
      })
        .select("dayReferenceNumber")
        .lean();

    const dayReferenceNumber = dailySalesReport
      ? dailySalesReport.dayReferenceNumber
      : await createDailySalesReport(business);

    // check if tables already exists and it is not closed
    const duplicateTable = await Table.findOne({
      dayReferenceNumber: dayReferenceNumber,
      business,
      tableReference,
      status: { $ne: "Closed" },
    })
      .select("_id")
      .lean();

    if (duplicateTable) {
      return new NextResponse(
        `Table ${tableReference} already exists and it is not closed!`,
        { status: 409 }
      );
    }

    // create new table
    await createTable(
      tableReference,
      guests,
      openedBy,
      responsibleBy,
      business,
      clientName,
      dayReferenceNumber as number
    );

    return new NextResponse(`Table ${tableReference} created successfully!`, {
      status: 201,
    });
  } catch (error) {
    return handleApiError("Create table failed!", error);
  }
};
