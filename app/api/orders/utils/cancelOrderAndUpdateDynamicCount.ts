import { Types } from "mongoose";
import { updateDynamicCountSupplierGood } from "./updateDynamicCountSupplierGood";
import Order from "@/app/lib/models/order";
import { IOrder } from "@/app/lib/interface/IOrder";
import Table from "@/app/lib/models/table";

export const cancelOrderAndUpdateDynamicCount = async (
  orderId: Types.ObjectId
) => {
  try {
    // validate orderId
    if (!orderId || !Types.ObjectId.isValid(orderId)) {
      return "Invalid orderId!";
    }

    const orderBusinessGoods: IOrder | null = await Order.findById(orderId)
      .select("businessGoods table")
      .lean();
    if (!orderBusinessGoods) {
      return "Order not found!";
    }

    const updateDynamicCountSupplierGoodResult =
      await updateDynamicCountSupplierGood(
        orderBusinessGoods.businessGoods,
        "remove"
      );

    if (
      updateDynamicCountSupplierGoodResult ===
      "Dynamic count supplier good updated!"
    ) {
      await Table.updateOne(
        { _id: orderBusinessGoods.table },
        { $pull: { orders: orderId } }
      );
    }

    return "Cancel order and update dynamic count success!";
  } catch (error) {
    return "Cancel order and update dynamic count failed! " + error;
  }
};
