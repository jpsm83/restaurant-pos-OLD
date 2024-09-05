import connectDb from "@/app/lib/utils/connectDb";
import { Types } from "mongoose";
import { NextResponse } from "next/server";

// imported utils
import { handleApiError } from "@/app/lib/utils/handleApiError";

// imported models
import Printer from "@/app/lib/models/printer";
import User from "@/app/lib/models/user";

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
    await connectDb();

    // fetch printers with the given business ID
    const printers = await Printer.find({ business: businessId })
    .populate({ path: "printFor.users", select: "username", model: User })
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
