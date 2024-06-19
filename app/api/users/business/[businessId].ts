import connectDB from "@/app/lib/db";
import { NextResponse } from "next/server";

// imported models
import User from "@/app/lib/models/user";
import { Types } from "mongoose";

// @desc   Get user by bussiness ID
// @route  GET /users/business/:businessId
// @access Private
export const GET = async (context: { params: any }) => {
  try {
    const businessId = context.params.businessId;
    // validate businessId
    if (!businessId || !Types.ObjectId.isValid(businessId)) {
      return new NextResponse(JSON.stringify({ message: "Invalid user ID" }), {
        status: 400,
      });
    }

    // connect before first call to DB
    await connectDB();

    const users = await User.find({ business: businessId })
      .select("-password")
      .lean();

    return !users.length
      ? new NextResponse(JSON.stringify({ message: "No users found" }), {
          status: 404,
        })
      : new NextResponse(JSON.stringify(users), { status: 200 });
  } catch (error: any) {
    return new NextResponse("Error: " + error, { status: 500 });
  }
};
