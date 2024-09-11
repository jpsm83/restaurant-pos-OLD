import connectDb from "@/app/lib/utils/connectDb";
import { NextResponse } from "next/server";
import { IDailySalesReport } from "@/app/lib/interface/IDailySalesReport";

// import utils
import { createDailySalesReport } from "../dailySalesReports/utils/createDailySalesReport";
import { handleApiError } from "@/app/lib/utils/handleApiError";
import { createTable } from "./utils/createTable";

// import models
import Table from "@/app/lib/models/salesLocation";
import DailySalesReport from "@/app/lib/models/dailySalesReport";
import User from "@/app/lib/models/user";
import BusinessGood from "@/app/lib/models/businessGood";
import Order from "@/app/lib/models/order";
import { ISalesLocation } from "@/app/lib/interface/ISalesLocation";

// @desc    Get all tables
// @route   GET /tables
// @access  Private
export const GET = async () => {
  try {
    // connect before first call to DB
    await connectDb();

    const tables = await Table.find()
      .populate({
        path: "openedBy",
        select: "username currentShiftRole",
        model: User,
      })
      .populate({
        path: "responsibleBy",
        select: "username currentShiftRole",
        model: User,
      })
      .populate({
        path: "closedBy",
        select: "username currentShiftRole",
        model: User,
      })
      .populate({
        path: "orders",
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

    return !tables?.length
      ? new NextResponse(JSON.stringify({ message: "No tables found!" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        })
      : new NextResponse(JSON.stringify(tables), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        });
  } catch (error) {
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
      salesLocationReference,
      guests,
      status,
      openedBy,
      responsibleBy,
      business,
      clientName,
    } = (await req.json()) as ISalesLocation;

    // check required fields
    if (
      !salesLocationReference ||
      !guests ||
      !status ||
      !openedBy ||
      !responsibleBy ||
      !business
    ) {
      return new NextResponse(
        JSON.stringify({
          message:
            "SalesLocationReference, guest, status, openedBy, responsibleBy and business are required!",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // connect before first call to DB
    await connectDb();

    // dailySalesReport is created when the first table is created
    const dailySalesReport: IDailySalesReport | null =
      await DailySalesReport.findOne({
        isDailyReportOpen: true,
        business,
      })
        .select("dailyReferenceNumber")
        .lean();

    const dailyReferenceNumber = dailySalesReport
      ? dailySalesReport.dailyReferenceNumber
      : await createDailySalesReport(business);

    // check if tables already exists and it is not closed
    const duplicateTable = await Table.findOne({
      dailyReferenceNumber: dailyReferenceNumber,
      business,
      salesLocationReference,
      status: { $ne: "Closed" },
    })
      .select("_id")
      .lean();

    if (duplicateTable) {
      return new NextResponse(
        JSON.stringify({
          message: `Table ${salesLocationReference} already exists and it is not closed!`,
        }),
        { status: 409, headers: { "Content-Type": "application/json" } }
      );
    }

    // we use a outside function to create the table because this function is used in other places
    // create new table
    await createTable(
      salesLocationReference,
      guests,
      openedBy,
      responsibleBy,
      business,
      clientName,
      dailyReferenceNumber as number
    );

    return new NextResponse(
      JSON.stringify({
        message: `Table ${salesLocationReference} created successfully!`,
      }),
      {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return handleApiError("Create table failed!", error);
  }
};

// export const POST = async (req: Request) => {
//   try {
//     const salesLocationReference = "business1table1";
//     const guests = 3;
//     const openedBy = "66758b8904c4e6f5bbaa6b81";
//     const responsibleBy = "66758b8904c4e6f5bbaa6b81";
//     const business = "6673fed98c45d0a0ca5f34c1";
//     const clientName = "clienteNameField";
//     const dailyReferenceNumber = 1720908000000;
//     const tableId = "6693eb1c0693ec3374a89b41";

//     const result = await createTable(
//       salesLocationReference,
//       guest,
//       openedBy,
//       responsibleBy,
//       business,
//       clientName,
//       dailyReferenceNumber
//     );

//     return new NextResponse(JSON.stringify(result), {
//       status: 201,
//       headers: { "Content-Type": "application/json" },
//     });
//   } catch (error) {
//     return handleApiError("Create table failed!", error);
//   }
// };
