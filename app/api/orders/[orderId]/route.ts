import connectDb from "@/app/lib/utils/connectDb";
import { NextResponse } from "next/server";

// import interfaces
import { Types } from "mongoose";

// import utils
import { handleApiError } from "@/app/lib/utils/handleApiError";
import { cancelOrders } from "../utils/cancelOrders";

// import models
import Order from "@/app/lib/models/order";
import Employee from "@/app/lib/models/employee";
import BusinessGood from "@/app/lib/models/businessGood";
import SalesInstance from "@/app/lib/models/salesInstance";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";
import SalesPoint from "@/app/lib/models/salesPoint";

// @desc    Get order by ID
// @route   GET /orders/:orderId
// @access  Private
export const GET = async (
  req: Request,
  context: { params: { orderId: Types.ObjectId } }
) => {
  try {
    const orderId = context.params.orderId;

    // validate ids
    if (isObjectIdValid([orderId]) !== true) {
      return new NextResponse(
        JSON.stringify({
          message: "OrderId not valid!",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // connect before first call to DB
    await connectDb();

    const order = await Order.findById(orderId)
      .populate({
        path: "salesInstanceId",
        select: "salesPointId",
        populate: {
          path: "salesPointId",
          select: "salesPointName",
          model: SalesPoint,
        },
        model: SalesInstance,
      })
      .populate({
        path: "employeeId",
        select: "employeeName allEmployeeRoles currentShiftRole",
        model: Employee,
      })
      .populate({
        path: "businessGoodsIds",
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

    const result = await cancelOrders([orderId]);

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
