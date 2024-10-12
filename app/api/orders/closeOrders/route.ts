import { Types } from "mongoose";
import { NextResponse } from "next/server";

// imported utils
import connectDb from "@/app/lib/utils/connectDb";
import { validatePaymentMethodArray } from "../utils/validatePaymentMethodArray";
import { handleApiError } from "@/app/lib/utils/handleApiError";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";

// imported interfaces
import { IOrder } from "@/app/lib/interface/IOrder";
import { ISalesInstance } from "@/app/lib/interface/ISalesInstance";
import { IPaymentMethod } from "@/app/lib/interface/IPaymentMethod";

// imported models
import Order from "@/app/lib/models/order";
import SalesInstance from "@/app/lib/models/salesInstance";

// close multiple orders at the same time
// @desc    Create new orders
// @route   POST /orders/closeOrders
// @access  Private
export const POST = async (req: Request) => {
  try {
    const { ordersIdArr, paymentMethod } = (await req.json()) as {
      ordersIdArr: Types.ObjectId[];
      paymentMethod: IPaymentMethod[];
    };

    // validate orders ids
    if (isObjectIdValid(ordersIdArr) !== true) {
      return new NextResponse(
        JSON.stringify({ message: "OrdersIdsArr not valid!" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    if (!Array.isArray(paymentMethod) || paymentMethod.length === 0) {
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
      .select("salesInstanceId billingStatus orderNetPrice")
      .lean();

    if (!orders) {
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
        let remainingOrderGrossPrice = order.orderNetPrice;
        const orderPaymentMethods = [];

        for (const payment of validPaymentMethods) {
          if (payment.methodSalesTotal <= 0) continue;

          const amountToUse = Math.min(
            payment.methodSalesTotal,
            remainingOrderGrossPrice
          );

          // Create payment method object with the new structure
          orderPaymentMethods.push({
            paymentMethodType: payment.paymentMethodType,
            methodBranch: payment.methodBranch,
            methodSalesTotal: amountToUse,
          });

          payment.methodSalesTotal -= amountToUse;
          remainingOrderGrossPrice -= amountToUse;

          if (remainingOrderGrossPrice === 0) break;
        }

        const update = {
          paymentMethod: orderPaymentMethods,
          billingStatus: "Paid",
          orderTips: firstOrder ? totalTips : undefined,
        };
        if (order._id) {
          const updatedOrder = await Order.findOneAndUpdate(
            { _id: order._id },
            { $set: update },
            {
              new: true,
            }
          );
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

    const salesInstance: ISalesInstance | null = await SalesInstance.findById(
      orders[0].salesInstanceId
    )
      .select("responsibleBy salesGroup")
      .populate({
        path: "salesGroup.ordersIds",
        select: "billingStatus",
        model: "Order",
      })
      .lean();

    if (!salesInstance) {
      return new NextResponse(
        JSON.stringify({ message: "SalesInstance not found!" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    if (salesInstance) {
      const allOrdersPaid = salesInstance?.salesGroup?.every((group) =>
        group.ordersIds.every((order: any) => order.billingStatus === "Paid")
      );

      if (allOrdersPaid) {
        await SalesInstance.findByIdAndUpdate(
          salesInstance._id,
          {
            status: "Closed",
            closedAt: new Date(),
            closedBy: salesInstance.responsibleById,
          },
          { new: true }
        );
      }
    }

    return new NextResponse(
      JSON.stringify({ message: "Orders updated successfully!" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return handleApiError("Close orders failed!", error);
  }
};
