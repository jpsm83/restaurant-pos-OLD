import connectDb from "@/app/lib/utils/connectDb";
import { NextResponse } from "next/server";
import { hash } from "bcrypt";
import { Types } from "mongoose";
import { IBusiness } from "@/app/lib/interface/IBusiness";

// import functions
import { handleApiError } from "@/app/lib/utils/handleApiError";
import { addressValidation } from "@/app/lib/utils/addressValidation";

// imported models
import Business from "@/app/lib/models/business";
import DailySalesReport from "@/app/lib/models/dailySalesReport";
import Notification from "@/app/lib/models/notification";
import Order from "@/app/lib/models/order";
import Printer from "@/app/lib/models/printer";
import Promotion from "@/app/lib/models/promotion";
import Schedule from "@/app/lib/models/schedule";
import Supplier from "@/app/lib/models/supplier";
import Table from "@/app/lib/models/table";
import User from "@/app/lib/models/user";
import BusinessGood from "@/app/lib/models/businessGood";
import SupplierGood from "@/app/lib/models/supplierGood";
import Inventory from "@/app/lib/models/inventory";

const emailRegex = /^[\w-]+(\.[\w-]+)*@([\w-]+\.)+[a-zA-Z]{2,7}$/;

// @desc    Get business by businessId
// @route   GET /business/:businessId
// @access  Private
export const GET = async (
  req: Request,
  context: {
    params: { businessId: Types.ObjectId };
  }
) => {
  try {
    const businessId = context.params.businessId;

    if (!businessId || !Types.ObjectId.isValid(businessId)) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid businessId!" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // connect before first call to DB
    await connectDb();

    const business = await Business.findById(businessId)
      .select("-password")
      .lean();
    return !business
      ? new NextResponse(JSON.stringify({ message: "No business found!" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        })
      : new NextResponse(JSON.stringify(business), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
  } catch (error) {
    return handleApiError("Get business by its id failed!", error);
  }
};

// @desc    Update business
// @route   PATH /business/:businessId
// @access  Private
export const PATCH = async (
  req: Request,
  context: {
    params: { businessId: Types.ObjectId };
  }
) => {
  try {
    const businessId = context.params.businessId;

    if (!businessId || !Types.ObjectId.isValid(businessId)) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid businessId!" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const {
      tradeName,
      legalName,
      email,
      password,
      phoneNumber,
      taxNumber,
      currencyTrade,
      subscription,
      address,
      contactPerson,
    } = (await req.json()) as IBusiness;

    // check email format
    if (email && !emailRegex.test(email)) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid email format!" }),
        { status: 400 }
      );
    }

    // connect before first call to DB
    await connectDb();

    // check if business exists
    const business: IBusiness | null = await Business.findById(
      businessId
    ).lean();

    if (!business) {
      return new NextResponse(
        JSON.stringify({ message: "Business not found!" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // check for duplicate legalName, email or taxNumber
    const duplicateBusiness = await Business.findOne({
      _id: { $ne: businessId },
      $or: [{ legalName }, { email }, { taxNumber }],
    });

    if (duplicateBusiness) {
      return new NextResponse(
        JSON.stringify({
          message: `Business legalname, email or taxNumber already exists!`,
        }),
        { status: 409 }
      );
    }

    // prepare update address object
    const updatedAddress = {
      country: address?.country || business.address.country,
      state: address?.state || business.address.state,
      city: address?.city || business.address.city,
      street: address?.street || business.address.street,
      buildingNumber:
        address?.buildingNumber || business.address.buildingNumber,
      postCode: address?.postCode || business.address.postCode,
      region: address?.region || business.address.region,
      additionalDetails:
        address?.additionalDetails || business.address.additionalDetails,
      coordinates: address?.coordinates || business.address.coordinates,
    };

    // add address fields
    if (address) {
      const validAddress = addressValidation(updatedAddress);
      if (validAddress !== true) {
        return new NextResponse(validAddress, {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // prepare update business object
    const updatedBusiness = {
      tradeName: tradeName || business.tradeName,
      legalName: legalName || business.legalName,
      email: email || business.email,
      password: password ? await hash(password, 10) : business.password,
      phoneNumber: phoneNumber || business.phoneNumber,
      taxNumber: taxNumber || business.taxNumber,
      currencyTrade: currencyTrade || business.currencyTrade,
      subscription: subscription || business.subscription,
      address: updatedAddress,
      contactPerson: contactPerson || business.contactPerson,
    };

    // save the updated business
    await Business.findByIdAndUpdate(businessId, updatedBusiness, {
      new: true,
    });

    return new NextResponse(
      JSON.stringify({
        message: `Business ${updatedBusiness.legalName} updated`,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return handleApiError("Update business failed!", error);
  }
};

// @desc    Delete business
// @route   DELETE /business/:businessId
// @access  Private
export const DELETE = async (
  req: Request,
  context: {
    params: { businessId: Types.ObjectId };
  }
) => {
  try {
    const businessId = context.params.businessId;

    // validate businessId
    if (!businessId || !Types.ObjectId.isValid(businessId)) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid businessId!" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // connect before first call to DB
    await connectDb();

    // delete business and check if it exists
    const result = await Business.deleteOne({ _id: businessId });

    if (result.deletedCount === 0) {
      return new NextResponse(
        JSON.stringify({ message: "Business not found!" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    } else {
      // Delete all related data in parallel
      await Promise.all([
        BusinessGood.deleteMany({ business: businessId }),
        DailySalesReport.deleteMany({ business: businessId }),
        Inventory.deleteMany({ business: businessId }),
        Notification.deleteMany({ business: businessId }),
        Order.deleteMany({ business: businessId }),
        Printer.deleteMany({ business: businessId }),
        Promotion.deleteMany({ business: businessId }),
        Schedule.deleteMany({ business: businessId }),
        Supplier.deleteMany({ business: businessId }),
        SupplierGood.deleteMany({ business: businessId }),
        Table.deleteMany({ business: businessId }),
        User.deleteMany({ business: businessId }),
      ]);
    }

    return new NextResponse(
      JSON.stringify({
        message: `Business ${businessId} deleted successfully`,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return handleApiError("Delete business failed!", error);
  }
};
