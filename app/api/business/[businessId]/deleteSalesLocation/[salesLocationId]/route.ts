import connectDb from "@/app/lib/utils/connectDb";
import { Types } from "mongoose";
import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";

// imported utils
import { handleApiError } from "@/app/lib/utils/handleApiError";

// imported models
import Business from "@/app/lib/models/business";

// Cloudinary ENV variables
cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// @desc    Delete sales location
// @route   DELETE /business/:businessId/deleteSalesLocation/:salesLocationId
// @access  Private
export const DELETE = async (
  req: Request,
  context: {
    params: { businessId: Types.ObjectId; salesLocationId: Types.ObjectId };
  }
) => {
  try {
    const { businessId, salesLocationId } = context.params;

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

    // validate salesLocationId
    if (!salesLocationId || !Types.ObjectId.isValid(salesLocationId)) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid salesLocationId!" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // connect before first call to DB
    await connectDb();

    // check if business exists
    const business = await Business.findOne(
      {
        _id: businessId,
        "salesLocation._id": salesLocationId,
    },
    {
        salesLocation: { $elemMatch: { _id: salesLocationId } },
    }
);

    if (!business) {
      return new NextResponse(
        JSON.stringify({ message: "Sales location not found!" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // delete location from salesLocation array
    await Business.updateOne(
      {
        _id: businessId,
      },
      {
        $pull: {
          salesLocation: {
            _id: salesLocationId,
          },
        },
      }
    );

    // example of a cloudinary image url
    // "https://console.cloudinary.com/pm/c-9e91323343059685f5636d90d4b413/media-explorer/restaurant-pos/66cad982bb87c1faf53fb031/salesLocationQrCodes/66c9d6afc45a1547f9ab893b.png"

    // Extract cloudinaryPublicId using regex
    // example of a publicId
    // "restaurant-pos/6673fed98c45d0a0ca5f34c1/salesLocationQrCodes/66c9d6afc45a1547f9ab893b"
    let cloudinaryPublicId = business.salesLocation[0].qrCode.match(
      /restaurant-pos\/[^.]+/
    );

    await cloudinary.uploader.destroy(cloudinaryPublicId?.[0] ?? "", {
      resource_type: "image",
    });

    return new NextResponse(
      JSON.stringify({
        message: `Sales location ${business.salesLocation[0].locationReferenceName} deleted successfully`,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return handleApiError("Delete business failed!", error);
  }
};
