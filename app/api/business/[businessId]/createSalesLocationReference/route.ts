import { Types } from "mongoose";
import { NextResponse } from "next/server";

// imported utils
import connectDb from "@/app/lib/utils/connectDb";
import { generateQrCode } from "../../utils/generateQrCode";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";
import { handleApiError } from "@/app/lib/utils/handleApiError";

// imported interfaces
import { IBusinessSalesLocation } from "@/app/lib/interface/IBusiness";

// imported models
import Business from "@/app/lib/models/business";

// this route create a sales location for the business (ex: tables, counters, etc.)
// it will work "on click" of a button in the frontend
// it will create a sale location document with its qr code

// @desc    Create sales location
// @route   POST /business/:businessId/createSalesLocationReference
// @access  Private
export const POST = async (
  req: Request,
  context: {
    params: { businessId: Types.ObjectId };
  }
) => {
  try {
    const { businessId } = context.params;

    const { locationReferenceName, locationType, selfOrdering } =
      (await req.json()) as IBusinessSalesLocation;

    // validate businessId
    if (!businessId || isObjectIdValid([businessId]) !== true) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid businessId!" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // validate required fields
    if (!locationReferenceName || !locationType) {
      return new NextResponse(
        JSON.stringify({
          message: "LocationReferenceName and locationType are required!",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // connect before first call to DB
    await connectDb();

    // Attempt to add sales location in a single query
    const updatedBusiness = await Business.findOneAndUpdate(
      {
        _id: businessId,
        // Only prevent the update if both locationReferenceName and locationType already exist together
        businessSalesLocation: {
          $not: {
            $elemMatch: {
              locationReferenceName,
              locationType,
            },
          },
        },
      },
      {
        $push: {
          businessSalesLocation: {
            locationReferenceName,
            locationType,
            selfOrdering,
          },
        },
      },
      { new: true, fields: { businessSalesLocation: 1 } } // Return updated businessSalesLocation
    );

    // Check if the update was successful
    if (!updatedBusiness) {
      return NextResponse.json(
        { message: "Sales location already exists or business not found!" },
        { status: 400 }
      );
    }

    // Generate QR code after successful update
    const qrCode = await generateQrCode(businessId);
    if (!qrCode || qrCode.includes("Failed")) {
      // if QR code generation fails, remove the newly created sales location
      await Business.findOneAndUpdate(
        { _id: businessId },
        {
          $pull: {
            businessSalesLocation: { locationReferenceName, locationType },
          },
        }
      );
      return NextResponse.json(
        { message: "Failed to generate QR code, rollback applied" },
        { status: 500 }
      );
    }

    // Update the new sales location with the QR code
    await Business.updateOne(
      {
        _id: businessId,
        "businessSalesLocation.locationReferenceName": locationReferenceName,
        "businessSalesLocation.locationType": locationType,
      },
      { $set: { "businessSalesLocation.$.qrCode": qrCode } }
    );

    return NextResponse.json(
      { message: "Sales location created" },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError("Sales location creation failed!", error);
  }
};
