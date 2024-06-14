import connectDB from "@/lib/db";
import { NextResponse } from "next/server";
import { hash } from "bcrypt";

// imported models
import Business from "@/lib/models/business";

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

// @desc    Create new business
// @route   POST /business
// @access  Private
export const CREATE = async (req: Request) => {
  try {
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

    // connect after get a body
    await connectDB();

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
