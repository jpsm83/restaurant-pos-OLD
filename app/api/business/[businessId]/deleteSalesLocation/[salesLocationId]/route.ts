import connectDB from "@/app/lib/db";
import Business from "@/app/lib/models/business";
import { Types } from "mongoose";
import { NextResponse } from "next/server";
import { deleteQrCode } from "../../../utils/deleteQrCode";
import { handleApiError } from "@/app/lib/utils/handleApiError";

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
    await connectDB();

    // check if business exists
    const business = await Business.findOne(
      {
        _id: businessId,
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

    // Extract cloudinaryPublicId using regex
    let cloudinaryPublicId = business.salesLocation[0].qrCode.match(
      /restaurant-pos\/[^.]+/
    );

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

    // delete qrCode from cloudinary
    await deleteQrCode(cloudinaryPublicId[0]);

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
