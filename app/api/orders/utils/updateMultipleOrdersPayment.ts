import { IPaymentMethod } from "@/app/lib/interface/IOrder";
import connectDB from "@/app/lib/db";
import { Types } from "mongoose";
import { NextResponse } from "next/server";
import { validatePaymentMethodArray } from "./validatePaymentMethodArray";
import { createPaymentMethodObject } from "./createPaymentMethodObject";
import { updateMultipleOrders } from "./updateMultipleOrders";

// Update multiple orders by orders ID array
// UPDATE PAYMENT METHOD FOR ALL ORDERS AT ONCE - WHOLE TABLE PAYMENT
// this is just for payment method update
export const updateMultipleOrdersPayment = async (
  ordersIdArray: Types.ObjectId[],
  paymentMethod: IPaymentMethod[],
  ordersTotalNetPrice: number
) => {
  try {
    // check if ordersIdArray is an array of valid ObjectIds
    if (!ordersIdArray || !Array.isArray(ordersIdArray)) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid ordersIdArray!" }),
        { status: 400 }
      );
    }

    // validate each order ID in the array
    for (let orderId of ordersIdArray) {
      if (!Types.ObjectId.isValid(orderId)) {
        return new NextResponse(
          JSON.stringify({ message: "Invalid order ID!" }),
          { status: 400 }
        );
      }
    }

    // connect before first call to DB
    await connectDB();

    if (!paymentMethod || !Array.isArray(paymentMethod)) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid paymentMethod array!" }),
        { status: 400 }
      );
    }

    const validPaymentMethodsOrError =
      validatePaymentMethodArray(paymentMethod);

    if (typeof validPaymentMethodsOrError === "string") {
      return new NextResponse(
        JSON.stringify({ message: validPaymentMethodsOrError }),
        { status: 400 }
      );
    }

    const validPaymentMethods = validPaymentMethodsOrError;
    let totalNetPricePayed = validPaymentMethods.reduce(
      (acc, payment) => payment.paymentMethodAmount + acc,
      0
    );

    if (totalNetPricePayed < ordersTotalNetPrice) {
      return new NextResponse(
        JSON.stringify({
          message:
            "Total amount paid is lower than the total price of the orders!",
        }),
        { status: 400 }
      );
    }

    let totalTips = totalNetPricePayed - ordersTotalNetPrice;
    let updatedOrders = [];

    for (let orderId of ordersIdArray) {
      const order = await Order.findById(orderId);
      if (!order) {
        return new NextResponse(
          JSON.stringify({ message: "Order not found!" }),
          { status: 404 }
        );
      }

      let update: {
        paymentMethod?: any;
        billingStatus?: string;
        orderStatus?: string;
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
          update.orderStatus = "Done";
        }
      }

      if (
        totalTips > 0 &&
        orderId === ordersIdArray[ordersIdArray.length - 1]
      ) {
        update.orderTips = totalTips;
      }

      const updatedOrder = await updateMultipleOrders(orderId, update);
      if (!updatedOrder) {
        return new NextResponse(
          JSON.stringify({ message: "Order update failed!" }),
          { status: 500 }
        );
      }
      updatedOrders.push(updatedOrder);
    }

    return new NextResponse(
      JSON.stringify({ message: "Orders updated successfully!" }),
      { status: 200 }
    );
  } catch (error: any) {
    return new NextResponse("Error: " + error, { status: 500 });
  }
};
