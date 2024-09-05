import { NextResponse } from "next/server";
import connectDb from "@/app/lib/utils/connectDb";

// import models
import Supplier from "@/app/lib/models/supplier";
import { ISupplier } from "@/app/lib/interface/ISupplier";
import { addressValidation } from "@/app/lib/utils/addressValidation";
import { handleApiError } from "@/app/lib/utils/handleApiError";

// @desc    Get all suppliers
// @route   GET /supplier
// @access  Private
export const GET = async () => {
  try {
    // connect before first call to DB
    await connectDb();

    const suppliers = await Supplier.find()
      .populate("supplierGoods", "name mainCategory subCategory currentlyInUse")
      .lean();

    return !suppliers.length
      ? new NextResponse(JSON.stringify({ message: "No suppliers found!" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        })
      : new NextResponse(JSON.stringify(suppliers), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        });
  } catch (error) {
    return handleApiError("Get all suppliers failed!", error);
  }
};

// @desc    Create new supplier
// @route   POST /supplier
// @access  Private
// create a new supplier without supplier goods
// supplier goods can be added later on update
export const POST = async (req: Request) => {
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
    } = (await req.json()) as ISupplier;

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
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // validate address fields
    // check address validation
    if (address) {
      const validAddress = addressValidation(address);
      if (validAddress !== true) {
        return new NextResponse(JSON.stringify({ message: validAddress }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // connect before first call to DB
    await connectDb();

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
        { status: 409, headers: { "Content-Type": "application/json" } }
      );
    }

    // create supplier object with required fields
    const newSupplier = {
      tradeName,
      legalName,
      email,
      phoneNumber,
      taxNumber,
      currentlyInUse,
      business,
      address,
      contactPerson: contactPerson || undefined,
    };

    // create new supplier
    await Supplier.create(newSupplier);

    // confirm supplier was created
    return new NextResponse(
      JSON.stringify({
        message: `Supplier ${legalName} created successfully!`,
      }),
      { status: 201, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return handleApiError("Create supplier failed!", error);
  }
};
