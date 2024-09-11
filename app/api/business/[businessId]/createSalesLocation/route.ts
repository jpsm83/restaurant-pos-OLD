import { Types } from "mongoose";
import { NextResponse } from "next/server";

// imported utils
import connectDb from "@/app/lib/utils/connectDb";
import { generateQrCode } from "../../utils/generateQrCode";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";
import { handleApiError } from "@/app/lib/utils/handleApiError";

// imported interfaces
import {
  IBusiness,
  IBusinessSalesLocation,
} from "@/app/lib/interface/IBusiness";

// imported models
import Business from "@/app/lib/models/business";

// this route create a sales location for the business (ex: tables, counters, etc.)
// it will work "on click" of a button in the frontend
// it will create a sale location document with its qr code

// @desc    Create sales location
// @route   POST /business/:businessId/createSalesLocation
// @access  Private
export const POST = async (
  req: Request,
  context: {
    params: { businessId: Types.ObjectId };
  }
) => {
  try {
    const businessId = context.params.businessId;

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
          message: "Location reference name and type are required!",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // connect before first call to DB
    await connectDb();

    // get the sales location from business
    const business: IBusiness | null = await Business.findById(businessId)
      .select("salesLocation")
      .lean();

    // check if business exists
    if (!business) {
      return new NextResponse(
        JSON.stringify({ message: "Business not found!" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Check if the sales location already exists for the business
    const existingLocation = business?.salesLocation?.some(
      (location: IBusinessSalesLocation) =>
        location.locationReferenceName === locationReferenceName &&
        location.locationType === locationType
    );

    if (existingLocation) {
      return new NextResponse(
        JSON.stringify({ message: "Sales location already exists!" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Generate QR code
    const qrCode = await generateQrCode(businessId);

    // Add new sales location
    await Business.findByIdAndUpdate(
      businessId,
      {
        $push: {
          salesLocation: {
            locationReferenceName,
            locationType,
            selfOrdering,
            qrCode,
          },
        },
      },
      { new: true }
    );

    return new NextResponse(
      JSON.stringify({ message: "Sales location created" }),
      { status: 201, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return handleApiError("Sales location creation failed!", error);
  }
};
