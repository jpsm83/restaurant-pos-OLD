import connectDb from "@/app/lib/utils/connectDb";
import mongoose, { Types } from "mongoose";
import { NextResponse } from "next/server";

// imported interfaces
import { IPrinter } from "@/app/lib/interface/IPrinter";

// imported utils
import { checkPrinterConnection } from "../utils/checkPrinterConnection";
import { handleApiError } from "@/app/lib/utils/handleApiError";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";

// imported models
import Printer from "@/app/lib/models/printer";
import User from "@/app/lib/models/user";

// @desc    Get printer by ID
// @route   GET /printers/:printerId
// @access  Private
export const GET = async (
  req: Request,
  context: { params: { printerId: Types.ObjectId } }
) => {
  try {
    const printerId = context.params.printerId;
    // check if printerId is valid
    if (isObjectIdValid([printerId]) !== true) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid printerId!" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
    // connect before first call to DB
    await connectDb();

    const printer = await Printer.aggregate([
      {
        $match: { _id: new mongoose.Types.ObjectId(printerId) }, // Ensure to convert the printerId to an ObjectId
      },
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

    // Step 7: Populate the user-related fields and order details
    await Printer.populate(printer, [
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

    return !printer
      ? new NextResponse(JSON.stringify({ message: "Printer not found!" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        })
      : new NextResponse(JSON.stringify(printer), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        });
  } catch (error) {
    return handleApiError("Get printer by its id failed!", error);
  }
};

// @desc    Update printer by ID
// @route   PATCH /printers/:printerId
// @access  Private
export const PATCH = async (
  req: Request,
  context: { params: { printerId: Types.ObjectId } }
) => {
  try {
    const printerId = context.params.printerId;

    const {
      printerAlias,
      description,
      ipAddress,
      port,
      backupPrinterId,
      usersAllowedToPrintDataIds,
    } = (await req.json()) as IPrinter;

    // check if printerId is valid
    if (isObjectIdValid([printerId]) !== true) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid printerId!" }),
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

    // fetch the printer with the given ID
    const printer: IPrinter | null = await Printer.findById(printerId)
      .select("businessId")
      .lean();
    if (!printer) {
      return new NextResponse(
        JSON.stringify({ message: "Printer not found!" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // combine duplicate printer check and usersAllowedToPrintDataIds check into a single query
    const conflictingPrinter: IPrinter | null = await Printer.findOne({
      _id: { $ne: printerId },
      businessId: printer.businessId,
      $or: [
        { printerAlias },
        { ipAddress },
        { usersAllowedToPrintDataIds: { $in: usersAllowedToPrintDataIds } },
      ],
    }).lean();

    if (conflictingPrinter) {
      const message =
        conflictingPrinter.printerAlias === printerAlias ||
        conflictingPrinter.ipAddress === ipAddress
          ? "Printer already exists!"
          : "UsersAllowedToPrintDataIds are already being used in some other printer!";
      return new NextResponse(JSON.stringify({ message }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // printerStatus is auto check on the backend
    const isOnline = (await checkPrinterConnection(ipAddress, port)) as boolean;

    // create updated printer object
    const updatePrinterObj: Partial<IPrinter> = {
      printerStatus: isOnline ? "Online" : "Offline",
    };

    // populate updated fields
    if (printerAlias) updatePrinterObj.printerAlias = printerAlias;
    if (description) updatePrinterObj.description = description;
    if (ipAddress) updatePrinterObj.ipAddress = ipAddress;
    if (port) updatePrinterObj.port = port;
    if (backupPrinterId) updatePrinterObj.backupPrinterId = backupPrinterId;
    if (usersAllowedToPrintDataIds)
      updatePrinterObj.usersAllowedToPrintDataIds = usersAllowedToPrintDataIds;

    // update the printer
    const updatedPrinter = await Printer.findByIdAndUpdate(
      printerId,
      { $set: updatePrinterObj },
      {
        new: true,
        lean: true,
      }
    );

    if (!updatedPrinter) {
      return new NextResponse(
        JSON.stringify({ message: "Printer not found!" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    return new NextResponse(
      JSON.stringify({
        message: "Printer updated successfully",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return handleApiError("Update printer failed!", error);
  }
};

// @desc    Delete printer by ID
// @route   DELETE /printers/:printerId
// @access  Private
export const DELETE = async (
  req: Request,
  context: { params: { printerId: Types.ObjectId } }
) => {
  try {
    const printerId = context.params.printerId;

    // check if printerId is valid
    if (isObjectIdValid([printerId]) !== true) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid printerId!" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // connect before first call to DB
    await connectDb();

    // delete printer and check if it existed
    const result = await Printer.deleteOne({ _id: printerId });

    if (result.deletedCount === 0) {
      return new NextResponse(
        JSON.stringify({ message: "Printer not found!" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // check if printer is a backup printer
    const isBackupPrinter = await Printer.exists({
      backupPrinterId: printerId,
    });

    if (isBackupPrinter) {
      await Printer.updateMany(
        {
          backupPrinterId: printerId,
        },
        {
          $unset: { backupPrinterId: "" },
        }
      );
    }

    return new NextResponse(
      JSON.stringify({ message: `Printer ${printerId} deleted!` }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return handleApiError("Delete printer failed!", error);
  }
};
