import { Types } from "mongoose";
import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";

// imported utils
import connectDb from "@/app/lib/utils/connectDb";
import { handleApiError } from "@/app/lib/utils/handleApiError";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";

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

    // validate businessId and salesLocationId
    if (
      !businessId ||
      !salesLocationId ||
      isObjectIdValid([businessId, salesLocationId]) !== true
    ) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid businessId or salesLocationId!" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // connect before first call to DB
    await connectDb();

    // Find the business and sales location
    const business = await Business.findOne(
      { _id: businessId, "salesLocation._id": salesLocationId },
      { "salesLocation.$": 1 } // Only return the matching sales location
    );

    if (!business || !business.salesLocation.length) {
      return new NextResponse(
        JSON.stringify({ message: "Business or sales location not found!" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
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
    // Extract the QR code public ID
    const qrCode = business.salesLocation[0].qrCode;
    const cloudinaryPublicIdMatch = qrCode.match(/restaurant-pos\/[^.]+/);
    const cloudinaryPublicId = cloudinaryPublicIdMatch
      ? cloudinaryPublicIdMatch[0]
      : "";

    if (cloudinaryPublicId) {
      await cloudinary.uploader.destroy(cloudinaryPublicId, {
        resource_type: "image",
      });
    }

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
