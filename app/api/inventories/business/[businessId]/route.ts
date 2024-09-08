import { NextResponse } from "next/server";
import connectDb from "@/app/lib/utils/connectDb";

// import models
import { Types } from "mongoose";
import { handleApiError } from "@/app/lib/utils/handleApiError";
import Inventory from "@/app/lib/models/inventory";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";
import SupplierGood from "@/app/lib/models/supplierGood";
import Supplier from "@/app/lib/models/supplier";
import { IInventory } from "@/app/lib/interface/IInventory";

// @desc    Get inventories by business ID and range of dates
// @route   GET /inventories/business/:businessId?startDate=<date>&endDate=<date>
// @access  Private
export const GET = async (
  req: Request,
  context: { params: { businessId: Types.ObjectId } }
) => {
  try {
    const businessId = context.params.businessId;

    // check if the businessId is valid
    if (!isObjectIdValid([businessId])) {
      return new NextResponse(
        JSON.stringify({ message: "Business ID not valid!" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    // date and time will como from the front as ex: "2023-04-01T15:00:00", you can create a Date object from it with new Date(startDate). This will create a Date object representing midnight on the given date in the LOCAL TIME ZONE OF THE SERVER.
    // If you need to ensure that the date represents midnight in a specific time zone, you may need to use a library like Moment.js or date-fns that supports time zones. These libraries can parse the date string and create a Date object in a specific time zone.

    // Parse query parameters for optional date range
    const { searchParams } = new URL(req.url);
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");

    // Initialize startDate and endDate
    let startDate = startDateParam ? new Date(startDateParam) : null;
    let endDate = endDateParam ? new Date(endDateParam) : null;

    // Set startDate to the first day of the month if provided
    if (startDate) {
      startDate.setDate(1);
    }

    // Set endDate to the last day of the month if provided
    if (endDate) {
      endDate = new Date(endDate.getFullYear(), endDate.getMonth() + 1, 0);
    }

    // Build query based on the presence of startDate and endDate
    let query: {
      businessId: Types.ObjectId;
      createdAt?: {
        $gte: Date;
        $lte: Date;
      };
    } = { businessId: businessId };

    // Build the query object with the optional date range
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
      }
      query.createdAt = {
        $gte: startDate,
        $lte: endDate,
      };
    }

    // connect before first call to DB
    await connectDb();

    // Find inventories with the query
    const inventories: IInventory | null = await Inventory.findOne(query)
      .populate({
        path: "inventoryGoods.supplierGoodId",
        select:
          "name mainCategory subCategory supplier budgetImpact imageUrl inventorySchedule parLevel measurementUnit pricePerUnit",
        model: SupplierGood,
        populate: {
          path: "supplier",
          select: "tradeName",
          model: Supplier,
        },
      })
      .lean();

    return !inventories
      ? new NextResponse(JSON.stringify({ message: "No inventories found!" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        })
      : new NextResponse(JSON.stringify(inventories), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
  } catch (error) {
    return handleApiError("Get inventories by business id failed!", error);
  }
};
