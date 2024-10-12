import mongoose, { Types } from "mongoose";

// imported utils
import connectDb from "@/app/lib/utils/connectDb";
import { updateDynamicCountSupplierGood } from "../../inventories/utils/updateDynamicCountSupplierGood";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";

// imported interfaces
import { IOrder } from "@/app/lib/interface/IOrder";

// imported models
import Order from "@/app/lib/models/order";
import SalesInstance from "@/app/lib/models/salesInstance";

// order with status "Done" or "Dont Make" cannot be canceled
export const cancelOrder = async (orderId: Types.ObjectId) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    // validate userId
    if (isObjectIdValid([orderId]) !== true) {
      return "User ID is not valid!";
    }

    // connect before first call to DB
    await connectDb();

    // check if order exists and can be canceled
    const orderBusinessGoods: IOrder | null = await Order.findById(orderId)
      .select("businessGoodsIds salesInstanceId orderStatus")
      .lean();

    if (!orderBusinessGoods) {
      await session.abortTransaction();
      return "Order not found!";
    }

    const notAllowedToCancel = ["Done", "Dont Make"];
    if (notAllowedToCancel.includes(orderBusinessGoods?.orderStatus ?? "")) {
      await session.abortTransaction();
      return "Order cannot be canceled because its has been done!";
    }

    const updateDynamicCountSupplierGoodResult =
      await updateDynamicCountSupplierGood(
        orderBusinessGoods.businessGoodsIds,
        "remove"
      );

    if (updateDynamicCountSupplierGoodResult !== true) {
      await session.abortTransaction();
      return (
        "updateDynamicCountSupplierGood error: " +
        updateDynamicCountSupplierGoodResult
      );
    }

    await SalesInstance.findOneAndUpdate(
      { _id: orderBusinessGoods.salesInstanceId },
      { $pull: { "salesGroup.ordersIds": orderId } },
      { new: true, session }
    );

    const deleteResult = await Order.deleteOne({ _id: orderId }).session(
      session
    );

    if (deleteResult.deletedCount === 0) {
      await session.abortTransaction();
      return "Cancel order failed, order not deleted!";
    }

    await session.commitTransaction();

    return "Cancel order and update dynamic count success";
  } catch (error) {
    await session.abortTransaction();
    return "Cancel order and update dynamic count failed! " + error;
  } finally {
    session.endSession();
  }
};
