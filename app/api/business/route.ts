import connectDB from "@/lib/db";
import { NextResponse } from "next/server";
import { hash } from "bcrypt";

// imported models
import Business from "@/lib/models/business";
import { IBusiness } from "@/app/interface/IBusiness";
import { addressValidation } from "./utils/addressValidation";

const emailRegex = /^[\w-]+(\.[\w-]+)*@([\w-]+\.)+[a-zA-Z]{2,7}$/;

// @desc    Get all businesses
// @route   GET /business
// @access  Private
export const GET = async () => {
  try {
    // connect before first call to DB
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
    } = req.body as unknown as IBusiness;

    // connect before first call to DB
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
    const businessObj: IBusiness = {
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
  } catch (error: any) {
    // Handle unexpected errors
    return new NextResponse("Error: " + error, { status: 500 });
  }
};
