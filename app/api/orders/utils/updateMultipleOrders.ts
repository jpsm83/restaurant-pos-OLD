import connectDB from "@/app/lib/db";
import { Types } from "mongoose";
import { NextResponse } from "next/server";

export const updateMultipleOrders = async (
    orderId: Types.ObjectId,
    update: any
  ) => {
    try {
      // connect before first call to DB
      await connectDB();
  
      // check if orderId is valid
      if (!orderId || !Types.ObjectId.isValid(orderId)) {
        return new NextResponse(JSON.stringify({ message: "Invalid orderId" }), {
          status: 400,
        });
      }
  
      return await Order.findOneAndUpdate({ _id: orderId }, update, {
        new: true,
        useFindAndModify: false,
      });
    } catch (error: any) {
      return new NextResponse("Error: " + error, { status: 500 });
    }
  };
  