import connectDb from "@/app/lib/utils/connectDb";
import { NextResponse } from "next/server";

// import interfaces
import { Types } from "mongoose";
import { IOrder } from "@/app/lib/interface/IOrder";

// import utils
import { handleApiError } from "@/app/lib/utils/handleApiError";
import { cancelOrder } from "../utils/cancelOrder";

// import models
import Order from "@/app/lib/models/order";
import User from "@/app/lib/models/user";
import BusinessGood from "@/app/lib/models/businessGood";
import Table from "@/app/lib/models/table";

// @desc    Get order by ID
// @route   GET /orders/:orderId
// @access  Private
export const GET = async (
  req: Request,
  context: { params: { orderId: Types.ObjectId } }
) => {
  try {
    const orderId = context.params.orderId;
    // check if orderId is valid
    if (!orderId || !Types.ObjectId.isValid(orderId)) {
      return new NextResponse(JSON.stringify({ message: "Invalid orderId!" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // connect before first call to DB
    await connectDb();

    const order = await Order.findById(orderId)
      .populate({ path: "table", select: "tableReference", model: Table })
      .populate({
        path: "user",
        select: "username allUserRoles currentShiftRole",
        model: User,
      })
      .populate({
        path: "businessGoods",
        select:
          "name mainCategory subCategory productionTime sellingPrice allergens",
        model: BusinessGood,
      })
      .lean();

    return !order
      ? new NextResponse(JSON.stringify({ message: "Order not found!" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        })
      : new NextResponse(JSON.stringify(order), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
  } catch (error) {
    return handleApiError("Get order by its id failed!", error);
  }
};

// @desc    Update order by ID
// @route   PATCH /orders/:orderId
// @access  Private
// UPDATE PAYMENT METHOD FOR INDIVIDUAL ORDERS
export const PATCH = async (
  req: Request,
  context: { params: { orderId: Types.ObjectId } }
) => {
  try {
    const orderId = context.params.orderId;
    // check if orderId is valid
    if (!orderId || !Types.ObjectId.isValid(orderId)) {
      return new NextResponse(JSON.stringify({ message: "Invalid orderId!" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const {
      billingStatus,
      orderStatus,
      paymentMethod,
      discountPercentage,
      comments,
    } = (await req.json()) as IOrder;

    // connect before first call to DB
    await connectDb();

    // check if order exists
    const order: IOrder | null = await Order.findById(orderId)
      .select(
        "_id table billingStatus orderStatus promotionApplyed discountPercentage paymentMethod"
      )
      .lean();

    if (!order) {
      return new NextResponse(JSON.stringify({ message: "Order not found!" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // prepare the update object
    let updatedOrder = {
      billingStatus: billingStatus || order.billingStatus,
      orderStatus: orderStatus || order.orderStatus,
      orderNetPrice: order.orderNetPrice,
      discountPercentage:
        discountPercentage || order.discountPercentage || undefined,
      paymentMethod: paymentMethod || order.paymentMethod || undefined,
    };

    // if billing status is "Void" or "Invitation", comments are required
    switch (billingStatus) {
      case "Void":
      case "Invitation":
        if (!comments) {
          return new NextResponse(
            JSON.stringify({
              message:
                "Comments are required for Void and Invitation billing status!",
            }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }
        updatedOrder.orderNetPrice = 0;
        break;
      case "Cancel":
        await cancelOrder(orderId);
        return new NextResponse(
          JSON.stringify({ message: "Order cancel and deleted successfully!" }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        );
      default:
        break;
    }

    // do not add discount if promotion applyed
    // if discount percentage is provided, the total price will be calculated on the front end
    // because the discount have to be seen by the user
    if (discountPercentage) {
      if (order.promotionApplyed) {
        return new NextResponse(
          JSON.stringify({
            message:
              "You cannot add discount to an order that has a promotion already!",
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
      if (!comments) {
        return new NextResponse(
          JSON.stringify({
            message: "Comments are required if promotion applied!",
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
      if (discountPercentage > 100 || discountPercentage < 0) {
        return new NextResponse(
          JSON.stringify({
            message: "Discount value has to be a number between 0 and 100!",
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
      updatedOrder.discountPercentage = discountPercentage;
    }

    // updatedOrder the order
    await Order.findOneAndUpdate({ _id: orderId }, updatedOrder, {
      new: true,
    });

    return new NextResponse(
      JSON.stringify({
        message: `Order from table ${order.table} updated successfully!`,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return handleApiError("Update order failed!", error);
  }
};

// delete a order shouldnt be allowed for data integrity and historical purposes
// the only case where a order should be deleted is if the business itself is deleted
// or if the order was created by mistake and has billing status "Cancel"
// @desc    Delete order by ID
// @route   DELETE /orders/:orderId
// @access  Private
export const DELETE = async (
  req: Request,
  context: { params: { orderId: Types.ObjectId } }
) => {
  try {
    const orderId = context.params.orderId;

    const result = await cancelOrder(orderId);

    if (result !== "Cancel order and update dynamic count success") {
      return new NextResponse(JSON.stringify({ message: result }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new NextResponse(
      JSON.stringify({ message: "Order deleted successfully!" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return handleApiError("Delete order failed!", error);
  }
};
