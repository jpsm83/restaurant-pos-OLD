import { Types } from "mongoose";
import { NextResponse } from "next/server";

//imported utils
import connectDb from "@/app/lib/utils/connectDb";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";
import { handleApiError } from "@/app/lib/utils/handleApiError";

// imported models
import Printer from "@/app/lib/models/printer";

// imported interfaces
import { ISalesLocationAllowedToPrintOrder } from "@/app/lib/interface/IPrinter";

// this route will edit individual salesLocationAllowedToPrintOrder references from the printer
// @desc    Delete sales location
// @route   PATCH /printers/:printerId/editReferenceFromPrinter/:salesLocationAllowedToPrintOrderId
// @access  Private
export const PATCH = async (
  req: Request,
  context: {
    params: {
      printerId: Types.ObjectId;
      salesLocationAllowedToPrintOrderId: Types.ObjectId;
    };
  }
) => {
  try {
    const { printerId, salesLocationAllowedToPrintOrderId } = context.params;
    const {
      printFromSalesLocationReferenceIds,
      excludeUserIds,
      mainCategory,
      subCategories,
    } = (await req.json()) as ISalesLocationAllowedToPrintOrder;

    // Validate input
    if (
      isObjectIdValid([printerId, salesLocationAllowedToPrintOrderId]) !== true
    ) {
      return new NextResponse(
        JSON.stringify({
          message: "Invalid printerId or salesLocationAllowedToPrintOrderId!",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // check printFromSalesLocationReferenceIds is a valid array of ObjectIds and mainCategory is not empty
    if (
      !printFromSalesLocationReferenceIds ||
      !Array.isArray(printFromSalesLocationReferenceIds) ||
      isObjectIdValid(printFromSalesLocationReferenceIds) !== true ||
      !mainCategory
    ) {
      return new NextResponse(
        JSON.stringify({
          message:
            "printFromSalesLocationReferenceIds is required and must be an array of ObjectIds!",
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
        !Array.isArray(excludeUserIds) || excludeUserIds.length === 0 ||
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
      salesLocationAllowedToPrintOrder: {
        $elemMatch: {
          _id: { $ne: salesLocationAllowedToPrintOrderId }, // Exclude current salesLocationAllowedToPrintOrderId
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
        "salesLocationAllowedToPrintOrder._id":
          salesLocationAllowedToPrintOrderId,
      },
      {
        $set: {
          "salesLocationAllowedToPrintOrder.$.printFromSalesLocationReferenceIdss":
            printFromSalesLocationReferenceIds, // Update printFromSalesLocationReferenceIds
          "salesLocationAllowedToPrintOrder.$.excludeUserIds": excludeUserIds, // Update excludeUserIds
          "salesLocationAllowedToPrintOrder.$.mainCategories": mainCategory, // Update mainCategories
          "salesLocationAllowedToPrintOrder.$.subCategories": subCategories, // Update subCategories
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
          message:
            "Printer or sales location allowed to print order not found!",
        }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    return new NextResponse(
      JSON.stringify({
        message: "Sales location allowed to print order updated successfully",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return handleApiError(
      "Update sales location allowed to print order failed!",
      error
    );
  }
};
