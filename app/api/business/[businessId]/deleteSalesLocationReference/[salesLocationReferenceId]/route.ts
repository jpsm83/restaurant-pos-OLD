import { Types } from "mongoose";
import { NextResponse } from "next/server";

// imported utils
import connectDb from "@/app/lib/utils/connectDb";
import { handleApiError } from "@/app/lib/utils/handleApiError";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";

// imported models
import Business from "@/app/lib/models/business";
import deleteCloudinaryImage from "@/app/api/cloudinaryActions/utils/deleteCloudinaryImage";
import SalesLocation from "@/app/lib/models/salesLocation";

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
      { _id: businessId, "businessSalesLocation._id": salesLocationReferenceId },
      { "businessSalesLocation.$": 1 } // Only return the matching sales location
    );

    if (!business || !business.businessSalesLocation.length) {
      return new NextResponse(
        JSON.stringify({ message: "Business or sales location not found!" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // example of a cloudinary image url
    // "https://console.cloudinary.com/pm/c-9e91323343059685f5636d90d4b413/media-explorer/restaurant-pos/66cad982bb87c1faf53fb031/salesLocationQrCodes/66c9d6afc45a1547f9ab893b.png"
    const qrCode = business.businessSalesLocation[0].qrCode;

    // check if the business sales location has any relation with the created salesLocation
    if (await SalesLocation.exists({ salesLocationReferenceId: business.businessSalesLocation._id })) {
      return new NextResponse(
        JSON.stringify({ message: "Business sales location cannot be deleted because its ID is related with other models!" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // delete location from businessSalesLocation array
    await Business.updateOne(
      {
        _id: businessId,
      },
      {
        $pull: {
          businessSalesLocation: {
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
