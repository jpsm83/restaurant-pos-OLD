import { Types } from "mongoose";
import { validatePaymentMethodArray } from "./validatePaymentMethodArray";
import connectDB from "@/app/lib/db";
import Order from "@/app/lib/models/order";
import { createPaymentMethodObject } from "./createPaymentMethodObject";
import { updateMultipleOrders } from "./updateMultipleOrders";
import Table from "@/app/lib/models/table";
import { IOrder, IPaymentMethod } from "@/app/lib/interface/IOrder";
import { ITable } from "@/app/lib/interface/ITable";

export const closeOrders = async (
  ordersIdArr: Types.ObjectId[],
  paymentMethod: IPaymentMethod[]
) => {
  try {
    // Validate order IDs
    if (
      !Array.isArray(ordersIdArr) ||
      !ordersIdArr.every(Types.ObjectId.isValid)
    ) {
      throw new Error("Invalid ordersIdArr!");
    }

    if (!Array.isArray(paymentMethod) || !paymentMethod) {
      throw new Error("Invalid payment method array!");
    }

    // Validate payment methods
    const validPaymentMethods = validatePaymentMethodArray(paymentMethod);
    if (typeof validPaymentMethods === "string") {
      throw new Error(validPaymentMethods);
    }

    // Connect to DB
    await connectDB();

    // Fetch orders to be closed
    const orders: IOrder[] | null = await Order.find({
      _id: { $in: ordersIdArr },
      billingStatus: "Open",
    })
      .select("table billingStatus orderNetPrice")
      .lean();

    if (orders && orders.length === 0) {
      throw new Error("No open orders found!");
    }

    const totalOrderNetPrice = orders
      ? orders.reduce((acc, order) => acc + order.orderNetPrice, 0)
      : 0;
    const totalPaid = paymentMethod.reduce(
      (acc, payment) => acc + (payment.paymentMethodAmount || 0),
      0
    );

    if (totalPaid < totalOrderNetPrice) {
      throw new Error(
        "Total amount paid is lower than the total price of the orders!"
      );
    }

    const totalTips = totalPaid - totalOrderNetPrice;
    let firstOrder = true;

    // Update each order
    if (orders) {
      for (const order of orders) {
        let remainingOrderPrice = order.orderNetPrice;
        const orderPaymentMethods = [];

        for (const payment of validPaymentMethods) {
          if (payment.paymentMethodAmount <= 0) continue;

          const amountToUse = Math.min(
            payment.paymentMethodAmount,
            remainingOrderPrice
          );
          orderPaymentMethods.push(
            createPaymentMethodObject(payment, amountToUse)
          );

          payment.paymentMethodAmount -= amountToUse;
          remainingOrderPrice -= amountToUse;

          if (remainingOrderPrice === 0) break;
        }

        const update = {
          paymentMethod: orderPaymentMethods,
          billingStatus: "Paid",
          orderTips: firstOrder ? totalTips : undefined,
        };
        if (order._id) {
          const updatedOrder = await updateMultipleOrders(order._id, update);
          if (!updatedOrder) throw new Error("Order update failed!");
        }
        firstOrder = false;
      }
    }

    // Check and update table status
    const tableId = orders && orders[0].table;
    const openOrders = await Order.find({
      table: tableId,
      billingStatus: "Open",
    }).lean();

    if (openOrders.length === 0) {
      const table: ITable | null = await Table.findById(tableId)
        .select("responsibleBy")
        .lean();
      if (!table) throw new Error("Table not found!");

      await Table.findByIdAndUpdate(
        tableId,
        {
          status: "Closed",
          closedAt: new Date(),
          closedBy: table.responsibleBy,
        },
        { new: true }
      );
    }

    return "Orders updated successfully!";
  } catch (error) {
    return "Close orders failed! " + error;
  }
};
