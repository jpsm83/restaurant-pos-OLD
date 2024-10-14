import { IPurchase } from "@/app/lib/interface/IPurchase";
import Purchase from "@/app/lib/models/purchase";
import connectDb from "@/app/lib/utils/connectDb";
import { handleApiError } from "@/app/lib/utils/handleApiError";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";
import { NextResponse } from "next/server";
import Inventory from "@/app/lib/models/inventory";
import mongoose from "mongoose";

// this route is to edit a supplierGood from the purchase that already exists
// @desc    Edit supplierGood from purchase by ID
// @route   POST /purchases/:purchaseId/editSupplierGoodFromPurchase
// @access  Private
export const POST = async (req: Request) => {
  const { supplierGoodId, quantityPurchased, purchasePrice, purchaseId } =
    await req.json();

  // check if the purchaseId is a valid ObjectId
  if (!isObjectIdValid([purchaseId, supplierGoodId])) {
    return new NextResponse(
      JSON.stringify({ message: "Purchase or supplier ID not valid!" }),
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

  // start the transaction
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // get the purchase purchaseItem for comparison
    const purchaseItem: IPurchase | null = await Purchase.findOne({
      _id: purchaseId,
      "purchaseInventoryItems.supplierGoodId": supplierGoodId,
    })
      .select(
        "purchaseInventoryItems.$.quantityPurchased purchaseInventoryItems.$.purchasePrice"
      )
      .lean();

    if (!purchaseItem) {
      await session.abortTransaction();
      return new NextResponse(
        JSON.stringify({ message: "Purchase item not found!" }),
        {
          status: 404,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    // Update the purchaseItem with the new values
    const updatePurchase: IPurchase | null = await Purchase.findOneAndUpdate(
      {
        _id: purchaseId,
        "purchaseInventoryItems.supplierGoodId": supplierGoodId,
      },
      {
        $set: {
          "purchaseInventoryItems.$.quantityPurchased": quantityPurchased,
          "purchaseInventoryItems.$.purchasePrice": purchasePrice,
        },
        $inc: {
          totalAmount:
            purchasePrice -
            (purchaseItem.purchaseInventoryItems?.[0]?.purchasePrice ?? 0),
        },
      },
      { new: true, session }
    )
      .select("businessId purchaseInventoryItems.$.quantityPurchased")
      .lean();

    if (!updatePurchase) {
      await session.abortTransaction();
      return new NextResponse(
        JSON.stringify({ message: "Purchase not found!" }),
        {
          status: 404,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    // Update the inventory based on new purchase items
    const updatedInventory = await Inventory.findOneAndUpdate(
      {
        businessId: updatePurchase.businessId,
        "inventoryGoods.supplierGoodId": supplierGoodId,
        setFinalCount: false,
      },
      {
        $inc: {
          "inventoryGoods.$.dynamicSystemCount":
            quantityPurchased -
            (purchaseItem.purchaseInventoryItems?.[0]?.purchasePrice ?? 0),
        },
      },
      { new: true, session }
    ).lean();

    if (!updatedInventory) {
      await session.abortTransaction();
      return new NextResponse(
        JSON.stringify({
          message: "Inventory not found or update failed.",
        }),
        { status: 404 }
      );
    }

    await session.commitTransaction();

    return new NextResponse(
      JSON.stringify({
        message: "SupplierGood added to purchase successfully!",
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    await session.abortTransaction();
    return handleApiError("Add supplierGood to purchase failed!", error);
  } finally {
    session.endSession();
  }
};
