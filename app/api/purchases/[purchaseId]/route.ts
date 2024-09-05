import { Types } from "mongoose";
import { NextResponse } from "next/server";

// imported utils
import connectDb from "@/app/lib/utils/connectDb";
import { handleApiError } from "@/app/lib/utils/handleApiError";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";

// imported models
import Purchase from "@/app/lib/models/purchase";
import Supplier from "@/app/lib/models/supplier";
import SupplierGood from "@/app/lib/models/supplierGood";
import { IPurchase } from "@/app/lib/interface/IPurchase";
import updateInventory from "../utils/updateInventory";

// @desc    GET purchase by ID
// @route   GET /purchases/:purchaseId?startDate=<date>&endDate=<date>
// @access  Private
export const GET = async (
  req: Request,
  context: { params: { purchaseId: Types.ObjectId } }
) => {
  try {
    const purchaseId = context.params.purchaseId;

    // check if the purchaseId is a valid ObjectId
    if (!isObjectIdValid([purchaseId])) {
      return new NextResponse(
        JSON.stringify({ message: "Purchase ID not valid!" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    // connect before first call to DB
    await connectDb();

    const purchase = await Purchase.findById(purchaseId)
      .populate({
        path: "supplierId",
        select: "tradeName",
        model: Supplier,
      })
      .populate({
        path: "purchaseItems.supplierGoodId",
        select: "name mainCategory subCategory measurementUnit pricePerUnit",
        model: SupplierGood,
      })
      .lean();

    return !purchase
      ? new NextResponse(JSON.stringify({ message: "Purchase not found!" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        })
      : new NextResponse(JSON.stringify(purchase), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        });
  } catch (error) {
    return handleApiError("Get purchase by id failed!", error);
  }
};

// @desc    Update purchase by ID
// @route   PUT /purchases/:purchaseId
// @access  Private
export const PATCH = async (
  req: Request,
  context: { params: { purchaseId: Types.ObjectId } }
) => {
  try {
    const purchaseId = context.params.purchaseId;
    const {
      purchaseDate,
      businessId,
      purchasedByUserId,
      purchaseItems,
      totalAmount,
      receiptId,
    } = (await req.json()) as IPurchase;

    // check if ids are valid
    const areIdsValid = isObjectIdValid([businessId, purchasedByUserId]);
    if (areIdsValid !== true) {
      return new NextResponse(
        JSON.stringify({
          message: "Supplier, business or user IDs not valid!",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    // check purchase items are valid
    if (!Array.isArray(purchaseItems) || purchaseItems.length === 0) {
      return new NextResponse(
        JSON.stringify({
          message: "Purchase items is not an array or it is empty!",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    // connect before first call to DB
    await connectDb();

    // check if new receiptId already exists
    if (receiptId) {
      const existingReceiptId = await Purchase.exists({
        id: { $ne: purchaseId },
        receiptId: receiptId,
        businessId: businessId,
      });
      if (existingReceiptId) {
        return new NextResponse(
          JSON.stringify({ message: "Receipt Id already exists!" }),
          {
            status: 400,
            headers: {
              "Content-Type": "application/json",
            },
          }
        );
      }
    }

    // Prepare the fields that need to be updated
    const updatedPurchase: Partial<IPurchase> = {};
    if (purchaseDate) updatedPurchase.purchaseDate = purchaseDate;
    if (purchasedByUserId)
      updatedPurchase.purchasedByUserId = purchasedByUserId;
    if (purchaseItems) updatedPurchase.purchaseItems = purchaseItems;
    if (totalAmount) updatedPurchase.totalAmount = totalAmount;
    if (receiptId) updatedPurchase.receiptId = receiptId;

    // Update the purchase in a single query
    const updatedPurchaseResult = await Purchase.findByIdAndUpdate(
      purchaseId,
      { $set: updatedPurchase },
      { new: true, lean: true } // Use lean to reduce memory footprint after updating
    );

    // Check if the purchase was found and updated
    if (!updatedPurchaseResult) {
      return new NextResponse(
        JSON.stringify({ message: "Purchase not found!" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // call the updateInventory function to update the inventory
    const isUpdateInventoryDone = await updateInventory(
      businessId,
      purchaseItems
    );

    if (isUpdateInventoryDone !== true) {
      return new NextResponse(
        JSON.stringify({ message: isUpdateInventoryDone }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    return new NextResponse(
      JSON.stringify({
        message: "Purchase updated successfully!",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return handleApiError("Update purchase failed!", error);
  }
};

// @desc    Delete purchase by ID
// @route   DELETE /purchases/:purchaseId
// @access  Private
export const DELETE = async (
  req: Request,
  context: { params: { purchaseId: Types.ObjectId } }
) => {
  try {
    const purchaseId = context.params.purchaseId;

    // check if the purchaseId is a valid ObjectId
    if (!isObjectIdValid([purchaseId])) {
      return new NextResponse(
        JSON.stringify({ message: "Purchase ID not valid!" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    // connect before first call to DB
    await connectDb();

    // delete daily report and check if it existed
    const result = await Purchase.deleteOne({
      _id: purchaseId,
    });

    if (result.deletedCount === 0) {
      return new NextResponse(
        JSON.stringify({ message: "Purchase not found!" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    return new NextResponse(`Purchase ${purchaseId} deleted`, {
      status: 200,
    });
  } catch (error) {
    return handleApiError("Delete purchase failed!", error);
  }
};
