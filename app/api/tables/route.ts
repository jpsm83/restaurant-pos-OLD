import connectDb from "@/app/lib/utils/connectDb";
import { NextResponse } from "next/server";
import { ITable } from "@/app/lib/interface/ITable";
import { IDailySalesReport } from "@/app/lib/interface/IDailySalesReport";

// import utils
import { createDailySalesReport } from "../dailySalesReports/utils/createDailySalesReport";
import { handleApiError } from "@/app/lib/utils/handleApiError";
import { createTable } from "./utils/createTable";

// import models
import Table from "@/app/lib/models/table";
import DailySalesReport from "@/app/lib/models/dailySalesReport";
import User from "@/app/lib/models/user";
import BusinessGood from "@/app/lib/models/businessGood";
import Order from "@/app/lib/models/order";

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
        JSON.stringify({
          message:
            "TableReference, guest, status, openedBy, responsibleBy and business are required!",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // connect before first call to DB
    await connectDb();

    // dailySalesReport is created when the first table is created
    const dailySalesReport: IDailySalesReport | null =
      await DailySalesReport.findOne({
        dailyReportOpen: true,
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
        JSON.stringify({
          message: `Table ${tableReference} already exists and it is not closed!`,
        }),
        { status: 409, headers: { "Content-Type": "application/json" } }
      );
    }

    // we use a outside function to create the table because this function is used in other places
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

    return new NextResponse(
      JSON.stringify({
        message: `Table ${tableReference} created successfully!`,
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
//     const tableReference = "business1table1";
//     const guests = 3;
//     const openedBy = "66758b8904c4e6f5bbaa6b81";
//     const responsibleBy = "66758b8904c4e6f5bbaa6b81";
//     const business = "6673fed98c45d0a0ca5f34c1";
//     const clientName = "clienteNameField";
//     const dayReferenceNumber = 1720908000000;
//     const tableId = "6693eb1c0693ec3374a89b41";

//     const result = await createTable(
//       tableReference,
//       guest,
//       openedBy,
//       responsibleBy,
//       business,
//       clientName,
//       dayReferenceNumber
//     );

//     return new NextResponse(JSON.stringify(result), {
//       status: 201,
//       headers: { "Content-Type": "application/json" },
//     });
//   } catch (error) {
//     return handleApiError("Create table failed!", error);
//   }
// };
