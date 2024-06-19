import { NextResponse } from "next/server";
import { IInventory } from "@/app/lib/interface/IInventory";
import { ISupplierGood } from "@/app/lib/interface/ISupplierGood";
import connectDB from "@/app/lib/db";

// import models
import Inventory from "@/app/lib/models/inventory";
import SupplierGood from "@/app/lib/models/supplierGood";

// @desc    Get all inventories
// @route   GET /inventories
// @access  Private
export const GET = async () => {
  try {
    // connect before first call to DB
    await connectDB();

    // just get basic information user visualisation, not the whole inventory
    // user will be able to click on the inventory to see the details
    const inventories = await Inventory.find()
      .select("currentCountScheduleDate previewsCountedDate doneBy")
      .lean();

    return !inventories.length
      ? new NextResponse(JSON.stringify({ message: "No inventories found" }), {
          status: 404,
        })
      : new NextResponse(JSON.stringify(inventories), { status: 200 });
  } catch (error: any) {
    return new NextResponse(JSON.stringify({ message: error.message }), {
      status: 500,
    });
  }
};

// @desc    Create new inventory
// @route   POST /inventories
// @access  Private
export const POST = async (req: Request) => {
  try {
    // connect before first call to DB
    await connectDB();

    // upon CREATION of the inventory, SUPPLIER GOOD systemCountQuantity, currentCountQuantity, deviationPercent and quantityNeeded will be undefined
    // the inventory will be completed on the UPDATE route
    const { business, inventoryGoods } = req.body as unknown as IInventory;

    // check required fields
    if (!business || !inventoryGoods) {
      return new NextResponse(
        JSON.stringify({
          message: "Business and inventoryGoods are required!",
        }),
        { status: 400 }
      );
    }

    // check if inventory goods is an array
    if (!Array.isArray(inventoryGoods) || inventoryGoods.length === 0) {
      return new NextResponse(
        JSON.stringify({
          message: "Inventory goods must be an array of supplier goods IDs!",
        }),
        { status: 400 }
      );
    }

    // create inventory object
    const inventoryObj: IInventory = {
      currentCountScheduleDate: new Date(),
      business,
      setFinalCount: false,
      inventoryGoods,
    };

    // check previous inventory count date if exist
    const firstSupplierGood: ISupplierGood | null = await SupplierGood.findById(
      inventoryGoods[0].supplierGood
    )
      .select("inventorySchedule")
      .lean();
    
    if (!firstSupplierGood) {
      return new NextResponse(
        JSON.stringify({ message: "Supplier good not found" }),
        { status: 404 }
      );
    }
    let currentDate = new Date();
    let previewsInventoryDate = new Date();
    if (firstSupplierGood.inventorySchedule === "daily") {
      previewsInventoryDate.setDate(currentDate.getDate() - 1);
    } else if (firstSupplierGood.inventorySchedule === "weekly") {
      previewsInventoryDate.setDate(currentDate.getDate() - 7);
    } else if (firstSupplierGood.inventorySchedule === "monthly") {
      previewsInventoryDate.setMonth(currentDate.getMonth() - 1);
    }

    // Create new Date objects for the start and end of the day
    let startOfDay = new Date(previewsInventoryDate);
    let endOfDay = new Date(previewsInventoryDate);

    // Set time to start of the day for startOfDay and end of the day for endOfDay
    startOfDay.setHours(0, 0, 0, 0);
    endOfDay.setHours(23, 59, 59, 999);

    const previewsInventoryExists = await Inventory.exists({
      business,
      currentCountScheduleDate: { $gte: startOfDay, $lte: endOfDay },
    });

    // set the previewsCountedDate if the inventory exists
    inventoryObj.previewsCountedDate = previewsInventoryExists
      ? previewsInventoryDate
      : undefined;

    // create inventory
    const inventory = await Inventory.create({
      inventoryObj,
    });

    inventory
      ? new NextResponse(
          JSON.stringify({
            message: `${firstSupplierGood.inventorySchedule} inventory created!`,
          }),
          { status: 201 }
        )
      : new NextResponse(
          JSON.stringify({ message: "Inventory not created!" }),
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
