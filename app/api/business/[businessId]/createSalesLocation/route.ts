import connectDb from "@/app/lib/utils/connectDb";
import { Types } from "mongoose";
import { NextResponse } from "next/server";

// imported utils
import { generateQrCode } from "../../utils/generateQrCode";

// imported interfaces
import { ISalesLocation } from "@/app/lib/interface/IBusiness";

// imported models
import Business from "@/app/lib/models/business";

// this route create a sales location for the business (ex: tables, counters, etc.)
// it will work "on click" of a button in the frontend
// it will create a table document with its qr code

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
    await connectDb();

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

    if (business.salesLocation && business.salesLocation.length > 0) {
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
