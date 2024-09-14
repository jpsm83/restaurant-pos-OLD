import { Types } from "mongoose";
import { NextResponse } from "next/server";

// imported utils
import connectDb from "@/app/lib/utils/connectDb";
import { handleApiError } from "@/app/lib/utils/handleApiError";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";

// imported models
import Business from "@/app/lib/models/business";
import deleteCloudinaryImage from "@/app/api/cloudinaryActions/utils/deleteCloudinaryImage";

// @desc    Delete sales location
// @route   PATCH /business/:businessId/deleteSalesLocationReference/:salesLocationReferenceId
// @access  Private
export const PATCH = async (
  req: Request,
  context: {
    params: { businessId: Types.ObjectId; salesLocationReferenceId: Types.ObjectId };
  }
) => {
  try {
    const { businessId, salesLocationReferenceId } = context.params;

    // validate businessId and salesLocationReferenceId
    if (
      !businessId ||
      !salesLocationReferenceId ||
      isObjectIdValid([businessId, salesLocationReferenceId]) !== true
    ) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid businessId or salesLocationReferenceId!" }),
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
      { _id: businessId, "salesLocation._id": salesLocationReferenceId },
      { "salesLocation.$": 1 } // Only return the matching sales location
    );

    if (!business || !business.salesLocation.length) {
      return new NextResponse(
        JSON.stringify({ message: "Business or sales location not found!" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // example of a cloudinary image url
    // "https://console.cloudinary.com/pm/c-9e91323343059685f5636d90d4b413/media-explorer/restaurant-pos/66cad982bb87c1faf53fb031/salesLocationQrCodes/66c9d6afc45a1547f9ab893b.png"
    const qrCode = business.salesLocation[0].qrCode;

    // delete location from salesLocation array
    await Business.updateOne(
      {
        _id: businessId,
      },
      {
        $pull: {
          salesLocation: {
            _id: salesLocationReferenceId,
          },
        },
      }
    );

    const deleteCloudinaryImageResult = await deleteCloudinaryImage(qrCode);

    if (deleteCloudinaryImageResult !== true) {
      return new NextResponse(
        JSON.stringify({ message: deleteCloudinaryImageResult }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    return new NextResponse(
      JSON.stringify({
        message: "Sales location deleted successfully",
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
