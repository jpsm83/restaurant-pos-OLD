import { NextResponse } from "next/server";
import { IInventory, IInventoryGood } from "@/app/lib/interface/IInventory";
import { ISupplierGood } from "@/app/lib/interface/ISupplierGood";
import connectDB from "@/app/lib/db";
import { updateDynamicCountFromLastInventory } from "../../supplierGoods/utils/updateDynamicCountFromLastInventory";

// import models
import Inventory from "@/app/lib/models/inventory";
import SupplierGood from "@/app/lib/models/supplierGood";
import { Types } from "mongoose";
import { handleApiError } from "@/app/utils/handleApiError";

// @desc    Get inventory by ID
// @route   GET /inventories/:inventoryId
// @access  Private
export const GET = async (context: {
  params: { inventoryId: Types.ObjectId };
}) => {
  try {
    const inventoryId = context.params.inventoryId;
    // check if the inventoryId is valid
    if (!Types.ObjectId.isValid(inventoryId)) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid notification ID" }),
        { status: 400 }
      );
    }

    // connect before first call to DB
    await connectDB();

    const inventory = await Inventory.findById(inventoryId)
      .populate(
        "inventoryGoods.supplierGood",
        "name, category, subCategory, budgetImpact, measurementUnit, parLevel, inventorySchedule, dynamicCountFromLastInventory"
      )
      .lean();

    return !inventory
      ? new NextResponse(JSON.stringify({ message: "Inventory not found" }), {
          status: 404,
        })
      : new NextResponse(JSON.stringify(inventory), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
  } catch (error) {
    return handleApiError("Get inventorie failed!", error);
  }
};

// @desc    Update inventory by ID
// @route   PATCH /inventories/:inventoryId
// @access  Private
export const PATCH = async (
  req: Request,
  context: { params: { inventoryId: Types.ObjectId } }
) => {
  try {
    // when UPDATE of the inventory, systemCountQuantity will be the supplierGood.dynamicCountFromLastInventory, currentCountQuantity will be the real count, deviationPercent will be calculated as ((systemCountQuantity - currentCountQuantity) / supplierGood.parLevel) * 100, quantityNeeded will be calculated as supplierGood.parLevel - currentCountQuantity. You can update many times needed once mistakes can be done.

    // UPDATE final inventory, once the inventory is marked as setFinalCount. The supplierGood.dynamicCountFromLastInventory will be updated to the currentCountQuantity and supplierGood.lastInventoryCountDate will be updated to the current date as coutedDate

    const inventoryId = context.params.inventoryId;
    // check if the inventoryId is valid
    if (!Types.ObjectId.isValid(inventoryId)) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid notification ID" }),
        { status: 400 }
      );
    }

    // example of supplierGoodsObj coming fron the front
    // supplierGoodsObj = {
    //   supplierGood: "5f9d1f3b4f3c4b001f3b4f3c4b001f3b",
    //   currentCountQuantity: 20
    // }
    const { supplierGoodsObj, setFinalCount, comments, doneBy } =
      (await req.json()) as {
        supplierGoodsObj: {
          supplierGood: Types.ObjectId;
          currentCountQuantity: number;
        }[];
        setFinalCount?: boolean;
        comments?: string;
        doneBy: Types.ObjectId[];
      };

    // check required fields
    if (!supplierGoodsObj || !doneBy || setFinalCount === undefined) {
      return new NextResponse(
        JSON.stringify({
          message: "SupplierGoodsObj, doneby and setFinalCout are required!",
        }),
        { status: 400 }
      );
    }

    // connect before first call to DB
    await connectDB();

    // check if inventory exists
    const inventory: IInventory | null = await Inventory.findById(inventoryId)
      .select("setFinalCount inventoryGoods comments")
      .lean();

    if (!inventory) {
      return new NextResponse(
        JSON.stringify({ message: "Inventory not found!" }),
        { status: 404 }
      );
    }

    if (inventory.setFinalCount === true) {
      return new NextResponse(
        JSON.stringify({
          message: "Inventory already set as final count! Cannot update!",
        }),
        { status: 400 }
      );
    }

    // Fetch all supplierGoods at once
    const supplierGoodIds = supplierGoodsObj.map((good) => good.supplierGood);
    const supplierGoodsDocs: ISupplierGood[] = await SupplierGood.find({
      _id: { $in: supplierGoodIds },
    })
      .select("dynamicCountFromLastInventory parLevel")
      .lean();

    // create a array with the update supplierGoods objects
    const updateInventorySupplierGoodsArray = supplierGoodsDocs.map((good) => {
      const foundGood = supplierGoodsObj.find(
        (invGood) => invGood.supplierGood.toString() === good._id?.toString()
      );
      if (!foundGood) {
        throw new Error(
          `Inventory good not found for supplierGood ID: ${good._id}`
        );
      }

      const { currentCountQuantity } = foundGood;
      const systemCountQuantity = good.dynamicCountFromLastInventory;
      const deviationPercent = (((good.dynamicCountFromLastInventory ?? 0) - currentCountQuantity) / (good.parLevel || 1)) * 100;
      const quantityNeeded = (good.parLevel || 0) - currentCountQuantity;

      return {
        supplierGood: good._id,
        systemCountQuantity,
        currentCountQuantity,
        deviationPercent,
        quantityNeeded,
      };
    });

    if (setFinalCount) {
      const updatePromises = updateInventorySupplierGoodsArray.map((good) =>
        SupplierGood.findByIdAndUpdate(good.supplierGood, {
          dynamicCountFromLastInventory: good.currentCountQuantity,
          lastInventoryCountDate: new Date(),
        })
      );
      await Promise.all(updatePromises);
    }

    // create inventory object
    const updateObj = {
      setFinalCount: setFinalCount,
      inventoryGoods: updateInventorySupplierGoodsArray,
      countedDate: new Date(),
      doneBy,
      comments: comments || inventory.comments,
    };

    // update inventory
    await Inventory.findByIdAndUpdate({ _id: inventoryId }, updateObj, {
      new: true,
      usefindAndModify: false,
    });

    return new NextResponse(
      JSON.stringify({
        message: `Inventory updated!`,
      }),
      { status: 200 }
    );
  } catch (error) {
    return handleApiError("Updated inventory failed!", error);
  }
};

// @desc    Delete inventory by ID
// @route   DELETE /inventories/:inventoryId
// @access  Private
// delete an inventory shouldnt be allowed for data integrity, historical purposes and analytics
// the only case where an inventory should be deleted is if the business itself is deleted
export const DELETE = async (context: {
  params: { inventoryId: Types.ObjectId };
}) => {
  try {
    const inventoryId = context.params.inventoryId;
    // check if the inventoryId is valid
    if (!Types.ObjectId.isValid(inventoryId)) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid notification ID" }),
        { status: 400 }
      );
    }

    // connect before first call to DB
    await connectDB();

    // delete inventory and check if it existed
    const result = await Inventory.deleteOne({ _id: inventoryId });

    if (result.deletedCount === 0) {
      return new NextResponse(
        JSON.stringify({ message: "Inventory not found" }),
        { status: 404 }
      );
    }
    return new NextResponse(
      JSON.stringify({ message: `Inventory ${inventoryId} deleted!` }),
      { status: 200 }
    );
  } catch (error: any) {
    return handleApiError("Delete inventory failed!", error);
  }
};
