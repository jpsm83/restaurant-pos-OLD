import connectDB from "@/app/lib/db";
import { Types } from "mongoose";
import { NextResponse } from "next/server";

// imported models
import Printer from "@/app/lib/models/printer";
import { handleApiError } from "@/app/lib/utils/handleApiError";

// @desc    Get printers by business ID
// @route   GET /printers/business/:businessId
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

    // fetch printers with the given business ID
    const printers = await Printer.find({ business: businessId })
      // .populate("printFor.users", "username")
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
    return handleApiError("Get printers by business id failed!", error);
  }
};
