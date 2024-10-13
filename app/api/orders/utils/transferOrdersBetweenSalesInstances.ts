import mongoose, { Types } from "mongoose";
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

export const transferOrdersBetweenSalesInstances = async (
  orderIdsArr: Types.ObjectId[],
  userId: Types.ObjectId,
  businessId: Types.ObjectId,
  fromSalesInstanceId: Types.ObjectId,
  toSalesInstanceId: Types.ObjectId,
  newSalesPointId: Types.ObjectId,
  guests: number,
  clientName: string,
  orderCode: string
) => {
  // validate ids
  if (
    isObjectIdValid([
      ...orderIdsArr,
      userId,
      businessId,
      fromSalesInstanceId,
      toSalesInstanceId,
      newSalesPointId,
    ]) !== true
  ) {
    return "OrderIdsArr, salesInstanceId, userId or businessId not valid!";
  }

  // toSalesInstanceId and newSalesPointId cannot exist at the same time
  if (toSalesInstanceId && newSalesPointId) {
    return "toSalesInstanceId and newSalesPointId cannot exist at the same time!";
  }

  // Start a session to handle transactions
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // check if required fields are provided
    if (
      !orderIdsArr ||
      !userId ||
      !businessId ||
      !fromSalesInstanceId ||
      !newSalesPointId
    ) {
      return "OrderIdsArr, userId, businessId, fromSalesInstanceId and newSalesPointId are required!";
    }

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
      await session.abortTransaction();
      return "DailySalesReport not found!";
    }

    // save the salesInstance id where the orders will be transferred
    let salesInstanceToTransferId;

    // save the order code for user tracking purposes in case of new salesInstance creation
    let newOrderCode = orderCode;

    // create new salesInstance
    const salesInstanceObj: Partial<ISalesInstance> = {
      dailyReferenceNumber: dailySalesReport.dailyReferenceNumber,
      status: "Occupied",
      responsibleById: userId,
      businessId,
    };

    // check if salesInstances where orders will move exist and it is not closed
    const salesInstanceToTransfer: ISalesInstance | null =
      await SalesInstance.findById(toSalesInstanceId)
        .select("_id status salesPointId")
        .lean();

    if (
      salesInstanceToTransfer &&
      salesInstanceToTransfer.status !== "Closed"
    ) {
      salesInstanceToTransferId = salesInstanceToTransfer._id;
      salesInstanceObj.salesPointId = salesInstanceToTransfer.salesPointId;
      salesInstanceObj.guests = salesInstanceToTransfer.guests;
      salesInstanceObj.openedById = salesInstanceToTransfer.openedById;
      salesInstanceObj.clientName = clientName
        ? clientName
        : salesInstanceToTransfer.clientName;
    } else {
      salesInstanceObj.salesPointId = newSalesPointId;
      salesInstanceObj.guests = guests ? guests : undefined;
      salesInstanceObj.openedById = userId;
      salesInstanceObj.clientName = clientName ? clientName : undefined;

      const newSalesInstance = await createSalesInstance(
        salesInstanceObj as ISalesInstance
      );
      if (!newSalesInstance) {
        await session.abortTransaction();
        return "SalesInstance creation for transfer failed!";
      } else {
        salesInstanceToTransferId = newSalesInstance._id;

        // set the order code for user tracking purposes
        // it will be add on the salesInstance.salesGroup array related with this group of orders
        const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        const day = String(new Date().getDate()).padStart(2, "0");
        const month = String(new Date().getMonth() + 1).padStart(2, "0");
        const dayOfWeek = weekDays[new Date().getDay()];
        const randomNum = String(Math.floor(Math.random() * 9000) + 1000);

        newOrderCode = `${day}${month}${dayOfWeek}${randomNum}`;
      }
    }

    // create bulk update operations for all orders
    const bulkUpdateOperations = orderIdsArr.map((orderId) => {
      return {
        updateOne: {
          filter: { _id: orderId },
          update: {
            $set: { salesInstanceId: salesInstanceToTransferId },
          },
        },
      };
    });

    // execute bulk update
    await Order.bulkWrite(bulkUpdateOperations, { session });

    // move orders between salesInstances
    // Update the salesInstance document by adding the order id to it
    await SalesInstance.findOneAndUpdate(
      { _id: salesInstanceToTransferId },
      {
        $push: {
          salesGroup: { orderCode: newOrderCode, ordersIds: orderIdsArr },
        },
        $set: { status: "Occupied" },
      },
      { new: true }
    );

    // Remove the order id from the old salesInstance
    await SalesInstance.updateOne(
      { _id: fromSalesInstanceId },
      {
        $pull: {
          salesGroup: {
            $or: [
              { ordersIds: { $in: orderIdsArr } }, // Remove specific orders
              { ordersIds: { $size: 0 } }, // Remove entire object if ordersIds array is empty
            ],
          },
        },
      },
      { session }
    );

    return "Orders transferred successfully!";
  } catch (error) {
    return "Transfer orders between salesInstances failed! Error: " + error;
  }
};
