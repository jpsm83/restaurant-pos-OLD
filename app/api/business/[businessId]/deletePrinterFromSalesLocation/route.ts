import { IPrintFor } from "@/app/lib/interface/IBusiness";
import Business from "@/app/lib/models/business";
import connectDb from "@/app/lib/utils/connectDb";
import { handleApiError } from "@/app/lib/utils/handleApiError";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";
import { Types } from "mongoose";
import { NextResponse } from "next/server";

// @desc    Delete sales location
// @route   POST /business/:businessId/deleteSalesLocation/:salesLocationId/deletePrinterFromSalesLocation/:printForId
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

    // Connect to the database
    await connectDb();

    // Remove the specific printFor entry from the salesLocation's printFor array
    const updatedBusiness = await Business.findOneAndUpdate(
      {
        _id: businessId,
        "salesLocation._id": salesLocationId,
        "salesLocation.printFor._id": printForId,
      },
      {
        $pull: {
          "salesLocation.$.printFor": { _id: printForId },
        },
      },
      {
        new: true,
        lean: true,
      }
    );

    // If the business or sales location is not found, return an error
    if (!updatedBusiness) {
      return new NextResponse(
        JSON.stringify({ message: "Business or sales location not found!" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    return new NextResponse(
      JSON.stringify({ message: "PrintFor entry successfully deleted!" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return handleApiError("Delete printFor entry failed!", error);
  }
};
