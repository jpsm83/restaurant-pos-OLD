import connectDb from "@/app/lib/utils/connectDb";
import { NextResponse } from "next/server";

// imported models
import Purchase from "@/app/lib/models/purchase";

// imported utils
import { handleApiError } from "@/app/lib/utils/handleApiError";

// imported interfaces
import { IPurchase, IPurchaseItem } from "@/app/lib/interface/IPurchase";
import { validatePurchaseItems } from "./utils/validatePurchaseItems";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";
import Inventory from "@/app/lib/models/inventory";
import SupplierGood from "@/app/lib/models/supplierGood";
import Supplier from "@/app/lib/models/supplier";
import { Types } from "mongoose";

// @desc    Get all purchases
// @route   GET /purchases?startDate=<date>&endDate=<date>
// @access  Private
export const GET = async (req: Request) => {
  try {
    // date and time will como from the front as ex: "2023-04-01T15:00:00", you can create a Date object from it with new Date(startDate). This will create a Date object representing midnight on the given date in the LOCAL TIME ZONE OF THE SERVER.
    // If you need to ensure that the date represents midnight in a specific time zone, you may need to use a library like Moment.js or date-fns that supports time zones. These libraries can parse the date string and create a Date object in a specific time zone.

    // Parse query parameters for optional date range
    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    // Build the query object
    const query: any = {};

    if (startDate && endDate) {
      if (startDate > endDate) {
        return new NextResponse(
          JSON.stringify({
            message: "Invalid date range, start date must be before end date!",
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      } else {
        query.purchaseDate = {
          $gte: new Date(startDate),
          $lte: new Date(endDate),
        };
      }
    }

    // connect before first call to DB
    await connectDb();

    const purchases = await Purchase.find(query)
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

    return !purchases?.length
      ? new NextResponse(JSON.stringify({ message: "No purchases found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        })
      : new NextResponse(JSON.stringify(purchases), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        });
  } catch (error) {
    return handleApiError("Get all purchases failed!", error);
  }
};

// @desc    Create new purchase
// @route   POST /purchases
// @access  Private
export const POST = async (req: Request) => {
  try {
    const {
      title,
      supplierId,
      purchaseDate,
      businessId,
      purchasedByUserId,
      purchaseItems,
      totalAmount,
      receiptId,
    } = (await req.json()) as IPurchase;

    // check required fields
    if (
      !supplierId ||
      !purchaseDate ||
      !businessId ||
      !purchasedByUserId ||
      !purchaseItems ||
      !totalAmount
    ) {
      return new NextResponse(
        JSON.stringify({
          message:
            "SupplierId, purchaseDate, businessId, purchasedByUserId, purchaseItems, totalAmount are required!",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    // check if ids are valid
    if (!isObjectIdValid([supplierId, businessId, purchasedByUserId])) {
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

    // Validate purchase items structure
    const arePurchaseItemsValid = validatePurchaseItems(purchaseItems);
    if (typeof arePurchaseItemsValid === "string") {
      return new NextResponse(
        JSON.stringify({
          message: "Purchase items array of objects not valid!",
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

    // check if receiptId already exists
    if (receiptId) {
      const existingReceiptId = await Purchase.exists({
        receiptId: receiptId,
        businessId: businessId,
      }).lean();
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

    const newPurchase = {
      title: title ? title : "Purchase without title!",
      supplierId,
      purchaseDate,
      businessId,
      purchasedByUserId,
      purchaseItems,
      totalAmount,
      receiptId: receiptId || Date.now(),
    };

    await Purchase.create(newPurchase);

    // Update inventory with the new purchase items
    // Fetch the inventory document that is currently active
    const inventory = await Inventory.findOne({
      businessId: businessId,
      setFinalCount: false,
    }).lean();

    if (!inventory) {
      return "No inventory found!";
    }

    // Create a batch update operation to update inventoryGoods
    const bulkOperations = purchaseItems.map((item: IPurchaseItem) => {
      const { supplierGoodId, quantityPurchased } = item;
      return {
        updateOne: {
          filter: {
            businessId: businessId,
            "inventoryGoods.supplierGoodId": supplierGoodId,
            setFinalCount: false,
          },
          update: {
            $inc: { "inventoryGoods.$.dynamicSystemCount": quantityPurchased },
          },
        },
      };
    });

    // Perform bulk write operation to update inventory
    const bulkResult = await Inventory.bulkWrite(bulkOperations);

    if (bulkResult.modifiedCount === 0) {
      return new NextResponse(
        JSON.stringify({
          message: "Inventory not found or update failed.",
        }),
        { status: 404 }
      );
    }

    // Return success response
    return new NextResponse(JSON.stringify(newPurchase), {
      status: 201,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    return handleApiError("Create new purchase failed!", error);
  }
};
