import connectDB from "@/app/lib/db";
import { ISalesLocation } from "@/app/lib/interface/IBusiness";
import Business from "@/app/lib/models/business";
import { Types } from "mongoose";
import { NextResponse } from "next/server";
import { generateQrCode } from "../../utils/generateQrCode";

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
      (await req.json()) as ISalesLocation;

    // validate businessId
    if (!businessId || !Types.ObjectId.isValid(businessId)) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid businessId!" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // connect before first call to DB
    await connectDB();

    // get the sales location from business
    const business = (await Business.findById(businessId)
      .select("salesLocation")
      .lean()) as { salesLocation: ISalesLocation[] };

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

    // check if the combination of locationReferenceName and locationType already exists
    const existingSalesLocation = business.salesLocation.some(
      (location: ISalesLocation) =>
        location.locationReferenceName === locationReferenceName &&
        location.locationType === locationType
    );

    if (existingSalesLocation) {
      return new NextResponse(
        JSON.stringify({ message: "Sales location already exists!" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const qrCode = await generateQrCode(businessId);

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
      JSON.stringify({ message: "Sales location created!" }),
      { status: 201, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new NextResponse(
      JSON.stringify({ message: "Sales location creation failed!" + error }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};
