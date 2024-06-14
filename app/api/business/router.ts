import connectDB from "@/lib/db";
import { Types } from "mongoose";
import { NextResponse } from "next/server";
import { hash, compare } from "bcrypt";

// imported models
const Business = require("../models/Business");
const BusinessGood = require("../models/BusinessGood");
const DailySalesReport = require("../models/DailySalesReport");
const Inventory = require("../models/Inventory");
const Notification = require("../models/Notification");
const Order = require("../models/Order");
const Printer = require("../models/Printer");
const Promotion = require("../models/Promotion");
const Schedule = require("../models/Schedule");
const Supplier = require("../models/Supplier");
const SupplierGood = require("../models/SupplierGood");
const Table = require("../models/Table");
const User = require("../models/User");

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

// @desc    Get all businesses
// @route   GET /business
// @access  Private
export const GET = async () => {
  try {
    await connectDB();
    const business = await Business.find().select("-password").lean();
    return !business.length
      ? new NextResponse(JSON.stringify({ message: "No business found" }), {
          status: 404,
        })
      : new NextResponse(JSON.stringify(business), { status: 200 });
  } catch (error: any) {
    return new NextResponse("Error: " + error, { status: 500 });
  }
};

// @desc    Get business by ID
// @route   GET /business/:businessId
// @access  Private
export const getBusinessById = async (req: Request) => {
  try {
    await connectDB();

    const { searchParams } = new URL(req.url);
    const businessId = searchParams.get("businessId");
    if (businessId === null || !Types.ObjectId.isValid(businessId)) {
      return new NextResponse(JSON.stringify({ message: "Invalid ID" }), {
        status: 400,
      });
    }

    const business = await Business.findById(businessId)
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

// @desc    Create new business
// @route   POST /business
// @access  Private
export const CREATE = async (req: Request) => {
  try {
    await connectDB();

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
    } = req.body as unknown as BusinessData;

    // check required fields
    if (
      !tradeName ||
      !legalName ||
      !email ||
      !password ||
      !phoneNumber ||
      !taxNumber ||
      !currencyTrade ||
      !subscription ||
      !address
    ) {
      return new NextResponse(
        JSON.stringify({ message: "Missing required fields" }),
        { status: 400 }
      );
    }

    // check email format
    if (!emailRegex.test(email)) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid email format" }),
        { status: 400 }
      );
    }

    // check for duplicate legalName, email or taxNumber
    const duplicateBusiness = await Business.findOne({
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

    // hash password
    const hashedPassword = await hash(password, 10);

    // create business object with required fields
    const businessObj = {
      tradeName,
      legalName,
      email,
      password: hashedPassword,
      phoneNumber,
      taxNumber,
      currencyTrade,
      subscription,
      address,
      // add non-required fields if they exist
      ...(contactPerson && { contactPerson }),
    };

    // add address fields
    const validAddress = addressValidation(address);
    if (validAddress !== true) {
      return new NextResponse(JSON.stringify({ message: validAddress }), {
        status: 400,
      });
    }

    // Create new business
    await Business.create(businessObj);
    return new NextResponse(
      JSON.stringify({ message: `Business ${legalName} created` }),
      { status: 201 }
    );
  } catch (error) {
    // Handle unexpected errors
    return new NextResponse(
      JSON.stringify({
        message: `Business could not be created`,
      }),
      { status: 500 }
    );
  }
};

// @desc    Update business
// @route   PATH /business/:businessId
// @access  Private
export const PATCH = async (req: Request) => {
  try {
    await connectDB();

    const { searchParams } = new URL(req.url);
    const businessId = searchParams.get("businessId");

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
    if (businessId === null || !Types.ObjectId.isValid(businessId)) {
      return new NextResponse(JSON.stringify({ message: "Invalid ID" }), {
        status: 400,
      });
    }

    // check if business exists
    const business = await Business.findById(businessId).lean();
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
    await Business.findByIdAndUpdate({ _id: businessId }, updatedObj, {
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
export const DELETE = async (req: Request) => {
  try {
    await connectDB();

    const { searchParams } = new URL(req.url);
    const businessId = searchParams.get("businessId");

    // check if id is valid
    if (businessId === null || !Types.ObjectId.isValid(businessId)) {
      return new NextResponse(JSON.stringify({ message: "Invalid ID" }), {
        status: 400,
      });
    }

    // delete business and check if it exists
    const deleteResult = await Business.deleteOne({ _id: businessId });

    if (deleteResult.deletedCount === 0) {
      return new NextResponse(
        JSON.stringify({ message: "Business not found" }),
        {
          status: 404,
        }
      );
    } else {
      // delete all related data
      await BusinessGood.deleteMany({ business: businessId });
      await DailySalesReport.deleteMany({ business: businessId });
      await Inventory.deleteMany({ business: businessId });
      await Notification.deleteMany({ business: businessId });
      await Order.deleteMany({ business: businessId });
      await Printer.deleteMany({ business: businessId });
      await Promotion.deleteMany({ business: businessId });
      await Schedule.deleteMany({ business: businessId });
      await Supplier.deleteMany({ business: businessId });
      await SupplierGood.deleteMany({ business: businessId });
      await Table.deleteMany({ business: businessId });
      await User.deleteMany({ business: businessId });
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
