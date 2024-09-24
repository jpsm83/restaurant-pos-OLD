import { Types } from "mongoose";
import { NextResponse } from "next/server";

//imported utils
import connectDb from "@/app/lib/utils/connectDb";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";
import { handleApiError } from "@/app/lib/utils/handleApiError";

// imported models
import Printer from "@/app/lib/models/printer";

// imported interfaces
import { IConfigurationSetupToPrintOrders } from "@/app/lib/interface/IPrinter";

// this route will add individual configurationSetupToPrintOrders configuration to the printer with their properties and the users that will apply to
// [
  //     "mainCategory": "Food", this will dictate what the printer will print as main category
  //     "subCategories": ["Ice Cream", "Cake"] this will dictate what the printer will print as sub category from the main category
//   {
//     "businessSalesLocationReferenceIds": ["60d5ecb8b3333356aef7e633", "60d5ecb8b3333356aef7e633"], those are the business sales location id that this configuration will apply
//     "excludeUserIds": ["60d5ecb8b3333356aef7e633", "60d5ecb8b3333356aef7e633"], those are the users that this configurarion wont apply
//   },
// ]

// @desc    Add Configuration Setup To Printer
// @route   POST /printers/:printerId/addConfigurationSetupToPrinter
// @access  Private
export const POST = async (
  req: Request,
  context: {
    params: { printerId: Types.ObjectId };
  }
) => {
  try {
    const printerId = context.params.printerId;
    const {
      mainCategory, // single string
      subCategories, // array of strings
      businessSalesLocationReferenceIds, // array of sales location ids
      excludeUserIds, // array of user ids
    } = (await req.json()) as IConfigurationSetupToPrintOrders;

    // validate printerId
    if (isObjectIdValid([printerId]) !== true) {
      return new NextResponse(JSON.stringify({ message: "Invalid printId!" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // check businessSalesLocationReferenceIds is a valid array of ObjectIds and mainCategory is not empty
    if (
      !businessSalesLocationReferenceIds ||
      businessSalesLocationReferenceIds.length === 0 ||
      !Array.isArray(businessSalesLocationReferenceIds) ||
      isObjectIdValid(businessSalesLocationReferenceIds) !== true ||
      !mainCategory
    ) {
      return new NextResponse(
        JSON.stringify({
          message:
            "businessSalesLocationReferenceIds is required and must be an array of ObjectIds!",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // if excludeUserIds is provided, check if it is a valid array of ObjectIds
    if (excludeUserIds) {
      if (
        !Array.isArray(excludeUserIds) ||
        excludeUserIds.length === 0 ||
        isObjectIdValid(excludeUserIds) !== true
      ) {
        return new NextResponse(
          JSON.stringify({
            message: "ExcludeUserIds must be an array of ObjectIds!",
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    // if subCategories is provided, check if it is an array of strings
    if (subCategories) {
      if (!Array.isArray(subCategories) || subCategories.length === 0) {
        return new NextResponse(
          JSON.stringify({
            message: "SubCategories must be an array of strings!",
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    // connect before first call to DB
    await connectDb();

    // Check if the combination of mainCategory and any of the subCategories already exists
    const existingCombination = await Printer.findOne({
      _id: printerId,
      configurationSetupToPrintOrders: {
        $elemMatch: {
          mainCategory,
          $or: [
            { subCategories: { $exists: false } },
            { subCategories: { $size: 0 } },
            { subCategories: { $in: subCategories } },
          ],
        },
      },
    }).lean();

    if (existingCombination) {
      return new NextResponse(
        JSON.stringify({
          message:
            "A combination of these mainCategory and subCategories already exists!",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Update the printer in a single query
    const updatedPrinter = await Printer.findOneAndUpdate(
      {
        _id: printerId,
      },
      {
        $push: {
          configurationSetupToPrintOrders: {
            mainCategory,
            subCategories,
            businessSalesLocationReferenceIds,
            excludeUserIds,
          },
        },
      },
      { new: true, lean: true }
    );

    if (!updatedPrinter) {
      return new NextResponse(
        JSON.stringify({
          message: "PrinterId not found!",
        }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    return new NextResponse(
      JSON.stringify({
        message: "Configuration setup to print orders add to printer successfully",
      }),
      {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return handleApiError("Configuration setup to print orders creation failed!", error);
  }
};
