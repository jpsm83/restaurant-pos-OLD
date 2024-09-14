import { Types } from "mongoose";
import { NextResponse } from "next/server";

// imported utils
import connectDb from "@/app/lib/utils/connectDb";
import { handleApiError } from "@/app/lib/utils/handleApiError";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";

// imported models
import Printer from "@/app/lib/models/printer";
import User from "@/app/lib/models/user";
import Business from "@/app/lib/models/business";

// @desc    Get printers by businessId ID
// @route   GET /printers/businessId/:businessId
// @access  Private
export const GET = async (
  req: Request,
  context: {
    params: { businessId: Types.ObjectId };
  }
) => {
  try {
    const businessId = context.params.businessId;

    // check if businessId is valid
    if (isObjectIdValid([businessId]) !== true) {
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

    // fetch printers with the given businessId ID
    const printers = await Printer.find({ businessId: businessId })
      .populate({
        path: "usersAllowedToPrintDataIds",
        select: "username",
        model: User,
      })
      .populate({
        path: "salesLocationAllowedToPrintOrder.printFromSalesLocationReferenceIds",
        select: "salesLocation",
        model: Business,
      })
      .lean();

    return !printers.length
      ? new NextResponse(JSON.stringify({ message: "No printers found!" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        })
      : new NextResponse(JSON.stringify(printers), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        });
  } catch (error) {
    return handleApiError("Get printers by businessId id failed!", error);
  }
};
