import { NextResponse } from "next/server";
import { IInventory, IInventoryGood } from "@/app/lib/interface/IInventory";
import { ISupplierGood } from "@/app/lib/interface/ISupplierGood";
import connectDB from "@/app/lib/db";

// import models
import Inventory from "@/app/lib/models/inventory";
import SupplierGood from "@/app/lib/models/supplierGood";
import { Types } from "mongoose";
import { handleApiError } from "@/app/utils/handleApiError";

// @desc    Get all inventories
// @route   GET /inventories
// @access  Private
export const GET = async () => {
  try {
    // connect before first call to DB
    await connectDB();

    // just get basic information user visualisation, not the whole inventory
    // user will be able to click on the inventory to see the details
    const inventories = await Inventory.find().lean();

    return !inventories.length
      ? new NextResponse(JSON.stringify({ message: "No inventories found" }), {
          status: 404,
        })
      : new NextResponse(JSON.stringify(inventories), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
  } catch (error) {
    return handleApiError("Get inventories failed!", error);
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
    const { title, business, supplierGoodsIdsArr, comments } = (await req.json()) as {
      title: string;
      business: Types.ObjectId;
      supplierGoodsIdsArr: Types.ObjectId[];
      comments: string;
    };

    // check required fields
    if (!title || !business || !supplierGoodsIdsArr) {
      return new NextResponse(
        JSON.stringify({
          message: "Title, business and supplierGoodsIdsArr are required!",
        }),
        { status: 400 }
      );
    }

    // check if the business is valid
    if (!Types.ObjectId.isValid(business)) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid business ID" }),
        { status: 400 }
      );
    }

    // check if supplierGoodsIdsArr is an array of strings
    if (
      !Array.isArray(supplierGoodsIdsArr) ||
      supplierGoodsIdsArr.length === 0 ||
      !supplierGoodsIdsArr.every((id) => Types.ObjectId.isValid(id))
    ) {
      return new NextResponse(
        JSON.stringify({
          message:
            "SupplierGoodsIdsArr must be an array of valid supplier goods IDs!",
        }),
        { status: 400 }
      );
    }

    // Fetch all inventories with setFinalCount set to false
    const existingInventories = await Inventory.find({
      setFinalCount: false,
    }).select("inventoryGoods").lean();

    // Extract all supplierGood IDs from these inventories
    const existingSupplierGoodIds = new Set(
      existingInventories.flatMap((inventory) =>
        inventory.inventoryGoods.map((good: any) => good.supplierGood.toString())
      )
    );

    // Check for duplicates with the current request
    const hasDuplicateSupplierGoods = supplierGoodsIdsArr.some((id) =>
      existingSupplierGoodIds.has(id.toString())
    );
    if (hasDuplicateSupplierGoods) {
      return new NextResponse(
        JSON.stringify({
          message:
            "One or more supplier goods are already in use in another pending inventory.",
        }),
        { status: 400 }
      );
    }

    let inventoryGoodsArr = [];

    // get all supplier goods for the business base on its inventory schedule
    for (let supplierGoodId of supplierGoodsIdsArr) {
      const supplierGood: ISupplierGood | null = await SupplierGood.findById(
        supplierGoodId
      )
        .select(
          "_id dynamicCountFromLastInventory parLevel lastInventoryCountDate"
        )
        .lean();
      let supplierGoodObj: IInventoryGood = {
        supplierGood: supplierGood?._id as Types.ObjectId,
        lastInventoryCountDate:
          supplierGood?.lastInventoryCountDate || undefined,
      };
      inventoryGoodsArr.push(supplierGoodObj);
    }

    // create inventory object
    const newInventory: IInventory = {
      title: title,
      business: business,
      setFinalCount: false,
      inventoryGoods: inventoryGoodsArr,
      comments: comments || undefined,
    };

    // create inventory
    await Inventory.create(newInventory);

    return new NextResponse(
      JSON.stringify({
        message: "Inventory created successfully",
      }),
      { status: 201 }
    );
  } catch (error) {
    return handleApiError("Create inventory failed!", error);
  }
};
