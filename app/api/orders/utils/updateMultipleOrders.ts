import connectDB from "@/app/lib/db";
import Order from "@/app/lib/models/order";
import { Types } from "mongoose";

export const updateMultipleOrders = async (
  orderId: Types.ObjectId,
  update: any
) => {
  try {
    // check if orderId is valid
    if (!orderId || !Types.ObjectId.isValid(orderId)) {
      throw new Error("updateMultipleOrders Invalid orderId");
    }

    // connect before first call to DB
    await connectDB();

    return await Order.findOneAndUpdate({ _id: orderId }, update, {
      new: true,
    });
  } catch (error) {
    throw new Error("updateMultipleOrders function failed! Error: " + error);
  }
};
