import connectDB from "@/app/lib/db";
import { Types } from "mongoose";
import { NextResponse } from "next/server";

// imported models
import Printer from "@/app/lib/models/printer";

// @desc    Get printers by business ID
// @route   GET /printers/business/:businessId
// @access  Private
export const GET = async (context: { params: any }) => {
  try {
    const businessId = context.params.businessId;
    // check if businessId is valid
    if (!businessId || !Types.ObjectId.isValid(businessId)) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid businessId" }),
        {
          status: 400,
        }
      );
    }

    // connect before first call to DB
    await connectDB();

    // fetch printers with the given business ID
    const printers = await Printer.find({ business: businessId })
      .populate("printFor.user", "username")
      .lean();

    return !printers.length
      ? new NextResponse(JSON.stringify({ message: "No printers found!" }), {
          status: 404,
        })
      : new NextResponse(JSON.stringify(printers), { status: 200 });
  } catch (error: any) {
    return new NextResponse("Error: " + error, { status: 500 });
  }
};
