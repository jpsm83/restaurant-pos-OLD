import { NextResponse } from "next/server";
import { IInventory, IInventoryGood } from "@/app/interface/IInventory";
import { ISupplierGood } from "@/app/interface/ISupplierGood";
import connectDB from "@/lib/db";
import { updateDynamicCountFromLastInventory } from "../../supplierGoods/utils/updateDynamicCountFromLastInventory";

// import models
import Inventory from "@/lib/models/inventory";
import SupplierGood from "@/lib/models/supplierGood";

// @desc    Get inventory by ID
// @route   GET /inventories/:inventoryId
// @access  Private
export const GET = async (context: { params: any }) => {
  try {
    // connect before first call to DB
    await connectDB();

    const inventoryId = context.params.inventoryId;
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
      : new NextResponse(JSON.stringify(inventory), { status: 200 });
  } catch (error: any) {
    return new NextResponse(JSON.stringify({ message: error.message }), {
      status: 500,
    });
  }
};

// @desc    Update inventory by ID
// @route   PUT /inventories/:inventoryId
// @access  Private
export const PATCH = async (
  req: Request,
  context: { params: any }
) => {
  try {
    // connect before first call to DB
    await connectDB();

    // when UPDATE of the inventory, systemCountQuantity will be the supplierGood.dynamicCountFromLastInventory, currentCountQuantity will be the real count, deviationPercent will be calculated as ((systemCountQuantity - currentCountQuantity) / supplierGood.parLevel) * 100, quantityNeeded will be calculated as supplierGood.parLevel - currentCountQuantity. You can update many times needed once mistakes can be done.

    // UPDATE final inventory, once the inventory is marked as setFinalCount. The supplierGood.dynamicCountFromLastInventory will be updated to the currentCountQuantity

    const inventoryId = context.params.inventoryId;
    const { inventoryGoods, doneBy, setFinalCount } =
      req.body as unknown as IInventory;

    // check required fields
    if (!doneBy || setFinalCount !== undefined || !inventoryGoods) {
      return new NextResponse(
        JSON.stringify({
          message: "Doneby, setFinalCout and inventoryGoods are required!",
        }),
        { status: 400 }
      );
    }

    // check if inventory exists
    const inventory: IInventory | null = await Inventory.findById(inventoryId)
      .select("setFinalCount currentCountScheduleDate")
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

    // check if inventory goods is an array of objects
    if (!Array.isArray(inventoryGoods) || inventoryGoods.length === 0) {
      return new NextResponse(
        JSON.stringify({
          message:
            "Inventory goods must be an array of supplier goods IDs and current count!",
        }),
        { status: 400 }
      );
    } else if (
      inventoryGoods.some(
        (good) => !good.supplierGood || !good.currentCountQuantity
      )
    ) {
      return new NextResponse(
        JSON.stringify({
          message:
            "Inventory goods must have supplierGood and currentCountQuantity!",
        }),
        { status: 400 }
      );
    }

    // Fetch all supplierGoods at once
    const supplierGoodsDocs: ISupplierGood[] = await SupplierGood.find({
      _id: { $in: inventoryGoods.map((good) => good.supplierGood) },
    })
      .select("dynamicCountFromLastInventory parLevel")
      .lean();

    // create a array with the update supplierGoods objects
    let updateInventorySupplierGoodsArray: IInventoryGood[] =
      supplierGoodsDocs.map((good) => {
        const foundGood = inventoryGoods.find(
          (invGood) => invGood.supplierGood === good._id
        );

        if (!foundGood) {
          throw new Error(
            `Inventory good not found for supplierGood ID: ${good._id}`
          );
        }

        const currentCountQuantity = foundGood.currentCountQuantity ?? 0;
        const deviationPercent =
          ((good.dynamicCountFromLastInventory - currentCountQuantity) /
            (good.parLevel ?? 0)) *
          100;
        const quantityNeeded = good.parLevel ?? 0 - currentCountQuantity;

        return {
          supplierGood: good._id,
          systemCountQuantity: good.dynamicCountFromLastInventory,
          currentCountQuantity,
          deviationPercent,
          quantityNeeded,
        };
      });

    if (setFinalCount === true) {
      const updatePromises = updateInventorySupplierGoodsArray.map((good) =>
        updateDynamicCountFromLastInventory(
          good.supplierGood,
          good.currentCountQuantity ?? 0
        )
      );
      await Promise.all(updatePromises);
    }

    // TO BE DONE
    // if currentCountScheduleDate is passed from the current date, NOTIFY the responables that the inventory is not being counted on the right date

    // create inventory object
    const updateObj = {
      setFinalCount: setFinalCount,
      inventoryGoods: updateInventorySupplierGoodsArray,
      countedDate: new Date(),
      doneBy,
    };

    // update inventory
    const updatedInventory = await Inventory.findByIdAndUpdate(
      { _id: inventoryId },
      updateObj,
      { new: true, usefindAndModify: false }
    );

    return updatedInventory
      ? new NextResponse(
          JSON.stringify({
            message: `Inventory done at ${inventory.currentCountScheduleDate} updated!`,
          }),
          { status: 200 }
        )
      : new NextResponse(
          JSON.stringify({ message: "Inventory not updated!" }),
          {
            status: 400,
          }
        );
  } catch (error: any) {
    return new NextResponse(JSON.stringify({ message: error.message }), {
      status: 500,
    });
  }
};

// @desc    Delete inventory by ID
// @route   DELETE /inventories/:inventoryId
// @access  Private
// delete an inventory shouldnt be allowed for data integrity, historical purposes and analytics
// the only case where an inventory should be deleted is if the business itself is deleted
export const DELETE = async (context: { params: any }) => {
  try {
    // connect before first call to DB
    await connectDB();

    const inventoryId = context.params.inventoryId;

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
    return new NextResponse(JSON.stringify({ message: error.message }), {
      status: 500,
    });
  }
};
