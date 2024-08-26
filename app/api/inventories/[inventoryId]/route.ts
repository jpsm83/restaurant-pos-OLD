import { NextResponse } from "next/server";
import { IInventory } from "@/app/lib/interface/IInventory";
import connectDB from "@/app/lib/db";

// import models
import Inventory from "@/app/lib/models/inventory";
import SupplierGood from "@/app/lib/models/supplierGood";
import { Types } from "mongoose";
import { handleApiError } from "@/app/lib/utils/handleApiError";

// @desc    Get inventory by ID
// @route   GET /inventories/:inventoryId
// @access  Private
export const GET = async (
  req: Request,
  context: {
    params: { inventoryId: Types.ObjectId };
  }
) => {
  try {
    const inventoryId = context.params.inventoryId;
    // check if the inventoryId is valid
    if (!Types.ObjectId.isValid(inventoryId)) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid inventory ID" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // connect before first call to DB
    await connectDB();

    const inventory = await Inventory.findById(inventoryId)
      .populate(
        "inventoryGoods.supplierGood",
        "name mainCategory subCategory budgetImpact measurementUnit parLevel inventorySchedule"
      )
      .lean();

    if (!inventory) {
      return new NextResponse(
        JSON.stringify({ message: "Inventory not found" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
    return new NextResponse(JSON.stringify(inventory), {
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
    // UPDATE final inventory, once the inventory is marked as setFinalCount. The supplierGood.dynamicCountFromLastInventory will be updated to the currentCountQuantity and supplierGood.lastInventoryCountDate will be updated to the current date as coutedDate

    const inventoryId = context.params.inventoryId;
    // check if the inventoryId is valid
    if (!Types.ObjectId.isValid(inventoryId)) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid inventory ID" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // example of supplierGoodsObj coming fron the front
    // supplierGoodsObj = {
    //   supplierGood: "5f9d1f3b4f3c4b001f3b4f3c4b001f3b",
    //   currentCountQuantity: 20
    // }
    const { title, setFinalCount, comments, doneBy } = (await req.json()) as {
      title: string;
      setFinalCount?: boolean;
      comments?: string;
      doneBy: Types.ObjectId[];
    };

    // connect before first call to DB
    await connectDB();

    // check if inventory exists
    const inventory: IInventory | null = await Inventory.findById(inventoryId)
      .select("title setFinalCount inventoryGoods comments")
      .lean();

    if (!inventory) {
      return new NextResponse(
        JSON.stringify({ message: "Inventory not found!" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    if (inventory.setFinalCount === true) {
      return new NextResponse(
        JSON.stringify({
          message: "Inventory already set as final count! Cannot update!",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // all the calculations are done for each supplierGood only when the setFinalCount is true
    if (setFinalCount) {
      // Step 1: Fetch all SupplierGood objects at once
      const supplierGoodIds = inventory.inventoryGoods.map(
        (sg) => sg.supplierGood
      );
      const supplierGoods = await SupplierGood.find({
        _id: { $in: supplierGoodIds },
      })
        .select("_id parLevel")
        .lean();

      // Create a map for quick access
      const supplierGoodMap = new Map(
        supplierGoods.map((sg) => [(sg._id as Types.ObjectId).toString(), sg])
      );

      // Step 2: Prepare updates without updating the database in the loop
      const inventoryGoodsUpdates = [];
      const supplierGoodsUpdates = [];

      for (let supplierGoodId of inventory.inventoryGoods) {
        const supplierGoodObj = supplierGoodMap.get(
          supplierGoodId.supplierGood.toString()
        );

        if (supplierGoodObj) {
          let updatedSupplierGoodInventoryObj = {
            supplierGood: supplierGoodObj._id,
            systemCountQuantity: supplierGoodObj.dynamicCountFromLastInventory,
            currentCountQuantity: supplierGoodId.currentCountQuantity,
            deviationPercent:
              (((supplierGoodObj.dynamicCountFromLastInventory ?? 0) -
                (supplierGoodId.currentCountQuantity || 0)) /
                (supplierGoodObj.dynamicCountFromLastInventory ?? 0)) *
              100,
            quantityNeeded:
              (supplierGoodObj.parLevel || 0) -
              (supplierGoodId.currentCountQuantity || 0),
          };

          inventoryGoodsUpdates.push(updatedSupplierGoodInventoryObj);
          supplierGoodsUpdates.push({
            updateOne: {
              filter: { _id: supplierGoodObj._id },
              update: {
                dynamicCountFromLastInventory:
                  supplierGoodId.currentCountQuantity,
                lastInventoryCountDate: new Date(),
              },
            },
          });
        }
      }

      // Step 3: Bulk update SupplierGood collection
      if (supplierGoodsUpdates.length > 0) {
        await SupplierGood.bulkWrite(supplierGoodsUpdates);
      }

      // Step 4: Update Inventory document with all changes at once
      await Inventory.findByIdAndUpdate(
        inventoryId,
        {
          $set: { inventoryGoods: inventoryGoodsUpdates },
        },
        { new: true }
      );
    }

    // create inventory object
    const updatedInventory = {
      title: title || inventory.title,
      setFinalCount: setFinalCount,
      comments: comments || inventory.comments,
      countedDate: new Date(),
      doneBy: doneBy || inventory.doneBy,
    };

    // update inventory
    await Inventory.findByIdAndUpdate({ _id: inventoryId }, updatedInventory, {
      new: true,
    });

    return new NextResponse(
      JSON.stringify({
        message: `Inventory updated!`,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
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
export const DELETE = async (
  req: Request,
  context: {
    params: { inventoryId: Types.ObjectId };
  }
) => {
  try {
    const inventoryId = context.params.inventoryId;
    // check if the inventoryId is valid
    if (!Types.ObjectId.isValid(inventoryId)) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid notification ID" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // connect before first call to DB
    await connectDB();

    // delete inventory and check if it existed
    const result = await Inventory.deleteOne({ _id: inventoryId });

    if (result.deletedCount === 0) {
      return new NextResponse(
        JSON.stringify({ message: "Inventory not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }
    return new NextResponse(
      JSON.stringify({ message: `Inventory ${inventoryId} deleted!` }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return handleApiError("Delete inventory failed!", error);
  }
};
