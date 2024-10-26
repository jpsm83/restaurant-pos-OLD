import mongoose, { Types } from "mongoose";

// imported utils
import connectDb from "@/app/lib/utils/connectDb";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";

// imported models
import Order from "@/app/lib/models/order";

// add discount to multiple orders at the same time if promotion is not applied
// only used for emplloyees orders not sef ordering
// ******** NOT USED ANYWHERE YET ********
export const addDiscountToOrders = async (
  orderIdsArr: Types.ObjectId[],
  discountPercentage: number,
  comments: string
) => {
  // validate orderIdsArr
  if (isObjectIdValid(orderIdsArr) !== true) {
    return "OrderIdsArr not valid!";
  }

  // validate required fields
  if (!discountPercentage || !comments) {
    return "Discount percentage and comments are required!";
  }

  // validate discount percentage
  if (discountPercentage > 100 || discountPercentage < 0) {
    return "Discount value has to be a number between 0 and 100!";
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
      .select("promotionApplyed orderGrossPrice")
      .lean()
      .session(session);

    if (!orders || orders.length === 0) {
      await session.abortTransaction();
      return "Some orders were not found!";
    }

    // do not add discount if promotion applyed
    if (orders.some((order) => order.promotionApplyed)) {
      await session.abortTransaction();
      return "You cannot add discount to an order that has a promotion already!";
    }

    // Prepare bulk update operations for all orders
    const bulkUpdateOperations = orders.map((order) => {
      const newNetPrice =
        order.orderGrossPrice -
        (order.orderGrossPrice * discountPercentage) / 100;

      return {
        updateOne: {
          filter: { _id: order._id },
          update: {
            $set: {
              orderNetPrice: newNetPrice,
              discountPercentage,
              comments,
            },
          },
        },
      };
    });

    // Execute bulk update
    const bulkResult = await Order.bulkWrite(bulkUpdateOperations, {
      session,
    });

    if (bulkResult.ok !== 1) {
      await session.abortTransaction();
      return "Bulk update failed!";
    }

    // Commit transaction if all updates succeed
    await session.commitTransaction();

    return "Discount added to orders successfully!";
  } catch (error) {
    await session.abortTransaction();
    return "Add discount to orders failed! " + error;
  } finally {
    session.endSession();
  }
};
