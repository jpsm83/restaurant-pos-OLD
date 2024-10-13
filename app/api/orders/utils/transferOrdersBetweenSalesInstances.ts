import mongoose, { Types } from "mongoose";

// imported utils
import connectDb from "@/app/lib/utils/connectDb";
import { createSalesInstance } from "../../salesInstances/utils/createSalesInstance";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";

// imported interfaces
import { ISalesInstance } from "@/app/lib/interface/ISalesInstance";

// imported models
import Order from "@/app/lib/models/order";
import SalesInstance from "@/app/lib/models/salesInstance";

export const transferOrdersBetweenSalesInstances = async (
  orderIdsArr: Types.ObjectId[],
  fromSalesInstanceId: Types.ObjectId,
  toSalesInstanceId: Types.ObjectId,
  newSalesPointId: Types.ObjectId,
  guests: number,
  clientName: string
) => {
  // validate ids
  if (isObjectIdValid([...orderIdsArr, fromSalesInstanceId]) !== true) {
    return "OrderIdsArr or fromSalesInstanceId not valid!";
  }

  // toSalesInstanceId and newSalesPointId cannot exist at the same time
  if (toSalesInstanceId && newSalesPointId) {
    return "toSalesInstanceId and newSalesPointId cannot exist at the same time!";
  }

  // Validate toSalesInstanceId or newSalesPointId
  if (
    (toSalesInstanceId && isObjectIdValid([toSalesInstanceId]) !== true) ||
    (newSalesPointId && isObjectIdValid([newSalesPointId]) !== true)
  ) {
    return "Invalid toSalesInstanceId or newSalesPointId!";
  }

  // Start a session to handle transactions
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // connect before first call to DB
    await connectDb();

    // Fetch the original createdAt date from the fromSalesInstanceId's salesGroup
    const originalSalesGroup = await SalesInstance.findOne(
      {
        _id: fromSalesInstanceId,
        "salesGroup.ordersIds": { $in: orderIdsArr },
      },
      {
        "salesGroup.$": 1,
        businessId: 1,
        responsibleById: 1,
        dailyReferenceNumber: 1,
      }
    );

    if (
      !originalSalesGroup ||
      !originalSalesGroup.salesGroup ||
      originalSalesGroup.salesGroup.length === 0
    ) {
      await session.abortTransaction();
      return "Original salesGroup not found!";
    }

    const { salesGroup, businessId, responsibleById, dailyReferenceNumber } =
      originalSalesGroup;
    const originalCreatedAt = salesGroup[0].createdAt;
    let newOrderCode = salesGroup[0].orderCode;

    // save the salesInstance id where the orders will be transferred
    let salesInstanceToTransferId = null;

    // create new salesInstance
    const salesInstanceObj: Partial<ISalesInstance> = {
      dailyReferenceNumber: dailyReferenceNumber,
      status: "Occupied",
      responsibleById: responsibleById,
      businessId: businessId,
    };

    let salesInstanceToTransfer: ISalesInstance | null = null;

    if (toSalesInstanceId) {
      // Fetch existing salesInstance to transfer to
      salesInstanceToTransfer = await SalesInstance.findById(toSalesInstanceId)
        .select("_id status salesPointId guests openedById clientName")
        .lean();
    }

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
      salesInstanceObj.openedById = responsibleById;
      salesInstanceObj.clientName = clientName ? clientName : undefined;

      const newSalesInstance = await createSalesInstance(
        salesInstanceObj as ISalesInstance
      );
      if (typeof newSalesInstance === "string") {
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

    // Execute bulk update of orders and update sales instances
    await Promise.all([
      // execute bulk update
      await Order.bulkWrite(bulkUpdateOperations, { session }),

      // move orders between salesInstances
      // Update the salesInstance document by adding the order id to it
      await SalesInstance.findOneAndUpdate(
        { _id: salesInstanceToTransferId },
        {
          $push: {
            salesGroup: {
              orderCode: newOrderCode,
              ordersIds: orderIdsArr,
              createdAt: originalCreatedAt,
            },
          },
          $set: { status: "Occupied" },
        },
        { new: true, session }
      ),

      // First, remove specific order IDs from the `ordersIds` array
      await SalesInstance.findOneAndUpdate(
        { _id: fromSalesInstanceId },
        {
          $pull: {
            "salesGroup.$[].ordersIds": { $in: orderIdsArr },
          },
        },
        { session }
      ),

      // Then, remove the entire `salesGroup` object if its `ordersIds` array is empty
      await SalesInstance.findOneAndUpdate(
        { _id: fromSalesInstanceId },
        {
          $pull: {
            salesGroup: {
              ordersIds: { $size: 0 },
            },
          },
        },
        { session }
      ),
    ]);

    // Commit transaction
    await session.commitTransaction();

    return "Orders transferred successfully!";
  } catch (error) {
    await session.abortTransaction();
    return "Transfer orders between salesInstances failed! Error: " + error;
  } finally {
    session.endSession();
  }
};
