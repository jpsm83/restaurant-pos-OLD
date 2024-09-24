import { NextResponse } from "next/server";

// imported interfaces
import { IPrinter } from "@/app/lib/interface/IPrinter";

// imported utils
import connectDb from "@/app/lib/utils/connectDb";
import { checkPrinterConnection } from "./utils/checkPrinterConnection";
import { handleApiError } from "@/app/lib/utils/handleApiError";

// import user model
import User from "@/app/lib/models/user";
import Printer from "@/app/lib/models/printer";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";

// @desc    Get all printers
// @route   GET /printers
// @access  Private
export const GET = async (req: Request) => {
  try {
    // connect before first call to DB
    await connectDb();

    const printers = await Printer.aggregate([
  // Step 1: Unwind configurationSetupToPrintOrders array with 'preserveNullAndEmptyArrays'
  { 
    $unwind: {
      path: "$configurationSetupToPrintOrders",
      preserveNullAndEmptyArrays: true,
    }
  },
  // Step 2: Unwind businessSalesLocationReferenceIds array with 'preserveNullAndEmptyArrays'
  {
    $unwind: {
      path: "$configurationSetupToPrintOrders.businessSalesLocationReferenceIds",
      preserveNullAndEmptyArrays: true,
    },
  },
  // Step 3: Lookup to fetch Business based on businessSalesLocationReferenceIds
  {
    $lookup: {
      from: "businesses", // The Business collection
      let: {
        businessId: "$businessId",
        locationId: "$configurationSetupToPrintOrders.businessSalesLocationReferenceIds",
      },
      pipeline: [
        { $match: { $expr: { $eq: ["$_id", "$$businessId"] } } }, // Match the correct business by its ID
        { $unwind: "$businessSalesLocation" }, // Unwind the businessSalesLocation array
        {
          $match: {
            $expr: { $eq: ["$businessSalesLocation._id", "$$locationId"] },
          },
        }, // Match businessSalesLocation with the reference IDs
        {
          $project: {
            "businessSalesLocation.locationReferenceName": 1, // Adjust based on the fields you need
          },
        },
      ],
      as: "businessSalesLocationReferenceData",
    },
  },
  // Step 4: Lookup to fetch Users based on excludeUserIds, handling missing excludeUserIds
  {
    $lookup: {
      from: "users", // The User collection
      let: {
        excludeUsers: { $ifNull: ["$configurationSetupToPrintOrders.excludeUserIds", []] }, // If excludeUserIds is null, default to an empty array
      },
      pipeline: [
        { $match: { $expr: { $in: ["$_id", "$$excludeUsers"] } } }, // Match the correct users based on excludeUserIds
        {
          $project: {
            username: 1, // Return the username field
          },
        },
      ],
      as: "excludedUsers", // Alias to hold the populated excludeUserIds data
    },
  },
  // Step 5: Group data back into printer level with configuration and excluded users
  {
    $group: {
      _id: "$_id",
      printerAlias: { $first: "$printerAlias" },
      description: { $first: "$description" },
      printerStatus: { $first: "$printerStatus" },
      ipAddress: { $first: "$ipAddress" },
      port: { $first: "$port" },
      businessId: { $first: "$businessId" },
      backupPrinterId: { $first: "$backupPrinterId" },
      usersAllowedToPrintDataIds: { $first: "$usersAllowedToPrintDataIds" },
      configurationSetupToPrintOrders: {
        $push: {
          businessSalesLocationReferenceIds:
            "$configurationSetupToPrintOrders.businessSalesLocationReferenceIds",
          businessSalesLocationReferenceData:
            "$businessSalesLocationReferenceData",
          mainCategory: "$configurationSetupToPrintOrders.mainCategory",
          subCategories: "$configurationSetupToPrintOrders.subCategories",
          excludedUsers: "$excludedUsers", // Include the populated excluded users here
        },
      },
    },
  },
]);
    
    // Step 6: Populate the user-related fields and order details
    await Printer.populate(printers, [
      {
        path: "backupPrinterId",
        select: "printerAlias",
        model: Printer,
      },
      {
        path: "usersAllowedToPrintDataIds",
        select: "username",
        model: User,
      },
    ]);

    return !printers.length
      ? new NextResponse(JSON.stringify({ message: "No printers found!" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        })
      : new NextResponse(JSON.stringify(printers), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        });
  } catch (error) {
    return handleApiError("Get all printers failed!", error);
  }
};

// printer is created without any definition of what or where it will be printed and also without any user allowed to print data
// all those properties will be add on update routes for the printer
// @desc    Create new printer
// @desc    POST /businessId
// @access  Private
export const POST = async (req: Request) => {
  try {
    const {
      printerAlias,
      description,
      ipAddress,
      port,
      businessId,
      backupPrinterId,
      usersAllowedToPrintDataIds,
    } = (await req.json()) as IPrinter;

    // check required fields
    if (!printerAlias || !ipAddress || !port || !businessId) {
      return new NextResponse(
        JSON.stringify({
          message:
            "PrinterAlias, ipAddress, port and businessId are required fields!",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // validate businessId
    if (isObjectIdValid([businessId]) !== true) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid businessId!" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // validate backupPrinterId if it exists
    if (backupPrinterId) {
      if (isObjectIdValid([backupPrinterId]) !== true) {
        return new NextResponse(
          JSON.stringify({ message: "Invalid backupPrinterId!" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    // validate usersAllowedToPrintDataIds if it exists
    if (usersAllowedToPrintDataIds) {
      if (
        !Array.isArray(usersAllowedToPrintDataIds) ||
        isObjectIdValid(usersAllowedToPrintDataIds) !== true
      ) {
        return new NextResponse(
          JSON.stringify({
            message:
              "UsersAllowedToPrintDataIds have to be an array of valid Ids!",
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // connect before first call to DB
    await connectDb();

    //check duplicate printer
    const duplicatePrinter = await Printer.findOne({
      businessId,
      $or: [{ printerAlias }, { ipAddress }],
    });

    if (duplicatePrinter) {
      return new NextResponse(
        JSON.stringify({
          message: `Printer already exists with printerAlias or ipAddress!`,
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // printerStatus is auto check on the backend
    const isOnline = (await checkPrinterConnection(ipAddress, port)) as boolean;

    // create printer object with required fields
    const newPrinter = {
      printerAlias,
      description: description || null,
      printerStatus: isOnline ? "Online" : "Offline",
      ipAddress,
      port,
      businessId,
      backupPrinterId: backupPrinterId || null,
      usersAllowedToPrintDataIds: usersAllowedToPrintDataIds || [],
    };

    // create a new printer
    await Printer.create(newPrinter);

    // confirm printer was created
    return new NextResponse(
      JSON.stringify({
        message: `Printer ${printerAlias} created successfully`,
      }),
      {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return handleApiError("Create printer failed!", error);
  }
};
