import mongoose, { Types } from "mongoose";

// imported utils
import connectDb from "@/app/lib/utils/connectDb";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";

// imported models
import Order from "@/app/lib/models/order";

// Void, Cancel and Invitation can be manually changed by managers
// Paid is automatically changed by the system
// Open is the default status
// ******** NOT USED ANYWHERE YET ********
export const changeOrdersBillingStatus = async (
  orderIdsArr: Types.ObjectId[],
  newBillingStatus: string
) => {
  // validate orderIdsArr
  if (isObjectIdValid(orderIdsArr) !== true) {
    return "OrderIdsArr not valid!";
  }

  // validate required fields
  if (!newBillingStatus) {
    return "New billing status is required!";
  }

  const notAllowedBillingStatus = ["Open", "Paid", "Cancel"];

  // validate not all
  if (notAllowedBillingStatus.includes(newBillingStatus)) {
    return `Billing status cannot be manually changed to ${newBillingStatus}!`;
  }

  // Start a session to handle transactions
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // connect before first call to DB
    await connectDb();

    // Fetch all relevant orders at once using $in
    const orders = await Order.find({
      _id: { $in: orderIdsArr },
    })
      .select("billingStatus")
      .lean()
      .session(session);

    if (!orders || orders.length === 0) {
      await session.abortTransaction();
      return "Orders were not found!";
    }

    // check if orders has the billing status "Open"
    if (orders.some((order) => order.billingStatus !== "Open")) {
      await session.abortTransaction();
      return "Only open orders can have the billing status change manually!";
    }

    const bulkWriteOperations = orders.map((order) => ({
      updateOne: {
        filter: { _id: order._id },
        update: { billingStatus: newBillingStatus, orderNetPrice: 0 },
      },
    }));

    await Order.bulkWrite(bulkWriteOperations, { session });

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
