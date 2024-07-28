import { NextResponse } from "next/server";
import connectDB from "@/app/lib/db";
import { Types } from "mongoose";

// import models
import Supplier from "@/app/lib/models/supplier";
import { ISupplier } from "@/app/lib/interface/ISupplier";
import { addressValidation } from "@/app/lib/utils/addressValidation";
import { handleApiError } from "@/app/lib/utils/handleApiError";
import { IAddress } from "@/app/lib/interface/IAddress";

// @desc    Get supplier by ID
// @route   GET /supplier/:supplierId
// @access  Private
export const GET = async (
  req: Request,
  context: { params: { supplierId: Types.ObjectId } }
) => {
  try {
    const supplierId = context.params.supplierId;

    if (!supplierId || !Types.ObjectId.isValid(supplierId)) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid supplierId!" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
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
          headers: { "Content-Type": "application/json" },
        })
      : new NextResponse(JSON.stringify(supplier), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        });
  } catch (error) {
    return handleApiError("Get supplier by its id failed!", error);
  }
};

// @desc    Update supplier
// @route   PATCH /supplier/:supplierId
// @access  Private
export const PATCH = async (
  req: Request,
  context: { params: { supplierId: Types.ObjectId } }
) => {
  try {
    const supplierId = context.params.supplierId;

    if (!supplierId || !Types.ObjectId.isValid(supplierId)) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid supplierId" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
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
    } = (await req.json()) as ISupplier;

    // connect before first call to DB
    await connectDB();

    // check if supplier exists
    const supplier: ISupplier | null = await Supplier.findById(
      supplierId
    ).lean();
    if (!supplier) {
      return new NextResponse(
        JSON.stringify({ message: "Supplier not found!" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
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
          message: `Supplier legalName, email or taxNumber already exists in the business!`,
        }),
        { status: 409, headers: { "Content-Type": "application/json" } }
      );
    }

    // Ensure supplier.address is an object if it's undefined or null
    // that is because address is not required on supplier creation
    // if it does not exist, it will be created as an empty object to avoid errors
    // supplier.address = supplier.address ?? {};

    // prepare update address object
    const updatedAddress = {
      country: address?.country ?? supplier.address?.country ?? undefined,
      state: address?.state ?? supplier.address?.state ?? undefined,
      city: address?.city ?? supplier.address?.city ?? undefined,
      street: address?.street ?? supplier.address?.street ?? undefined,
      buildingNumber:
        address?.buildingNumber ??
        supplier.address?.buildingNumber ??
        undefined,
      postCode: address?.postCode ?? supplier.address?.postCode ?? undefined,
      region: address?.region ?? supplier.address?.region ?? undefined,
      additionalDetails:
        address?.additionalDetails ??
        supplier.address?.additionalDetails ??
        undefined,
      coordinates:
        address?.coordinates ?? supplier.address?.coordinates ?? undefined,
    };

    // add address fields
    if (address) {
      const validAddress = addressValidation(updatedAddress as IAddress);
      if (validAddress !== true) {
        return new NextResponse(JSON.stringify({ message: validAddress }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // prepare update object
    const updatedSupplier = {
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

    // Save the updated supplier
    await Supplier.findByIdAndUpdate(supplierId, updatedSupplier, {
      new: true,
    });

    return new NextResponse(
      JSON.stringify({
        message: `Supplier ${updatedSupplier.legalName} updated successfully!`,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return handleApiError("Update supplier failed!", error);
  }
};

// delete a supplier shouldnt be allowed for data integrity, historical purposes and analytics
// the only case where a supplier should be deleted is if the business itself is deleted
// but in case you want to delete a supplier you can use the following code
// be aware that this will remove the supplier from the database and all the supplier goods reference will be lost
// @desc    Delete supplier
// @route   DELETE /supplier/:supplierId
// @access  Private
export const DELETE = async (
  req: Request,
  context: { params: { supplierId: Types.ObjectId } }
) => {
  try {
    const supplierId = context.params.supplierId;
    // validate supplierId
    if (!supplierId || !Types.ObjectId.isValid(supplierId)) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid supplierId!" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // connect before first call to DB
    await connectDB();

    // // remove the supplier reference from all supplier goods
    // await SupplierGood.updateMany(
    //   { supplier: supplierId },
    //   { $unset: { supplier: "" } }
    // );

    // delete the supplier
    const result = await Supplier.deleteOne({ _id: supplierId });

    if (result.deletedCount === 0) {
      return new NextResponse(
        JSON.stringify({ message: "Supplier not found!" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    return new NextResponse(
      JSON.stringify({
        message: `Supplier id ${supplierId} deleted successfully!`,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return handleApiError("Delete supplier failed!", error);
  }
};
