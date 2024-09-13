import { Types } from "mongoose";
import { NextResponse } from "next/server";
import connectDb from "@/app/lib/utils/connectDb";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";
import validateSalesLocationPrinter from "../../utils/validateSalesLocationPrinter";
import Business from "@/app/lib/models/business";
import { IPrintFor } from "@/app/lib/interface/IBusiness";
import { handleApiError } from "@/app/lib/utils/handleApiError";

// @desc    Delete sales location
// @route   POST /business/:businessId/deleteSalesLocation/:salesLocationId/editPrinterFromSalesLocation/:printForId
// @access  Private
export const POST = async (
  req: Request,
  context: {
    params: {
      businessId: Types.ObjectId;
      salesLocationId: Types.ObjectId;
      printForId: Types.ObjectId;
    };
  }
) => {
  try {
    const { businessId, salesLocationId, printForId } = context.params;
    const { mainCategory, subCategories, printerId } =
      (await req.json()) as IPrintFor;

    // Validate input
    if (
      !businessId ||
      !salesLocationId ||
      isObjectIdValid([businessId, salesLocationId, printForId]) !== true
    ) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid businessId or salesLocationId!" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Check required fields
    if (!mainCategory || !printerId) {
      return new NextResponse(
        JSON.stringify({
          message: "MainCategory and printerId are required!",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const printFor = {
      mainCategory: mainCategory,
      subCategories: subCategories || [],
      printerId: printerId,
    };

    // Validate the printFor object
    const validationError = validateSalesLocationPrinter(printFor);
    if (validationError !== true) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid businessId or salesLocationId!" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Connect to the database
    await connectDb();

    // Check if the combination of mainCategory and any of the subCategories already exists
    const existingCombination = await Business.findOne({
      _id: businessId,
      "salesLocation._id": { $ne: { salesLocationId } },
      "salesLocation.printFor": {
        $elemMatch: {
          mainCategory,
          subCategories: { $in: subCategories }, // Check if any subCategory matches
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
    const updatedBusiness = await Business.findOneAndUpdate(
      {
        _id: businessId,
        "salesLocation._id": salesLocationId,
        "salesLocation.printFor._id": printForId,
      },
      {
        $set: {
          "salesLocation.$.printFor.$[printForElem].mainCategories":
            printFor.mainCategory, // Update mainCategories
          "salesLocation.$.printFor.$[printForElem].subCategories":
            printFor.subCategories, // Update subCategories
          "salesLocation.$.printFor.$[printForElem].printerId":
            printFor.printerId, // Update printerId
        },
      },
      {
        arrayFilters: [{ "printForElem._id": printForId }], // Use the printForId to target the right entry
        new: true,
        lean: true,
      }
    );

    if (!updatedBusiness) {
      return new NextResponse(
        JSON.stringify({ message: "Business or sales location not found!" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    return new NextResponse(
      JSON.stringify({
        message: "Sales location printer updated successfully",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return handleApiError("Update sales location printer failed!", error);
  }
};
