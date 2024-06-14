import connectDB from "@/lib/db";
import { NextResponse } from "next/server";
import { hash } from "bcrypt";
import { Types } from "mongoose";

// imported models
import Business from "@/lib/models/business";
// import BusinessGood from "@/lib/models/businessGood";
// import DailySalesReport from "@/lib/models/dailySalesReport";
// import Inventory from "@/lib/models/inventory";
// import Notification from "@/lib/models/notification";
// import Order from "@/lib/models/order";
// import Printer from "@/lib/models/printer";
// import Promotion from "@/lib/models/promotion";
// import Schedule from "@/lib/models/schedule";
// import Supplier from "@/lib/models/supplier";
// import SupplierGood from "@/lib/models/supplierGood";
// import Table from "@/lib/models/table";
// import User from "@/lib/models/user";

const emailRegex = /^[\w-]+(\.[\w-]+)*@([\w-]+\.)+[a-zA-Z]{2,7}$/;

interface Address {
  country: string;
  state: string;
  city: string;
  street: string;
  buildingNumber: string;
  postCode: string;
  region?: string;
  additionalDetails?: string;
  coordinates?: [number, number];
  [key: string]: string | number | undefined | [number, number];
}

interface BusinessData {
  tradeName: string;
  legalName: string;
  email: string;
  password: string;
  phoneNumber: string;
  taxNumber: string;
  currencyTrade: string;
  subscription: string;
  address: Address;
  contactPerson?: string;
  businessTables?: string[] | undefined;
}

// helper function to validate address object
const addressValidation = (address: Address) => {
  // check address is an object
  if (typeof address !== "object" || address === null) {
    return "Address must be a non-null object";
  }

  // required fields
  const requiredFields = [
    "country",
    "state",
    "city",
    "street",
    "buildingNumber",
    "postCode",
  ];

  // check required fields
  const missingFields = requiredFields.filter(
    (field) => !(field in address) || address[field] === undefined
  );

  return missingFields.length > 0 ? "Invalid address object fields" : true;
};

// @desc    Get business by ID
// @route   GET /business/:businessId
// @access  Private
export const getBusinessById = async (
  req: Request,
  context: { params: any }
) => {
  try {
    // this is how to get query params from the URL
    // const { searchParams } = new URL(req.url);
    // const businessId = searchParams.get("businessId");

    // get businessId from the context
    // that is the main element of a dinamic URL
    const businessId = context.params.businessId;

    if (!businessId || !Types.ObjectId.isValid(businessId)) {
      return new NextResponse(JSON.stringify({ message: "Invalid ID" }), {
        status: 400,
      });
    }

    // connect after get a valida businessId
    await connectDB();

    const business = await Business.findById({
      businessId,
    })
      .select("-password")
      .lean();
    return !business
      ? new NextResponse(JSON.stringify({ message: "No business found" }), {
          status: 404,
        })
      : new NextResponse(JSON.stringify(business), { status: 200 });
  } catch (error: any) {
    return new NextResponse("Error: " + error, { status: 500 });
  }
};

// @desc    Update business
// @route   PATH /business/:businessId
// @access  Private
export const PATCH = async (req: Request, context: { params: any }) => {
  try {
    // this is how to get query params from the URL
    // const { searchParams } = new URL(req.url);
    // const businessId = searchParams.get("businessId");

    // get businessId from the context, similar to the above but safer
    // that is the main element of a dinamic URL
    const businessId = context.params.businessId;

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
    } = req.body as unknown as BusinessData;

    // check if id is valid
    if (!businessId || !Types.ObjectId.isValid(businessId)) {
      return new NextResponse(JSON.stringify({ message: "Invalid ID" }), {
        status: 400,
      });
    }

    // connect after get a valida businessId and body
    await connectDB();

    // check if business exists
    const business: BusinessData | null = await Business.findById({
      businessId,
    }).lean();
    if (!business) {
      return new NextResponse(
        JSON.stringify({ message: "Business not found" }),
        {
          status: 404,
        }
      );
    }

    // check email format
    if (email && !emailRegex.test(email)) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid email format" }),
        { status: 400 }
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
          message: `Business ${legalName}, ${email} or ${taxNumber} already exists!`,
        }),
        { status: 409 }
      );
    }

    // prepare update object
    const updatedObj = {
      tradeName: tradeName || business.tradeName,
      legalName: legalName || business.legalName,
      email: email || business.email,
      password: (await hash(password, 10)) || business.password,
      phoneNumber: phoneNumber || business.phoneNumber,
      taxNumber: taxNumber || business.taxNumber,
      currencyTrade: currencyTrade || business.currencyTrade,
      subscription: subscription || business.subscription,
      contactPerson: contactPerson || business.contactPerson,
      businessTables: businessTables || business.businessTables,
    };

    // add address fields
    const validAddress = addressValidation(address);
    if (validAddress !== true) {
      return new NextResponse(JSON.stringify({ message: validAddress }), {
        status: 400,
      });
    }

    // save the updated business
    await Business.findByIdAndUpdate({ businessId }, updatedObj, {
      new: true,
      usefindAndModify: false,
    });

    return new NextResponse(
      JSON.stringify({
        message: `Business ${legalName} updated`,
      }),
      { status: 200 }
    );
  } catch (error: any) {
    return new NextResponse(
      JSON.stringify({ message: `Business could not be updated` }),
      { status: 400 }
    );
  }
};

// @desc    Delete business
// @route   DELETE /business/:id
// @access  Private
export const DELETE = async (req: Request, context: { params: any }) => {
  try {
    // this is how to get query params from the URL
    // const { searchParams } = new URL(req.url);
    // const businessId = searchParams.get("businessId");

    // get businessId from the context, similar to the above but safer
    // that is the main element of a dinamic URL
    const businessId = context.params.businessId;

    // connect after get a valida businessId
    await connectDB();

    // check if id is valid
    if (!businessId || !Types.ObjectId.isValid(businessId)) {
      return new NextResponse(JSON.stringify({ message: "Invalid ID" }), {
        status: 400,
      });
    }

    // delete business and check if it exists
    const deleteResult = await Business.deleteOne({
      businessId,
    });

    if (deleteResult.deletedCount === 0) {
      return new NextResponse(
        JSON.stringify({ message: "Business not found" }),
        {
          status: 404,
        }
      );
    } else {
      // delete all related data
      //   await BusinessGood.deleteMany({ business: businessId });
      //   await DailySalesReport.deleteMany({ business: businessId });
      //   await Inventory.deleteMany({ business: businessId });
      //   await Notification.deleteMany({ business: businessId });
      //   await Order.deleteMany({ business: businessId });
      //   await Printer.deleteMany({ business: businessId });
      //   await Promotion.deleteMany({ business: businessId });
      //   await Schedule.deleteMany({ business: businessId });
      //   await Supplier.deleteMany({ business: businessId });
      //   await SupplierGood.deleteMany({ business: businessId });
      //   await Table.deleteMany({ business: businessId });
      //   await User.deleteMany({ business: businessId });
    }

    return new NextResponse(
      JSON.stringify({
        message: `Business ${businessId} deleted successfully!`,
      }),
      { status: 200 }
    );
  } catch (error) {
    return new NextResponse(
      JSON.stringify({ message: "Business could not be deleted" }),
      { status: 500 }
    );
  }
};
