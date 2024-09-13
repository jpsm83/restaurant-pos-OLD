import { IPrintFor } from "@/app/lib/interface/IBusiness";
import Printer from "@/app/lib/models/printer";
import connectDb from "@/app/lib/utils/connectDb";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";
import { Types } from "mongoose";
import { NextResponse } from "next/server";
import validateSalesLocationPrinter from "../../utils/validateSalesLocationPrinter";
import Business from "@/app/lib/models/business";
import { handleApiError } from "@/app/lib/utils/handleApiError";

// @desc    Delete sales location
// @route   POST /business/:businessId/addPrinterToSalesLocation/:salesLocationId
// @access  Private
export const POST = async (
  req: Request,
  context: {
    params: { businessId: Types.ObjectId; salesLocationId: Types.ObjectId };
  }
) => {
  try {
    const { businessId, salesLocationId } = context.params;
    const { mainCategory, subCategories, printerId } =
      (await req.json()) as IPrintFor;

    // validate businessId and salesLocationId
    if (
      !businessId ||
      !salesLocationId ||
      isObjectIdValid([businessId, salesLocationId]) !== true
    ) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid businessId or salesLocationId!" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // check required fields
    if (!mainCategory || !printerId) {
      return new NextResponse(
        JSON.stringify({
          message: "MainCategory and printerId required!",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const printFor = {
      mainCategory: mainCategory,
      subCategories: subCategories || [],
      printerId: printerId,
    };

    // validate the pritFor object
    const validateSalesLocationPrinterResult =
      validateSalesLocationPrinter(printFor);
    if (validateSalesLocationPrinterResult !== true) {
      return new NextResponse(
        JSON.stringify({ message: validateSalesLocationPrinterResult }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // connect before first call to DB
    await connectDb();

    // Update the sales location in a single query
    const updatedBusiness = await Business.findOneAndUpdate(
      {
        _id: businessId,
        // Prevent update if the combination of mainCategory and subCategories exists
        "salesLocation.printFor": {
          $ne: {
            mainCategory: printFor.mainCategory,
            subCategories: { $in: printFor.subCategories },
          },
        },
      },
      {
        $push: { "salesLocation.printFor": printFor },
      },
      { new: true, fields: { salesLocation: 1 }, lean: true }
    );

    if (!updatedBusiness) {
      return new NextResponse(
        JSON.stringify({
          message: "Sales location already exists or business not found!",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  } catch (error) {
    return handleApiError("Sales location creation failed!", error);
  }
};
