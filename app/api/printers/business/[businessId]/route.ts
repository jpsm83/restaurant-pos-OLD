import { Types } from "mongoose";
import { NextResponse } from "next/server";

// imported utils
import connectDb from "@/app/lib/utils/connectDb";
import { handleApiError } from "@/app/lib/utils/handleApiError";

// imported models
import Printer from "@/app/lib/models/printer";
import User from "@/app/lib/models/user";

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

    // fetch printers with the given businessId ID
    const printers = await Printer.find({ businessId: businessId })
    .populate({ path: "printFor.usersId", select: "username", model: User })
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
