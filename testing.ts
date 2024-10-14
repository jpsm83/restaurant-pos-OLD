import mongoose from "mongoose";
import connectDb from "./app/lib/utils/connectDb";
import { NextResponse } from "next/server";
import { handleApiError } from "./app/lib/utils/handleApiError";

export const POST = async (req: Request) => {

  // start transaction
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // connect before first call to DB
    await connectDb();

    // Commit the transaction if both operations succeed
    await session.commitTransaction();

    // Return success response
    return new NextResponse(
      JSON.stringify({ message: "Purchase created and inventory updated" }),
      {
        status: 201,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    await session.abortTransaction();
    return handleApiError("Create new purchase failed!", error);
  } finally {
    session.endSession();
  }
};
