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

// this route will add individual salesLocationAllowedToPrintOrder references to the printer
// @desc    Delete sales location
// @route   POST /printers/:printerId/addReferenceToPrinter
// @access  Private
export const POST = async (
  req: Request,
  context: {
    params: { printerId: Types.ObjectId };
  }
) => {
  try {
    const printerId = context.params.printerId;
    const {
      printFromSalesLocationReferenceIds,
      excludeUserIds,
      mainCategory,
      subCategories,
    } = (await req.json()) as ISalesLocationAllowedToPrintOrder;

    // validate printerId
    if (isObjectIdValid([printerId]) !== true) {
      return new NextResponse(JSON.stringify({ message: "Invalid printId!" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
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
        !Array.isArray(excludeUserIds) ||
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

    // connect before first call to DB
    await connectDb();

    // Check if the combination of mainCategory and any of the subCategories already exists
    const existingCombination = await Printer.findOne({
      _id: printerId,
      salesLocationAllowedToPrintOrder: {
        $elemMatch: {
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

    // Update the printer in a single query
    const updatedPrinter = await Printer.findOneAndUpdate(
      {
        _id: printerId,
      },
      {
        $push: {
          salesLocationAllowedToPrintOrder: {
            printFromSalesLocationReferenceIds,
            excludeUserIds,
            mainCategory,
            subCategories,
          },
        },
      },
      { new: true, lean: true }
    );

    if (!updatedPrinter) {
      return new NextResponse(
        JSON.stringify({
          message: "PrinterId not found!",
        }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    return new NextResponse(
      JSON.stringify({
        message: "Sales location allowed add to printer successfully",
      }),
      {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return handleApiError("Sales location creation failed!", error);
  }
};
