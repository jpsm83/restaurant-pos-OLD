import connectDB from "@/lib/db";
import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { IOrder } from "@/app/interface/IOrder";
import { validatePaymentMethodArray } from "../utils/validatePaymentMethodArray";

// import models
import Order from "@/lib/models/order";
import Table from "@/lib/models/table";

// @desc    Get order by ID
// @route   GET /orders/:orderId
// @access  Private
export const GET = async (context: { params: any }) => {
  try {
    const orderId = context.params.orderId;
    // check if orderId is valid
    if (!orderId || !Types.ObjectId.isValid(orderId)) {
      return new NextResponse(JSON.stringify({ message: "Invalid orderId" }), {
        status: 400,
      });
    }

    // connect before first call to DB
    await connectDB();

    const order = await Order.findById(orderId)
      .populate("table", "tableReferenceNumber dayReferenceNumber")
      .populate("user", "username allUserRoles currentShiftRole")
      .populate(
        "businessGoods",
        "name category subCategory productionTime sellingPrice allergens"
      )
      .lean();

    return !order
      ? new NextResponse(JSON.stringify({ message: "Order not found!" }), {
          status: 404,
        })
      : new NextResponse(JSON.stringify(order), { status: 200 });
  } catch (error: any) {
    return new NextResponse("Error: " + error, { status: 500 });
  }
};

// @desc    Update order by ID
// @route   PATCH /orders/:orderId
// @access  Private
// UPDATE PAYMENT METHOD FOR INDIVIDUAL ORDERS
export const PATCH = async (req: Request, context: { params: any }) => {
  try {
    const orderId = context.params.orderId;
    // check if orderId is valid
    if (!orderId || !Types.ObjectId.isValid(orderId)) {
      return new NextResponse(JSON.stringify({ message: "Invalid orderId" }), {
        status: 400,
      });
    }

    // connect before first call to DB
    await connectDB();

    const {
      billingStatus,
      orderStatus,
      orderPrice,
      orderNetPrice,
      table,
      paymentMethod,
      discountPercentage,
      comments,
    } = req.body as unknown as IOrder;

    // check if order exists
    const order: IOrder | null = await Order.findById(orderId)
      .select(
        "_id table billingStatus orderStatus orderPrice orderNetPrice promotionApplyed discountPercentage paymentMethod"
      )
      .lean();
    if (!order) {
      return new NextResponse(JSON.stringify({ message: "Order not found!" }), {
        status: 404,
      });
    }

    // prepare the update object
    let updateObj = {
      billingStatus: billingStatus || order.billingStatus,
      orderStatus: orderStatus || order.orderStatus,
      orderPrice: orderPrice || order.orderPrice,
      orderNetPrice: orderNetPrice || order.orderNetPrice,
      orderTips: 0,
      table: table || order.table,
      discountPercentage:
        discountPercentage || order.discountPercentage || undefined,
      paymentMethod: paymentMethod || order.paymentMethod || undefined,
    };

    // check if table is not duplicated
    if (table !== order.table) {
      // Update the table document by adding the order id to it
      await Table.findOneAndUpdate(
        { _id: table },
        { $push: { orders: order._id } },
        { new: true, useFindAndModify: false }
      );
      // Remove the order id from the old table
      await Table.findOneAndUpdate(
        { _id: order.table },
        { $pull: { orders: order._id } },
        { new: true, useFindAndModify: false }
      );
    }

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
            { status: 400 }
          );
        }
        updateObj.orderNetPrice = 0;
        break;
      case "Cancelled":
        if (order.orderStatus === "Done") {
          return new NextResponse(
            JSON.stringify({ message: "Done orders cannot be Cancelled!" }),
            { status: 400 }
          );
        }
        // CANCELLED orders are deleted because they have no effect on the business IF they havent been done
        // not done, no loss, no gain
        const orderDeleted = await Order.deleteOne();
        // remove the order id from the table
        await Table.findByIdAndUpdate(
          //@ts-ignore
          { _id: orderDeleted.table },
          { $pull: { orders: order._id } },
          { new: true, useFindAndModify: false }
        ).lean();
        return new NextResponse(
          JSON.stringify({
            message: "Order cancelled and deleted successfully!",
          }),
          { status: 200 }
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
          { status: 400 }
        );
      }
      if (!comments) {
        return new NextResponse(
          JSON.stringify({
            message: "Comments are required if promotion applied!",
          }),
          { status: 400 }
        );
      }
      if (discountPercentage > 100 || discountPercentage < 0) {
        return new NextResponse(
          JSON.stringify({
            message: "Discount value has to be between 0 and 100!",
          }),
          { status: 400 }
        );
      }
      updateObj.discountPercentage = discountPercentage;
    }

    // if payment method is provided, check if object is valid them update the payment method
    // paymentMethod is coming from the front as an array with objects with method, card, crypto, or other
    if (paymentMethod) {
      let validPaymentMethods = validatePaymentMethodArray(paymentMethod);
      if (Array.isArray(validPaymentMethods)) {
        let totalOrderPaid = 0;

        for (let payment of validPaymentMethods) {
          totalOrderPaid += payment.paymentMethodAmount;
        }

        if (totalOrderPaid < order.orderNetPrice) {
          return new NextResponse(
            JSON.stringify({
              message:
                "Total amount paid is lower than the total price of the order!",
            }),
            { status: 400 }
          );
        }

        if (totalOrderPaid > order.orderNetPrice) {
          updateObj.orderTips = totalOrderPaid - order.orderNetPrice;
        }

        updateObj.billingStatus = "Paid";
        updateObj.orderStatus = "Done";
      } else {
        return new NextResponse(
          JSON.stringify({ message: validPaymentMethods }),
          { status: 400 }
        );
      }
    }
    updateObj.paymentMethod = paymentMethod;

    // updateObj the order
    const updatedOrder = await Order.findOneAndUpdate(
      { _id: orderId },
      updateObj,
      {
        new: true,
        useFindAndModify: false,
      }
    );

    return updatedOrder
      ? new NextResponse(
          JSON.stringify({
            message: `Order id ${updatedOrder.id} updated successfully!`,
          }),
          { status: 200 }
        )
      : new NextResponse(JSON.stringify({ message: "Order update failed!" }), {
          status: 500,
        });
  } catch (error: any) {
    return new NextResponse("Error: " + error, { status: 500 });
  }
};

// delete a order shouldnt be allowed for data integrity and historical purposes
// the only case where a order should be deleted is if the business itself is deleted
// or if the order was created by mistake and has billing status "Cancelled"
// @desc    Delete order by ID
// @route   DELETE /orders/:orderId
// @access  Private
export const DELETE = async (context: { params: any }) => {
  try {
    const orderId = context.params.orderId;
    // check if orderId is valid
    if (!orderId || !Types.ObjectId.isValid(orderId)) {
      return new NextResponse(JSON.stringify({ message: "Invalid orderId" }), {
        status: 400,
      });
    }

    // connect before first call to DB
    await connectDB();

    const order = await Order.findById(orderId);

    if (!order) {
      return new NextResponse(JSON.stringify({ message: "Order not found!" }), {
        status: 404,
      });
    }

    // delete the order id reference from table
    await Table.updateMany(
      { _id: order.table },
      { $pull: { orders: orderId } }
    );

    // delete the order
    await Order.deleteOne({ _id: orderId });
    return new NextResponse(
      JSON.stringify({ message: "Order deleted successfully!" }),
      { status: 200 }
    );
  } catch (error: any) {
    return new NextResponse("Error: " + error, { status: 500 });
  }
};
