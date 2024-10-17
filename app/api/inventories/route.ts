import { NextResponse } from "next/server";
import { IInventory } from "@/app/lib/interface/IInventory";
import connectDb from "@/app/lib/utils/connectDb";

// import models
import Inventory from "@/app/lib/models/inventory";
import SupplierGood from "@/app/lib/models/supplierGood";
import mongoose, { Types } from "mongoose";
import { handleApiError } from "@/app/lib/utils/handleApiError";
import Supplier from "@/app/lib/models/supplier";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";
import moment from "moment";
import { updateDynamicCountSupplierGood } from "./utils/updateDynamicCountSupplierGood";

// @desc    Get all inventories
// @route   GET /inventories?startDate=<date>&endDate=<date>
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
        // Match the countedDate within the nested inventoryGoods.monthlyCounts array
        query["inventoryGoods.monthlyCounts.countedDate"] = {
          $gte: new Date(startDate),
          $lte: new Date(endDate),
        };
      }
    }
    // connect before first call to DB
    await connectDb();

    // Find inventories with the query
    const inventories = await Inventory.find(query)
      .populate({
        path: "inventoryGoods.supplierGoodId",
        select:
          "name mainCategory subCategory supplierId budgetImpact imageUrl inventorySchedule parLevel measurementUnit pricePerMeasurementUnit",
        model: SupplierGood,
        populate: {
          path: "supplierId",
          select: "tradeName",
          model: Supplier,
        },
      })
      .lean();

    return !inventories.length
      ? new NextResponse(JSON.stringify({ message: "No inventories found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        })
      : new NextResponse(JSON.stringify(inventories), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
  } catch (error) {
    return handleApiError("Get inventories failed!", error);
  }
};

// if there is an inventory with the current month, it will do nothing, otherways from the first day of the month, when manager or admin login, the system will set the setFinalCount from previews inventory to "true" them create a new inventory with all the supplier goods in used
// @desc    Create a new inventory
// @route   POST /inventories
// @access  Private
export const POST = async (req: Request) => {
  try {
    // *** IMPORTANT ***
    // inventory will be created on the first day of the month, with all the supplier goods that exists on the business
    // from there, all the counte will be handle as updates to the inventoryGoods.monthlyCounts array
    // *****************

    const { businessId } = (await req.json()) as { businessId: Types.ObjectId };

    // Validate businessId
    if (!businessId || !isObjectIdValid([businessId])) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid business ID" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Get the current month's start and end dates
    const startOfCurrentMonth = moment().startOf("month").toDate();
    const endOfCurrentMonth = moment().endOf("month").toDate();

    // connect before first call to DB
    await connectDb();

    // check if there is an inventory for the current month
    const currentMonthInventory = await Inventory.exists({
      businessId: businessId,
      setFinalCount: false,
      createdAt: { $gte: startOfCurrentMonth, $lte: endOfCurrentMonth },
    });

    if (!currentMonthInventory) {
      // Get the previous month's start and end dates
      const startOfPreviousMonth = moment()
        .subtract(1, "months")
        .startOf("month")
        .toDate();
      const endOfPreviousMonth = moment()
        .subtract(1, "months")
        .endOf("month")
        .toDate();

      // Fetch the previous month's inventory for the business
      const lastInventory: IInventory | null = await Inventory.findOneAndUpdate(
        {
          businessId: businessId,
          createdAt: { $gte: startOfPreviousMonth, $lte: endOfPreviousMonth },
        },
        {
          $set: { setFinalCount: true },
        },
        { new: true }
      ).lean();

      // Fetch all supplier goods for the business
      const supplierGoods = await SupplierGood.find({
        business: businessId,
        currentlyInUse: true,
      })
        .select("_id")
        .lean();

      if (!supplierGoods || supplierGoods.length === 0) {
        return new NextResponse(
          JSON.stringify({
            message: "No supplier goods found for the business",
          }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        );
      }

      // Create the inventoryGoods array
      const inventoryGoodsArr = supplierGoods.map((supplierGood: any) => {
        // Find if this supplierGood exists in the last inventory
        const lastInventoryGood = lastInventory?.inventoryGoods.find(
          (good) =>
            good.supplierGoodId.toString() === supplierGood._id.toString()
        );

        if (lastInventoryGood && lastInventoryGood.monthlyCounts.length > 0) {
          // Scenario 1: Last inventory exists and the good was counted, use the last count
          const mostRecentCount =
            lastInventoryGood.monthlyCounts.sort(
              (a, b) =>
                new Date(b.countedDate ?? "").getTime() -
                new Date(a.countedDate ?? "").getTime()
            )[0]?.currentCountQuantity || 0;

          return {
            supplierGoodId: supplierGood._id,
            monthlyCounts: [],
            dynamicSystemCount: mostRecentCount,
          };
        } else {
          // Scenario 2 or 3: Either no last inventory or the good wasn't counted previously, use default count
          return {
            supplierGoodId: supplierGood._id,
            monthlyCounts: [],
            dynamicSystemCount: 0, // Default value for new goods or goods not counted previously
          };
        }
      });

      // Create the inventory object
      const newInventory: IInventory = {
        businessId: businessId,
        setFinalCount: false,
        inventoryGoods: inventoryGoodsArr,
      };

      // Insert the new inventory
      await Inventory.create(newInventory);

      return new NextResponse(
        JSON.stringify({ message: "Inventory created successfully" }),
        { status: 201, headers: { "Content-Type": "application/json" } }
      );
    } else {
      return new NextResponse(
        JSON.stringify({
          message:
            "Inventory for the current month already exists and its open",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    return handleApiError("Create inventory failed!", error);
  }
};

// export const POST = async () => {
//   try {
//     let businessGoodsIds = [
//       "667bfc0c5d50be40f0c7b065",
//       "667bfddd5d50be40f0c7b079",
//       "667bfc0c5d50be40f0c7b065"
//   ];

//     let addOrRemove: "remove" | "add" = "remove";

//     // connect before first call to DB
//     await connectDb();

//     const result = await updateDynamicCountSupplierGood(
//       //@ts-ignore
//       businessGoodsIds,
//       addOrRemove
//     );

//     return new NextResponse(JSON.stringify(result), {
//       status: 200, // Change status to 200
//       headers: { "Content-Type": "application/json" },
//     });
//   } catch (error) {
//     return handleApiError("Create inventory failed!", error);
//   }
// };
