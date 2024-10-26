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

    // Fetch the original salesInstance
    const fromSalesInstance = await SalesInstance.findOne(
      {
        _id: fromSalesInstanceId,
        "salesGroup.ordersIds": { $in: orderIdsArr },
      },
      {
        "salesGroup.$": 1,
        status: 1,
        businessId: 1,
        responsibleById: 1,
        dailyReferenceNumber: 1,
      }
    );

    if (
      !fromSalesInstance ||
      !fromSalesInstance.salesGroup ||
      fromSalesInstance.salesGroup.length === 0
    ) {
      await session.abortTransaction();
      return "Original salesGroup not found!";
    }

    if (fromSalesInstance.status === "Closed") {
      await session.abortTransaction();
      return "Cannot transfer orders from a closed salesInstance!";
    }

    const { salesGroup, businessId, responsibleById, dailyReferenceNumber } =
      fromSalesInstance;
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
        .select(
          "_id status salesGroup salesPointId guests openedByEmployeeId clientName"
        )
        .lean();
    }

    if (
      salesInstanceToTransfer &&
      salesInstanceToTransfer.status !== "Closed"
    ) {
      salesInstanceToTransferId = salesInstanceToTransfer._id;
      salesInstanceObj.salesPointId = salesInstanceToTransfer.salesPointId;
      salesInstanceObj.guests = salesInstanceToTransfer.guests;
      salesInstanceObj.openedByEmployeeId = salesInstanceToTransfer.openedByEmployeeId;
      salesInstanceObj.clientName = clientName
        ? clientName
        : salesInstanceToTransfer.clientName;
    } else {
      const salesPointAvailable = await SalesInstance.exists({
        dailyReferenceNumber: dailyReferenceNumber,
        salesPointId: newSalesPointId,
        status: { $ne: "Closed" },
      });

      if (salesPointAvailable) {
        await session.abortTransaction();
        return "SalesPoint is already occupied!";
      }

      salesInstanceObj.salesPointId = newSalesPointId;
      salesInstanceObj.guests = guests ? guests : undefined;
      salesInstanceObj.openedByEmployeeId = responsibleById;
      salesInstanceObj.clientName = clientName ? clientName : undefined;

      const newSalesInstance = await createSalesInstance(
        salesInstanceObj as ISalesInstance
      );
      if (typeof newSalesInstance === "string") {
        await session.abortTransaction();
        return newSalesInstance;
      } else {
        salesInstanceToTransferId = newSalesInstance._id;
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
      (async () => {
        if (salesInstanceToTransfer) {
          const existingSalesGroup = salesInstanceToTransfer?.salesGroup?.find(
            (group) => group.orderCode === newOrderCode
          );

          if (existingSalesGroup) {
            // Update the existing salesGroup entry
            await SalesInstance.updateOne(
              {
                _id: salesInstanceToTransferId,
                "salesGroup.orderCode": newOrderCode,
              },
              {
                $addToSet: { "salesGroup.$.ordersIds": { $each: orderIdsArr } },
                $set: { status: "Occupied" },
              },
              { session }
            );
          } else {
            // Create a new salesGroup entry
            await SalesInstance.updateOne(
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
              { session }
            );
          }
        }
      })(),

      // First, remove specific order IDs from the `ordersIds` array
      await SalesInstance.updateOne(
        { _id: fromSalesInstanceId },
        {
          $pull: {
            "salesGroup.$[].ordersIds": { $in: orderIdsArr },
          },
        },
        { session }
      ),

      // Then, remove the entire `salesGroup` object if its `ordersIds` array is empty
      await SalesInstance.updateOne(
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
