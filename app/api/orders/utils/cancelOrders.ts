import mongoose, { Types } from "mongoose";

// imported utils
import connectDb from "@/app/lib/utils/connectDb";
import { updateDynamicCountSupplierGood } from "../../inventories/utils/updateDynamicCountSupplierGood";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";

// imported models
import Order from "@/app/lib/models/order";
import SalesInstance from "@/app/lib/models/salesInstance";

// order with status "Done" or "Dont Make" cannot be canceled
// only manager can cancel orders that havent been done yet
// user on GET /orders/:orderId
export const cancelOrders = async (orderIdsArr: Types.ObjectId[]) => {
  // validate orderIdsArr
  if (isObjectIdValid(orderIdsArr) !== true) {
    return "OrderIdsArr not valid!";
  }

  // connect before first call to DB
  await connectDb();

  // Start a session to handle transactions
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Fetch all relevant orders at once using $in
    const orders = await Order.find({
      _id: { $in: orderIdsArr },
    })
      .select("businessGoodsIds salesInstanceId orderStatus")
      .lean()
      .session(session);

    if (!orders || orders.length === 0) {
      await session.abortTransaction();
      return "Some orders were not found!";
    }

    // Check if any of the orders are not allowed to be canceled
    const notAllowedToCancel = ["Done", "Dont Make"];

    if (
      orders.some((order) =>
        notAllowedToCancel.includes(order.orderStatus ?? "")
      )
    ) {
      await session.abortTransaction();
      return "Cannot cancel orders with status 'Done' or 'Dont Make'!";
    }

    // Bulk update dynamic count for all business goods
    const businessGoodsIds = orders
      .map((order) => order.businessGoodsIds)
      .flat();
    const updateDynamicCountSupplierGoodResult =
      await updateDynamicCountSupplierGood(businessGoodsIds, "remove");

    if (updateDynamicCountSupplierGoodResult !== true) {
      await session.abortTransaction();
      return (
        "updateDynamicCountSupplierGood error: " +
        updateDynamicCountSupplierGoodResult
      );
    }

    const [salesInstance1, salesInstance2, order] = await Promise.all([
      // Update sales instances in bulk
      SalesInstance.updateMany(
        {
          _id: orders[0].salesInstanceId,
          "salesGroup.ordersIds": { $in: orderIdsArr },
        },
        { $pull: { "salesGroup.$.ordersIds": { $in: orderIdsArr } } },
        { session }
      ),

      // Remove empty salesGroup objects
      SalesInstance.updateMany(
        { _id: orders[0].salesInstanceId },
        { $pull: { salesGroup: { ordersIds: { $size: 0 } } } },
        { session }
      ),

      // Delete orders in bulk
      Order.deleteMany({
        _id: { $in: orderIdsArr },
      }).session(session),
    ]);

    if (order.deletedCount !== orderIdsArr.length) {
      await session.abortTransaction();
      return "Cancel order failed, some orders were not deleted!";
    }

    // Commit transaction
    await session.commitTransaction();

    return "Cancel order and update dynamic count success";
  } catch (error) {
    await session.abortTransaction();
    return "Cancel order and update dynamic count failed! " + error;
  } finally {
    session.endSession();
  }
};
