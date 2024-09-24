import mongoose, { Types } from "mongoose";
import { NextResponse } from "next/server";

// imported utils
import connectDb from "@/app/lib/utils/connectDb";
import { handleApiError } from "@/app/lib/utils/handleApiError";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";

// imported models
import Printer from "@/app/lib/models/printer";
import User from "@/app/lib/models/user";
import Business from "@/app/lib/models/business";

// @desc    Get printers by businessId ID
// @route   GET /printers/businessId/:businessId
// @access  Private
export const GET = async (
  req: Request,
  context: {
    params: { businessId: Types.ObjectId };
  }
) => {
  try {
    const businessId = context.params.businessId;

    // check if businessId is valid
    if (isObjectIdValid([businessId]) !== true) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid businessId!" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // connect before first call to DB
    await connectDb();

    // Step 1: Perform the aggregation for businessSalesLocation
    const printers = await Printer.aggregate([
      // Step 1: Match the specific printer by its ID
      {
        $match: { businessId: new mongoose.Types.ObjectId(businessId) }, // Ensure to convert the printerId to an ObjectId
      },
      // Step 2: Unwind configurationSetupToPrintOrders array
      { $unwind: "$configurationSetupToPrintOrders" },
      // Step 3: Unwind businessSalesLocationReferenceIds array
      {
        $unwind:
          "$configurationSetupToPrintOrders.businessSalesLocationReferenceIds",
      },
      // Step 4: Lookup to fetch Business based on businessSalesLocationReferenceIds
      {
        $lookup: {
          from: "businesses", // The Business collection
          let: {
            businessId: "$businessId",
            locationId:
              "$configurationSetupToPrintOrders.businessSalesLocationReferenceIds",
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
      // Step 5: Lookup to fetch Users based on excludeUserIds
      {
        $lookup: {
          from: "users", // The User collection
          let: {
            excludeUsers: "$configurationSetupToPrintOrders.excludeUserIds",
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
      // Step 6: Group data back into printer level with configuration and excluded users
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
    return handleApiError("Get printers by businessId id failed!", error);
  }
};
