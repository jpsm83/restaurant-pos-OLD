import { Types } from "mongoose";
import { validatePaymentMethodArray } from "../utils/validatePaymentMethodArray";
import connectDb from "@/app/lib/utils/connectDb";
import Order from "@/app/lib/models/order";
import { updateMultipleOrders } from "../utils/updateMultipleOrders";
import Table from "@/app/lib/models/table";
import { IOrder } from "@/app/lib/interface/IOrder";
import { IPayment } from "@/app/lib/interface/IPayment";
import { ITable } from "@/app/lib/interface/ITable";
import { NextResponse } from "next/server";
import { handleApiError } from "@/app/lib/utils/handleApiError";

// @desc    Create new orders
// @route   POST /orders/closeOrders
// @access  Private
export const POST = async (req: Request) => {
  try {
    const { ordersIdArr, paymentMethod } = (await req.json()) as {
      ordersIdArr: Types.ObjectId[];
      paymentMethod: IPayment[];
    };

    // Validate order IDs
    if (
      !Array.isArray(ordersIdArr) ||
      !ordersIdArr.every(Types.ObjectId.isValid)
    ) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid ordersIdArr!" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!Array.isArray(paymentMethod) || !paymentMethod) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid payment method array!" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Validate payment methods
    const validPaymentMethods = validatePaymentMethodArray(paymentMethod);
    if (typeof validPaymentMethods === "string") {
      return new NextResponse(
        JSON.stringify({ message: validPaymentMethods }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Connect to DB
    await connectDb();

    // Fetch orders to be closed
    const orders: IOrder[] | null = await Order.find({
      _id: { $in: ordersIdArr },
      billingStatus: "Open",
    })
      .select("table billingStatus orderNetPrice")
      .lean();

    if (orders && orders.length === 0) {
      return new NextResponse(
        JSON.stringify({ message: "No open orders found!" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    const totalOrderNetPrice = orders
      ? orders.reduce((acc, order) => acc + order.orderNetPrice, 0)
      : 0;
    const totalPaid = paymentMethod.reduce(
      (acc, payment) => acc + (payment.methodSalesTotal || 0),
      0
    );

    if (totalPaid < totalOrderNetPrice) {
      return new NextResponse(
        JSON.stringify({
          message:
            "Total amount paid is lower than the total price of the orders!",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
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
          if (payment.methodSalesTotal <= 0) continue;

          const amountToUse = Math.min(
            payment.methodSalesTotal,
            remainingOrderPrice
          );

          // Create payment method object with the new structure
          orderPaymentMethods.push({
            paymentMethodType: payment.paymentMethodType,
            methodBranch: payment.methodBranch,
            methodSalesTotal: amountToUse,
          });

          payment.methodSalesTotal -= amountToUse;
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
          if (!updatedOrder) {
            return new NextResponse(
              JSON.stringify({ message: "Failed to update order!" }),
              { status: 500, headers: { "Content-Type": "application/json" } }
            );
          }
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
      if (!table) {
        return new NextResponse(
          JSON.stringify({ message: "Table not found!" }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        );
      }

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

    return new NextResponse(
      JSON.stringify({ message: "Orders updated successfully!" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return handleApiError("Close orders failed!", error);
  }
};
