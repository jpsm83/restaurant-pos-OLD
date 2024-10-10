import { Types } from "mongoose";
import { updateDynamicCountSupplierGood } from "../../inventories/utils/updateDynamicCountSupplierGood";
import Order from "@/app/lib/models/order";
import { IOrder } from "@/app/lib/interface/IOrder";
import Table from "@/app/lib/models/salesInstance";
import connectDb from "@/app/lib/utils/connectDb";

// order with status "Started", "Done", "Dont Make" and "Started Hold" cannot be canceled
export const cancelOrder = async (
  orderId: Types.ObjectId
) => {
  try {
    // validate orderId
    if (!orderId || !Types.ObjectId.isValid(orderId)) {
      return "Invalid orderId!";
    }

        // connect before first call to DB
        await connectDb();

        // check if order exists and can be canceled
    const orderBusinessGoods: IOrder | null = await Order.findById(orderId)
      .select("businessGoods table orderStatus")
      .lean();
    if (!orderBusinessGoods) {
      return "Order not found!";
    }
    const notAllowedToCancel = ["Started", "Done", "Dont Make", "Started Hold"];
    if (notAllowedToCancel.includes(orderBusinessGoods?.orderStatus ?? "")) {
      return "Order cannot be canceled because its been started or done!";
    }

    const updateDynamicCountSupplierGoodResult =
      await updateDynamicCountSupplierGood(
        orderBusinessGoods.businessGoods,
        "remove"
      );

      if(updateDynamicCountSupplierGoodResult !== true) {
        return "updateDynamicCountSupplierGood! " + updateDynamicCountSupplierGoodResult
      }

      await Table.findOneAndUpdate(
        { _id: orderBusinessGoods.table },
        { $pull: { orders: orderId } },
        { new: true } // Now this option is valid and will return the updated document
      );

    await Order.deleteOne({ _id: orderId });

    return "Cancel order and update dynamic count success";
  } catch (error) {
    return "Cancel order and update dynamic count failed! " + error;
  }
};
