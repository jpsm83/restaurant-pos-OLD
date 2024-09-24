import { Types } from "mongoose";
import { NextResponse } from "next/server";

//imported utils
import connectDb from "@/app/lib/utils/connectDb";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";
import { handleApiError } from "@/app/lib/utils/handleApiError";

// imported models
import Printer from "@/app/lib/models/printer";

// imported interfaces
import { IConfigurationSetupToPrintOrders } from "@/app/lib/interface/IPrinter";

// this route will edit individual configurationSetupToPrintOrders references from the printer
// @desc    Delete sales location
// @route   PATCH /printers/:printerId/editConfigurationSetupFromPrinter/:configurationSetupToPrintOrdersId
// @access  Private
export const PATCH = async (
  req: Request,
  context: {
    params: {
      printerId: Types.ObjectId;
      configurationSetupToPrintOrdersId: Types.ObjectId;
    };
  }
) => {
  try {
    const { printerId, configurationSetupToPrintOrdersId } = context.params;
    const {
      businessSalesLocationReferenceIds,
      excludeUserIds,
      mainCategory,
      subCategories,
    } = (await req.json()) as IConfigurationSetupToPrintOrders;

    // Validate input
    if (
      isObjectIdValid([printerId, configurationSetupToPrintOrdersId]) !== true
    ) {
      return new NextResponse(
        JSON.stringify({
          message: "Invalid printerId or configurationSetupToPrintOrdersId!",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // check businessSalesLocationReferenceIds is a valid array of ObjectIds and mainCategory is not empty
    if (
      !businessSalesLocationReferenceIds ||
      businessSalesLocationReferenceIds.length === 0 ||
      !Array.isArray(businessSalesLocationReferenceIds) ||
      isObjectIdValid(businessSalesLocationReferenceIds) !== true ||
      !mainCategory
    ) {
      return new NextResponse(
        JSON.stringify({
          message:
            "businessSalesLocationReferenceIds is required and must be an array of ObjectIds!",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // if excludeUserIds is provided, check if it is a valid array of ObjectIds
    if (excludeUserIds) {
      if (
        !Array.isArray(excludeUserIds) ||
        excludeUserIds.length === 0 ||
        isObjectIdValid(excludeUserIds) !== true
      ) {
        return new NextResponse(
          JSON.stringify({
            message: "excludeUserIds must be an array of ObjectIds!",
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    // if subCategories is provided, check if it is an array of strings
    if (subCategories) {
      if (!Array.isArray(subCategories)) {
        return new NextResponse(
          JSON.stringify({
            message: "subCategories must be an array of strings!",
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    // Connect to the database
    await connectDb();

    // Check if the combination of mainCategory and any of the subCategories already exists
    const existingCombination = await Printer.findOne({
      _id: printerId,
      configurationSetupToPrintOrders: {
        $elemMatch: {
          _id: { $ne: configurationSetupToPrintOrdersId }, // Exclude current configurationSetupToPrintOrdersId
          mainCategory,
          $or: [
            { subCategories: { $exists: false } },
            { subCategories: { $size: 0 } },
            { subCategories: { $in: subCategories } },
          ],
        },
      },
    }).lean();

    if (existingCombination) {
      return new NextResponse(
        JSON.stringify({
          message:
            "A combination of these mainCategory and subCategories already exists!",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Proceed with updating the salesLocation's printFor entry
    const updatedPrinter = await Printer.findOneAndUpdate(
      {
        _id: printerId,
        "configurationSetupToPrintOrders._id":
          configurationSetupToPrintOrdersId,
      },
      {
        $set: {
          "configurationSetupToPrintOrders.$.businessSalesLocationReferenceIds":
            businessSalesLocationReferenceIds, // Update businessSalesLocationReferenceIds
          "configurationSetupToPrintOrders.$.excludeUserIds": excludeUserIds, // Update excludeUserIds
          "configurationSetupToPrintOrders.$.mainCategory": mainCategory, // Update mainCategories
          "configurationSetupToPrintOrders.$.subCategories": subCategories
            ? subCategories
            : [], // Update subCategories
        },
      },
      {
        new: true,
        lean: true,
      }
    );

    if (!updatedPrinter) {
      return new NextResponse(
        JSON.stringify({
          message: "Printer or configuration setup to print orders not found!",
        }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    return new NextResponse(
      JSON.stringify({
        message: "Configuration setup to print orders updated successfully",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return handleApiError(
      "Update configuration setup to print orders failed!",
      error
    );
  }
};
