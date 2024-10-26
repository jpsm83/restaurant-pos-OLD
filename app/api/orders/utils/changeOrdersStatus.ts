import mongoose, { Types } from "mongoose";

// imported utils
import connectDb from "@/app/lib/utils/connectDb";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";

// imported models
import Order from "@/app/lib/models/order";

// order can be change to "Done", "Sent" or "Delivered"
// kitchen staff set order to "Done"
// Floor staff set order to "Sent" after holding it
// Floor staff set order to "Delivered" after order is delivered (if delivery is enabled)
// ******** NOT USED ANYWHERE YET ********
export const changeOrdersStatus = async (
  orderIdsArr: Types.ObjectId[],
  newStatus: string
) => {
  // validate orderIdsArr
  if (isObjectIdValid(orderIdsArr) !== true) {
    return "OrderIdsArr not valid!";
  }

  // validate required fields
  if (!newStatus) {
    return "New status is required!";
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
      .select("orderStatus")
      .lean()
      .session(session);

    if (!orders || orders.length === 0) {
      await session.abortTransaction();
      return "Some orders were not found!";
    }

    // check if orders can be changed to new status
    const notAllowedToChange = ["Delivered"];

    // *** the status "Dont Make" should never be changed ***
    switch (newStatus) {
      case "Done":
        notAllowedToChange.push("Done", "Hold");
        break;
      case "Sent":
        notAllowedToChange.push("Done", "Sent");
        break;
      case "Delivered":
        notAllowedToChange.push("Sent", "Hold");
        break;
      default:
        break;
    }

    if (
      orders.some((order) =>
        notAllowedToChange.includes(order.orderStatus ?? "")
      )
    ) {
      await session.abortTransaction();
      return "Some of orders status cannot be replaced by new status, check notAllowedToChange!";
    }

    // Update order status in bulk, excluding "Dont Make"
    const updatedOrder = await Order.updateMany(
      { _id: { $in: orderIdsArr }, orderStatus: { $ne: "Dont Make" } },
      { $set: { orderStatus: newStatus } },
      { session }
    );

    if (updatedOrder.modifiedCount === 0) {
      await session.abortTransaction();
      return "No orders were updated!";
    }

    // Commit transaction
    await session.commitTransaction();

    return "Change orders status successful!";
  } catch (error) {
    await session.abortTransaction();
    return "Change orders status failed! " + error;
  } finally {
    session.endSession();
  }
};
