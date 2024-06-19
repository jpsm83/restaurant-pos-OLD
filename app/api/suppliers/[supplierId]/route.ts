import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { Types } from "mongoose";

// import models
import Supplier from "@/lib/models/supplier";
import SupplierGood from "@/lib/models/supplierGood";
import { ISupplier } from "@/app/interface/ISupplier";
import { addressValidation } from "../utils/addressValidation";

// @desc    Get supplier by ID
// @route   GET /supplier/:supplierId
// @access  Private
export const GET = async (context: { params: any }) => {
  try {
    const supplierId = context.params.supplierId;
    // validate supplierId
    if (!supplierId || !Types.ObjectId.isValid(supplierId)) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid supplierId" }),
        { status: 400 }
      );
    }

    // connect before first call to DB
    await connectDB();

    const supplier = await Supplier.findById(supplierId)
      .populate("supplierGoods", "name category currentlyInUse")
      .lean();

    return !supplier
      ? new NextResponse(JSON.stringify({ message: "No suppliers found!" }), {
          status: 404,
        })
      : new NextResponse(JSON.stringify(supplier), { status: 200 });
  } catch (error: any) {
    return new NextResponse("Error: " + error, { status: 500 });
  }
};

// @desc    Update supplier
// @route   PATCH /supplier/:supplierId
// @access  Private
export const PATCH = async (
  req: Request,
  context: { params: any }
) => {
  try {
    const supplierId = context.params.supplierId;
    // validate supplierId
    if (!supplierId || !Types.ObjectId.isValid(supplierId)) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid supplierId" }),
        { status: 400 }
      );
    }

    const {
      tradeName,
      legalName,
      email,
      phoneNumber,
      taxNumber,
      currentlyInUse,
      address,
      contactPerson,
      supplierGoods,
    } = req.body as unknown as ISupplier;

    // connect before first call to DB
    await connectDB();

    // check if supplier exists
    const supplier: ISupplier | null = await Supplier.findById(
      supplierId
    ).lean();
    if (!supplier) {
      return new NextResponse(
        JSON.stringify({ message: "Supplier not found!" }),
        { status: 404 }
      );
    }

    // check for duplicate legalName, email or taxNumber
    const duplicateSupplier = await Supplier.findOne({
      _id: { $ne: supplierId },
      business: supplier.business,
      $or: [{ legalName }, { email }, { taxNumber }],
    });

    if (duplicateSupplier) {
      return new NextResponse(
        JSON.stringify({
          message: `Supplier ${legalName}, ${email} or ${taxNumber} already exists in the business!`,
        }),
        { status: 409 }
      );
    }

    // prepare update object
    const updateObj = {
      tradeName: tradeName || supplier.tradeName,
      legalName: legalName || supplier.legalName,
      email: email || supplier.email,
      phoneNumber: phoneNumber || supplier.phoneNumber,
      taxNumber: taxNumber || supplier.taxNumber,
      currentlyInUse: currentlyInUse || supplier.currentlyInUse,
      address: address || supplier.address,
      contactPerson: contactPerson || supplier.contactPerson,
      // supplierGoods is an array of supplier goods ids coming fron the front
      supplierGoods: supplierGoods || supplier.supplierGoods,
    };

    // validate address fields
    const validAddress = addressValidation(address);
    if (validAddress !== true) {
      return new NextResponse(JSON.stringify({ message: validAddress }), {
        status: 400,
      });
    }

    // Save the updated supplier
    await Supplier.findByIdAndUpdate({ _id: supplierId }, updateObj, {
      new: true,
      usefindAndModify: false,
    }).lean();

    return new NextResponse(
      JSON.stringify({
        message: `Supplier ${legalName} updated successfully!`,
      }),
      { status: 200 }
    );
  } catch (error: any) {
    return new NextResponse("Failed to update supplier - Error: " + error, {
      status: 500,
    });
  }
};

// delete a supplier shouldnt be allowed for data integrity, historical purposes and analytics
// the only case where a supplier should be deleted is if the business itself is deleted
// but in case you want to delete a supplier you can use the following code
// be aware that this will remove the supplier from the database and all the supplier goods reference will be lost
// @desc    Delete supplier
// @route   DELETE /supplier/:supplierId
// @access  Private
export const DELETE = async (context: { params: any }) => {
  try {
    const supplierId = context.params.supplierId;
    // validate supplierId
    if (!supplierId || !Types.ObjectId.isValid(supplierId)) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid supplierId" }),
        { status: 400 }
      );
    }

    const supplier: ISupplier | null = await Supplier.findById(
      supplierId
    ).lean();
    if (!supplier) {
      return new NextResponse(
        JSON.stringify({ message: "Supplier not found!" }),
        { status: 404 }
      );
    }

    // remove the supplier reference from all supplier goods
    await SupplierGood.updateMany(
      { supplier: supplierId },
      { $unset: { supplier: "" } }
    );

    // delete the supplier
    await Supplier.deleteOne({ _id: supplierId });

    return new NextResponse(
      JSON.stringify({
        message: `Supplier with tax number ${supplier.taxNumber} deleted successfully!`,
      }),
      { status: 200 }
    );
  } catch (error: any) {
    return new NextResponse("Error: " + error, { status: 500 });
  }
};
