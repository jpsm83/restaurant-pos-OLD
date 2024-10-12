import { Types } from "mongoose";
import { NextResponse } from "next/server";

// imported utils
import connectDb from "@/app/lib/utils/connectDb";
import { createSalesInstance } from "../../salesInstances/utils/createSalesInstance";
import { handleApiError } from "@/app/lib/utils/handleApiError";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";

// imported interfaces
import { IDailySalesReport } from "@/app/lib/interface/IDailySalesReport";
import { ISalesInstance } from "@/app/lib/interface/ISalesInstance";

// imported models
import DailySalesReport from "@/app/lib/models/dailySalesReport";
import Order from "@/app/lib/models/order";
import SalesInstance from "@/app/lib/models/salesInstance";

// @desc    Create new orders
// @route   POST /orders/transferOrderBetweenSalesInstances
// @access  Private
export const POST = async (req: Request) => {
  try {
    const {
      ordersArr, // array of orders IDs only
      userId,
      businessId,
      currSalesInstanceId,
      newSalesPointId,
      guests,
      clientName,
    } = (await req.json()) as {
      ordersArr: Types.ObjectId[];
      userId: Types.ObjectId;
      businessId: Types.ObjectId;
      currSalesInstanceId: Types.ObjectId;
      newSalesPointId: Types.ObjectId;
      guests: number;
      clientName: string;
    };

    // check if required fields are provided
    if (
      !ordersArr ||
      !userId ||
      !businessId ||
      !currSalesInstanceId ||
      !newSalesPointId
    ) {
      return new NextResponse(
        JSON.stringify({
          message:
            "OrdersArr, userId, businessId, currSalesInstanceId and newSalesPointId are required!",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // validate ids
    if (
      isObjectIdValid([
        ...ordersArr,
        userId,
        businessId,
        currSalesInstanceId,
        newSalesPointId,
      ]) !== true
    ) {
      return new NextResponse(
        JSON.stringify({
          message:
            "OrdersArr, salesInstanceId, userId or businessId not valid!",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    let salesInstanceToTransferId;

    // connect before first call to DB
    await connectDb();

    // get the dailySalesReport reference number
    const dailySalesReport: IDailySalesReport | null =
      await DailySalesReport.findOne({
        isDailyReportOpen: true,
        businessId,
      })
        .select("dailyReferenceNumber")
        .lean();

    if (!dailySalesReport) {
      return new NextResponse(
        JSON.stringify({ message: "DailySalesReport not found!" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // check if salesInstances where orders will move exist and it is not closed
    const salesInstanceToTransfer: ISalesInstance | null =
      await SalesInstance.findOne({
        dailyReferenceNumber: dailySalesReport.dailyReferenceNumber,
        businessId,
        salesPointId: newSalesPointId,
        status: { $ne: "Closed" },
      })
        .select("_id")
        .lean();

    // create new salesInstance
    const salesInstanceObj = {
      dailyReferenceNumber: dailySalesReport.dailyReferenceNumber,
      salesPointId: newSalesPointId,
      guests: salesInstanceToTransfer ? salesInstanceToTransfer.guests : guests,
      status: salesInstanceToTransfer
        ? salesInstanceToTransfer.status
        : "Occupied",
      openedById: salesInstanceToTransfer
        ? salesInstanceToTransfer.openedById
        : userId,
      responsibleById: userId,
      businessId,
      clientName: salesInstanceToTransfer
        ? salesInstanceToTransfer.clientName
        : clientName,
    };

    if (salesInstanceToTransfer) {
      salesInstanceToTransferId = salesInstanceToTransfer._id;
    } else {
      const newSalesInstance = await createSalesInstance(salesInstanceObj);
      if (!newSalesInstance) {
        return new NextResponse(
          JSON.stringify({
            message: "SalesInstance creation for transfer failed!",
          }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      } else {
        salesInstanceToTransferId = newSalesInstance._id;
      }
    }

    // replace the salesInstance in each order
    for (let orderId of ordersArr) {
      await Order.findOneAndUpdate(
        { _id: orderId },
        { salesInstanceId: salesInstanceToTransferId },
        { new: true }
      );
    }

    // set the order code for user tracking purposes
    // it will be add on the salesInstance.salesGroup array related with this group of orders
    const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const day = String(new Date().getDate()).padStart(2, "0");
    const month = String(new Date().getMonth() + 1).padStart(2, "0");
    const dayOfWeek = weekDays[new Date().getDay()];
    const randomNum = String(Math.floor(Math.random() * 9000) + 1000);

    const orderCode = `${day}${month}${dayOfWeek}${randomNum}`;

    // move orders between salesInstances
    // Update the salesInstance document by adding the order id to it
    await SalesInstance.findOneAndUpdate(
      { _id: salesInstanceToTransferId },
      {
        $push: { salesGroup: { orderCode: orderCode, ordersIds: ordersArr } },
        $set: { status: "Occupied" },
      },
      { new: true }
    );

    // Remove the order id from the old salesInstance
    await SalesInstance.findOneAndUpdate(
      { _id: currSalesInstanceId },
      { $pull: { salesGroup: { ordersIds: { $in: ordersArr } } } },
      { new: true }
    );

    return new NextResponse(
      JSON.stringify({ message: "Orders transferred successfully!" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return handleApiError(
      "Transfer orders between salesInstances failed!",
      error
    );
  }
};
