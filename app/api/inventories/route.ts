import { NextResponse } from "next/server";
import { IInventory, IInventoryGood } from "@/app/lib/interface/IInventory";
import connectDB from "@/app/lib/db";

// import models
import Inventory from "@/app/lib/models/inventory";
import SupplierGood from "@/app/lib/models/supplierGood";
import { Types } from "mongoose";
import { handleApiError } from "@/app/utils/handleApiError";
import { updateSupplierGoodInventory } from "./utils/updateSupplierGoodInventory";
import { deleteSupplierGoodFromInventory } from "./utils/deleteSupplierGoodFromInventory";

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
      // .populate(
      //   "inventoryGoods.supplierGood",
      //   "name category subCategory budgetImpact measurementUnit parLevel inventorySchedule dynamicCountFromLastInventory"
      // )
      .lean();

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
    // upon CREATION of the inventory, SUPPLIER GOOD systemCountQuantity, currentCountQuantity, deviationPercent and quantityNeeded will be undefined
    // the inventory will be completed on the UPDATE route

    // on the front display all supplier goods, you can display by filtering through many parametere like inventorySchedule for example
    // then select the ones you want to include in the inventory = supplierGoodsIdsArr
    const { title, business, supplierGoodsIdsArr, comments } =
      (await req.json()) as {
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

    // check if supplierGoodsIdsArr is an array of IDs
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

    // connect before first call to DB
    await connectDB();

    // supplier goods must be unique in all the open inventory
    // Fetch all inventories with setFinalCount set to false
    const openInventories = await Inventory.find({
      setFinalCount: false,
    })
      .select("inventoryGoods")
      .lean();

    // Extract all supplierGood IDs from these inventories
    const existingSupplierGoodIds = new Set(
      openInventories.flatMap((inventory) =>
        inventory.inventoryGoods.map((good: any) =>
          good.supplierGood.toString()
        )
      )
    );

    // Check for duplicates with the current request
    if (
      supplierGoodsIdsArr.some((id) =>
        existingSupplierGoodIds.has(id.toString())
      )
    ) {
      return new NextResponse(
        JSON.stringify({
          message:
            "One or more supplier goods are already in use in another pending inventory.",
        }),
        { status: 400 }
      );
    }

    // Fetch supplier goods details
    const supplierGoods = await SupplierGood.find({
      _id: { $in: supplierGoodsIdsArr },
    })
      .select("_id lastInventoryCountDate")
      .lean();

    const inventoryGoodsArr: IInventoryGood[] = supplierGoods.map((good) => ({
      supplierGood: good._id as Types.ObjectId,
      lastInventoryCountDate: good.lastInventoryCountDate || undefined,
    }));

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

// export const POST = async (req: Request) => {
//   try {
//     const inventory = "669cc76e9876c117994d0a4c";
//     const supplierGood = "667bfac8d28a7ee19d9be443";
//     const currentCountQuantity = 50;

//     // const result = await updateSupplierGoodInventory(
//     //   // @ts-ignore
//     //   inventory,
//     //   supplierGood,
//     //   currentCountQuantity
//     // );

//     const result = await deleteSupplierGoodFromInventory(
//       // @ts-ignore
//       supplierGood,
//       inventory,
//     );

//     return new NextResponse(JSON.stringify(result), {
//       status: 200,
//       headers: { "Content-Type": "application/json" },
//     });
//   } catch (error) {
//     return handleApiError("Error: ", error);
//   }
// };
