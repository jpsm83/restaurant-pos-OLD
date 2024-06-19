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

// @desc    Get all tables
// @route   GET /tables
// @access  Private
export const GET = async () => {
  try {
    // connect before first call to DB
    await connectDB();

    const tables = await Table.find()
      .populate("openedBy", "username currentShiftRole")
      .populate("responsibleBy", "username currentShiftRole")
      .populate("closedBy", "username currentShiftRole")
      .populate({
        path: "orders",
        select:
          "billingStatus orderStatus orderPrice orderNetPrice paymentMethod allergens promotionApplyed discountPercentage createdAt",
        populate: {
          path: "businessGoods",
          select: "name category subCategory allergens sellingPrice",
        },
      })
      .lean();

    return !tables?.length
      ? new NextResponse(JSON.stringify({ message: "No tables found!" }), {
          status: 404,
        })
      : new NextResponse(JSON.stringify(tables), { status: 200 });
  } catch (error: any) {
    return new NextResponse("Error: " + error, { status: 500 });
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
    } = req.body as unknown as ITable;

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
        JSON.stringify({
          message:
            "TableReference, guest, status, openedBy, responsibleBy and business are required!",
        }),
        { status: 400 }
      );
    }

    // connect before first call to DB
    await connectDB();

    // check if tableReference exists in the business
    const validateTableReference = await Business.findOne({
      _id: business,
      businessTables: { $in: [tableReference] },
    });

    // check if tableReference exists in the business (pre set tables that can be used)
    if (!validateTableReference) {
      return new NextResponse(
        JSON.stringify({
          message: "TableReference does not exist in this business!",
        }),
        { status: 400 }
      );
    }

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

    // create a tables object with required fields
    const tableObj = {
      dayReferenceNumber: dayReferenceNumber,
      tableReference,
      guests,
      status,
      openedBy,
      responsibleBy,
      business,
      clientName: clientName || undefined,
    };

    // check if tables already exists and it is not closed
    const duplicateTable = await Table.findOne({
      dayReferenceNumber: tableObj.dayReferenceNumber,
      business,
      tableReference,
      status: { $ne: "Closed" },
    })
      .select("_id")
      .lean();

    if (duplicateTable) {
      return new NextResponse(
        JSON.stringify({
          message: `Table ${tableReference} already exists and it is not closed!`,
        }),
        { status: 409 }
      );
    }

    // check if user exists in the dailySalesReport
    const userDailySalesReport = await DailySalesReport.findOne({
      dayReferenceNumber: dayReferenceNumber,
      business,
      "userDailySalesReportArray.user": openedBy,
    }).lean();

    // if user does not exist in the dailySalesReport, create it
    if (!userDailySalesReport) {
      await addUserToDailySalesReport(
        openedBy,
        dayReferenceNumber as number,
        tableObj.business
      );
    }

    // create the table
    await Table.create(tableObj);

    return new NextResponse(
      JSON.stringify({
        message: `Table ${tableReference} created successfully!`,
      }),
      { status: 201 }
    );
  } catch (error: any) {
    return new NextResponse("Table creation failed - Error: " + error, {
      status: 500,
    });
  }
};
