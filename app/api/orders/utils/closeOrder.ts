import { Types } from "mongoose";
import { validatePaymentMethodArray } from "./validatePaymentMethodArray";
import connectDB from "@/app/lib/db";
import Order from "@/app/lib/models/order";
import { createPaymentMethodObject } from "./createPaymentMethodObject";
import { updateMultipleOrders } from "./updateMultipleOrders";
import { IPaymentMethod } from "@/app/lib/interface/IOrder";

// *** IMPORTANT
// this function is used to close multiple orders
// it user another 3 important functions
// validatePaymentMethodArray - createPaymentMethodObject - updateMultipleOrders
// it recive an ARRAY OF ORDERS IDs and an ARRAY OF PAYMENT METHODS
export const closeOrder = async (
  ordersIdArr: Types.ObjectId[],
  paymentMethod: IPaymentMethod[],
  totalOrderNetPrice: number
) => {
  try {
    if (
      !ordersIdArr ||
      !Array.isArray(ordersIdArr) ||
      !ordersIdArr.every((id) => Types.ObjectId.isValid(id))
    ) {
      throw new Error("Invalid ordersIdArr!");
    }

    if (!paymentMethod || !Array.isArray(paymentMethod)) {
      throw new Error("Invalid payment method array!");
    }

    let validPaymentMethods = validatePaymentMethodArray(paymentMethod);
    if (typeof validPaymentMethods === "string") {
      throw new Error(validPaymentMethods);
    }

    // connect before first call to DB
    await connectDB();

    // check if totalPaymentMethodAmount is bigger tham totalOrderNetPrice
    const totalPaymentMethodAmount = paymentMethod.reduce(
      (acc, payment) => acc + payment.paymentMethodAmount,
      0
    );

    if (totalPaymentMethodAmount < totalOrderNetPrice) {
      throw new Error(
        "Total amount paid is lower than the total price of the orders!"
      );
    }

    let totalTips = totalPaymentMethodAmount - totalOrderNetPrice;

    let updatedOrders = [];

    for (let orderId of ordersIdArr) {
      const order = await Order.findById(orderId);
      if (!order) {
        throw new Error("Order not found!");
      }

      let update: {
        paymentMethod?: any;
        billingStatus?: string;
        orderTips?: number;
      } = {};

      let orderPaymentMethod = [];

      if (order.billingStatus === "Open") {
        let remainingOrderPrice = order.orderNetPrice;

        for (let validPaymentMethod of validPaymentMethods) {
          if (validPaymentMethod.paymentMethodAmount <= 0) continue;

          let amountToUse = Math.min(
            validPaymentMethod.paymentMethodAmount,
            remainingOrderPrice
          );
          orderPaymentMethod.push(
            createPaymentMethodObject(validPaymentMethod, amountToUse)
          );

          validPaymentMethod.paymentMethodAmount -= amountToUse;
          remainingOrderPrice -= amountToUse;

          if (remainingOrderPrice === 0) break;
        }

        if (remainingOrderPrice === 0) {
          update.paymentMethod = orderPaymentMethod;
          update.billingStatus = "Paid";
        }
      }

      if (totalTips > 0 && orderId === ordersIdArr[ordersIdArr.length - 1]) {
        update.orderTips = totalTips;
      }

      const updatedOrder = await updateMultipleOrders(orderId, update);
      if (!updatedOrder) {
        throw new Error("Order update failed!");
      }
      updatedOrders.push(updatedOrder);
    }

    return "Orders updated successfully!";
  } catch (error) {
    return "Close orders failed! " + error;
  }
};
