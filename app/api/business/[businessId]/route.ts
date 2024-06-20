import connectDB from "@/app/lib/db";
import { NextResponse } from "next/server";
import { hash } from "bcrypt";
import { Types } from "mongoose";
import { IBusiness } from "@/app/lib/interface/IBusiness";

// import functions
import { handleApiError } from "@/app/utils/handleApiError";
import { addressValidation } from "@/app/utils/addressValidation";

// imported models
import Business from "@/app/lib/models/business";
import BusinessGood from "@/app/lib/models/businessGood";
import DailySalesReport from "@/app/lib/models/dailySalesReport";
import Inventory from "@/app/lib/models/inventory";
import Notification from "@/app/lib/models/notification";
import Order from "@/app/lib/models/order";
import Printer from "@/app/lib/models/printer";
import Promotion from "@/app/lib/models/promotion";
import Schedule from "@/app/lib/models/schedule";
import Supplier from "@/app/lib/models/supplier";
import SupplierGood from "@/app/lib/models/supplierGood";
import Table from "@/app/lib/models/table";
import User from "@/app/lib/models/user";

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
      return new NextResponse("Invalid businessId!", {
        status: 400,
      });
    }

    // connect before first call to DB
    await connectDB();

    const business = await Business.findById(businessId)
      .select("-password")
      .lean();
    return !business
      ? new NextResponse("No business found!", {
          status: 404,
        })
      : new NextResponse(JSON.stringify(business), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
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
      return new NextResponse("Invalid businessId!", {
        status: 400,
      });
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
      businessTables,
    } = (await req.json()) as IBusiness;

    // check email format
    if (email && !emailRegex.test(email)) {
      return new NextResponse("Invalid email format!", { status: 400 });
    }

    // connect before first call to DB
    await connectDB();

    // check if business exists
    const business: IBusiness | null = await Business.findById(
      businessId
    ).lean();

    if (!business) {
      return new NextResponse("Business not found!", {
        status: 404,
      });
    }

    // check for duplicate legalName, email or taxNumber
    const duplicateBusiness = await Business.findOne({
      _id: { $ne: businessId },
      $or: [{ legalName }, { email }, { taxNumber }],
    });

    if (duplicateBusiness) {
      return new NextResponse(
        `Business legalname, email or taxNumber already exists!`,
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
      businessTables: businessTables || business.businessTables,
    };

    // save the updated business
    await Business.findByIdAndUpdate(businessId, updatedBusiness, {
      new: true,
      usefindAndModify: false,
    });

    return new NextResponse(`Business ${updatedBusiness.legalName} updated`, {
      status: 200,
    });
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
      return new NextResponse("Invalid businessId!", {
        status: 400,
      });
    }

    // connect before first call to DB
    await connectDB();

    // delete business and check if it exists
    const deleteResult = await Business.deleteOne({ _id: businessId });

    if (deleteResult.deletedCount === 0) {
      return new NextResponse("Business not found!", {
        status: 404,
      });
    } else {
      // Delete all related data in parallel
      await Promise.all([
        // BusinessGood.deleteMany({ business: businessId }),
        DailySalesReport.deleteMany({ business: businessId }),
        Inventory.deleteMany({ business: businessId }),
        Notification.deleteMany({ business: businessId }),
        Order.deleteMany({ business: businessId }),
        Printer.deleteMany({ business: businessId }),
        Promotion.deleteMany({ business: businessId }),
        Schedule.deleteMany({ business: businessId }),
        Supplier.deleteMany({ business: businessId }),
        // SupplierGood.deleteMany({ business: businessId }),
        Table.deleteMany({ business: businessId }),
        User.deleteMany({ business: businessId }),
      ]);
    }

    return new NextResponse(`Business ${businessId} deleted successfully`, {
      status: 200,
    });
  } catch (error) {
    return handleApiError("Delete business failed!", error);
  }
};
