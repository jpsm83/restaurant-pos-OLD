import { IPurchase } from "@/app/lib/interface/IPurchase";
import Purchase from "@/app/lib/models/purchase";
import connectDb from "@/app/lib/utils/connectDb";
import { handleApiError } from "@/app/lib/utils/handleApiError";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";
import { NextResponse } from "next/server";
import Inventory from "@/app/lib/models/inventory";

// this route is to delete a supplierGood from the purchase that already exists
// @desc    Delete supplierGood from purchase by ID
// @route   POST /purchases/:purchaseId/deleteSupplierGoodFromPurchase
// @access  Private
export const POST = async (req: Request) => {
  try {
    const { supplierGoodId, purchaseId } = await req.json();

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

    // get the purchase purchaseItem for inventory update
    const purchase: IPurchase | null = await Purchase.findOne({
      _id: purchaseId,
      "purchaseItems.supplierGoodId": supplierGoodId,
    })
      .select("purchaseItems.$.quantityPurchased")
      .lean();

    if (!purchase) {
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

    const quantityPurchased = purchase.purchaseItems[0].quantityPurchased;

    // delete supplierGood from purchase
    const updatePurchase: IPurchase | null = await Purchase.findOneAndUpdate(
      {
        _id: purchaseId,
      },
      { $pull: { purchaseItems: { supplierGoodId: supplierGoodId } } },
      { new: true }
    )
      .select("businessId")
      .lean();

    if (!updatePurchase) {
      return new NextResponse(
        JSON.stringify({ message: "SupplierGood not found or delete failed!" }),
        { status: 404 }
      );
    }

    // Update the inventory based on the deleted purchase items
    const updatedInventory = await Inventory.findOneAndUpdate(
      {
        businessId: updatePurchase.businessId,
        "inventoryGoods.supplierGoodId": supplierGoodId,
      },
      {
        $inc: {
          "inventoryGoods.$.dynamicSystemCount": -quantityPurchased,
        },
      },
      { new: true }
    ).lean();

    if (!updatedInventory) {
      return new NextResponse(
        JSON.stringify({
          message: "Inventory not found or update failed.",
        }),
        { status: 404 }
      );
    }

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
    return handleApiError("Add supplierGood to purchase failed!", error);
  }
};
