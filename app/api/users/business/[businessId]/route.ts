import connectDB from "@/app/lib/db";
import { NextResponse } from "next/server";

// imported models
import User from "@/app/lib/models/user";
import { Types } from "mongoose";
import { handleApiError } from "@/app/utils/handleApiError";

// @desc   Get user by bussiness ID
// @route  GET /users/business/:businessId
// @access Private
export const GET = async (
  req: Request,
  context: {
    params: { businessId: Types.ObjectId };
  }
) => {
  try {
    const businessId = context.params.businessId;

    if (!businessId || !Types.ObjectId.isValid(businessId)) {
      return new NextResponse("Invalid business ID!", {
        status: 400,
      });
    }

    // connect before first call to DB
    await connectDB();

    const users = await User.find({ business: businessId })
      .select("-password")
      .lean();

    return !users.length
      ? new NextResponse("No users found within the business id!", {
          status: 404,
        })
      : new NextResponse(JSON.stringify(users), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        });
  } catch (error) {
    return handleApiError("Get users by business id failed!", error);
  }
};
