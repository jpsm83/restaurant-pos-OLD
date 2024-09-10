import { IPurchase } from "@/app/lib/interface/IPurchase";
import Purchase from "@/app/lib/models/purchase";
import connectDb from "@/app/lib/utils/connectDb";
import { handleApiError } from "@/app/lib/utils/handleApiError";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";
import { NextResponse } from "next/server";
import Inventory from "@/app/lib/models/inventory";

// this route is to add a supplierGood to the purchase that already exists
// @desc    Add supplierGood to purchase by ID
// @route   POST /purchases/:purchaseId/addSupplierGoodToPurchase
// @access  Private
export const POST = async (req: Request) => {
  try {
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

    const updatePurchase: IPurchase | null = await Purchase.findOneAndUpdate(
      { _id: purchaseId },
      {
        $push: {
          purchaseInventoryItems: {
            supplierGoodId: supplierGoodId,
            quantityPurchased: quantityPurchased,
            purchasePrice: purchasePrice,
          },
        },
      },
      { new: true }
    ).lean();

    if (!updatePurchase) {
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

    // update inventory with the new purchase items
    const updatedInventory = await Inventory.findOneAndUpdate(
      {
        businessId: updatePurchase.businessId,
        "inventoryGoods.supplierGoodId": supplierGoodId,
        setFinalCount: false,
      },
      {
        $inc: {
          "inventoryGoods.$.dynamicSystemCount": quantityPurchased,
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
