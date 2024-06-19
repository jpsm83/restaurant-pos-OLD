import { NextResponse } from "next/server";
import connectDB from "@/app/lib/db";

// import models
import Supplier from "@/app/lib/models/supplier";
import { ISupplier } from "@/app/lib/interface/ISupplier";
import { addressValidation } from "./utils/addressValidation";

// @desc    Get all suppliers
// @route   GET /supplier
// @access  Private
export const getSuppliers = async () => {
  try {
    // connect before first call to DB
    await connectDB();

    const suppliers = await Supplier.find()
      .populate("supplierGoods", "name category currentlyInUse")
      .lean();

    return !suppliers.length
      ? new NextResponse(JSON.stringify({ message: "No suppliers found!" }), {
          status: 404,
        })
      : new NextResponse(JSON.stringify(suppliers), { status: 200 });
  } catch (error: any) {
    return new NextResponse("Error: " + error, { status: 500 });
  }
};

// @desc    Create new supplier
// @route   POST /supplier
// @access  Private
// create a new supplier without supplier goods
// supplier goods can be added later on update
export const createNewSupplier = async (req: Request) => {
  try {
    const {
      tradeName,
      legalName,
      email,
      phoneNumber,
      taxNumber,
      currentlyInUse,
      business,
      address,
      contactPerson,
    } = req.body as unknown as ISupplier;

    // check required fields
    if (
      !tradeName ||
      !legalName ||
      !email ||
      !phoneNumber ||
      !taxNumber ||
      currentlyInUse === undefined ||
      !business
    ) {
      return new NextResponse(
        JSON.stringify({
          message:
            "TradeName, legalName, email, phoneNumber, taxNumber, currentlyInUse and business are required!",
        }),
        { status: 400 }
      );
    }

    // connect before first call to DB
    await connectDB();

    // check for duplicate legalName, email or taxNumber
    const duplicateSupplier = await Supplier.findOne({
      business: business,
      $or: [{ legalName }, { email }, { taxNumber }],
    });

    if (duplicateSupplier) {
      return new NextResponse(
        JSON.stringify({
          message: `Supplier ${legalName}, ${email} or ${taxNumber} already exists!`,
        }),
        { status: 409 }
      );
    }

    // create supplier object with required fields
    const supplierObj = {
      tradeName,
      legalName,
      email,
      phoneNumber,
      taxNumber,
      currentlyInUse,
      business,
      address,
      // add non required fields if they exist
      ...(contactPerson && { contactPerson }),
    };

    // validate address fields
    const validAddress = addressValidation(address);
    if (validAddress !== true) {
      return new NextResponse(JSON.stringify({ message: validAddress }), {
        status: 400,
      });
    }

    // create new supplier
    await Supplier.create(supplierObj);

    // confirm supplier was created
    return new NextResponse(
      JSON.stringify({
        message: `Supplier ${legalName} created successfully!`,
      }),
      { status: 201 }
    );
  } catch (error: any) {
    return new NextResponse("Supplier creation failed - Error: " + error, {
      status: 500,
    });
  }
};
