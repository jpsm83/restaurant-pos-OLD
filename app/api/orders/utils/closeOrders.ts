import mongoose, { Types } from "mongoose";

// imported utils
import connectDb from "@/app/lib/utils/connectDb";
import { validatePaymentMethodArray } from "../utils/validatePaymentMethodArray";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";

// imported interfaces
import { IOrder } from "@/app/lib/interface/IOrder";
import { ISalesInstance } from "@/app/lib/interface/ISalesInstance";
import { IPaymentMethod } from "@/app/lib/interface/IPaymentMethod";

// imported models
import Order from "@/app/lib/models/order";
import SalesInstance from "@/app/lib/models/salesInstance";

// close multiple orders at the same time
export const closeOrders = async (
  ordersIdArr: Types.ObjectId[],
  paymentMethod: IPaymentMethod[]
) => {
  // validate orders ids
  if (isObjectIdValid(ordersIdArr) !== true) {
    return "OrdersIdsArr not valid!";
  }

  if (!Array.isArray(paymentMethod) || paymentMethod.length === 0) {
    return "Invalid payment method array!";
  }

  // Validate payment methods
  const validPaymentMethods = validatePaymentMethodArray(paymentMethod);
  if (typeof validPaymentMethods === "string") {
    return validPaymentMethods;
  }

  // Connect to DB
  await connectDb();
  
  // Start a session to handle transactions
  const session = await mongoose.startSession();
  session.startTransaction();

  try {

    // Fetch orders to be closed
    const orders: IOrder[] | null = await Order.find({
      _id: { $in: ordersIdArr },
      billingStatus: "Open",
    })
      .select("salesInstanceId billingStatus orderNetPrice")
      .lean();

    if (!orders || orders.length === 0) {
      await session.abortTransaction();
      return "No open orders found!";
    }

    const totalOrderNetPrice = orders
      ? orders.reduce((acc, order) => acc + order.orderNetPrice, 0)
      : 0;
    const totalPaid = paymentMethod.reduce(
      (acc, payment) => acc + (payment.methodSalesTotal || 0),
      0
    );

    if (totalPaid < totalOrderNetPrice) {
      return "Total amount paid is lower than the total price of the orders!";
    }

    const totalTips = totalPaid - totalOrderNetPrice;
    let remainingTips = totalTips;

    // Process each order in a single loop
    const bulkUpdateOrders = orders.map((order, index) => {
      let remainingOrderNetPrice = order.orderNetPrice;
      const orderPaymentMethods = [];

      for (const payment of validPaymentMethods) {
        if (payment.methodSalesTotal <= 0) continue;

        const amountToUse = Math.min(
          payment.methodSalesTotal,
          remainingOrderNetPrice
        );

        // Add the payment details to the order
        orderPaymentMethods.push({
          paymentMethodType: payment.paymentMethodType,
          methodBranch: payment.methodBranch,
          methodSalesTotal: amountToUse,
        });

        payment.methodSalesTotal -= amountToUse;
        remainingOrderNetPrice -= amountToUse;

        if (remainingOrderNetPrice === 0) break;
      }

      // Prepare update data for each order
      const updateData: Partial<IOrder> = {
        paymentMethod: orderPaymentMethods,
        billingStatus: "Paid",
      };

      // Add tips to the first order
      if (index === 0 && remainingTips > 0) {
        updateData.orderTips = remainingTips;
        remainingTips = 0;
      }

      return {
        updateOne: {
          filter: { _id: order._id },
          update: { $set: updateData },
        },
      };
    });

    // Bulk update all orders
    const bulkUpdateResult = await Order.bulkWrite(bulkUpdateOrders, {
      session,
    });
    if (bulkUpdateResult.modifiedCount !== orders.length) {
      await session.abortTransaction();
      return "Failed to update all orders!";
    }

    // Fetch sales instance associated with the first order
    const salesInstance: ISalesInstance | null = await SalesInstance.findById(
      orders[0].salesInstanceId
    )
      .select("responsibleById salesGroup")
      .populate({
        path: "salesGroup.ordersIds",
        select: "billingStatus",
        model: Order,
      })
      .lean();

    if (!salesInstance) {
      await session.abortTransaction();
      return "SalesInstance not found!";
    }

    // Check if all orders in the sales instance are paid
    const allOrdersPaid = salesInstance?.salesGroup?.every((group) =>
      group.ordersIds.every((order: any) => order.billingStatus === "Paid")
    );

    if (allOrdersPaid) {
      await SalesInstance.updateOne(
        { _id: salesInstance._id },
        {
          status: "Closed",
          closedAt: new Date(),
          closedBy: salesInstance.responsibleById,
        },
        { session }
      );
    }

    // Commit transaction
    await session.commitTransaction();
    return true;
  } catch (error) {
    await session.abortTransaction();
    return "Close orders failed! Error: " + error;
  } finally {
    session.endSession();
  }
};
