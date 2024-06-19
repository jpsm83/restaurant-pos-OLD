import connectDB from "@/app/lib/db";
import { NextResponse } from "next/server";
import { hash } from "bcrypt";

// imported models
import User from "@/app/lib/models/user";
import { addressValidation } from "./utils/addressValidation";
import { IUser } from "@/app/lib/interface/IUser";
import { personalDetailsValidation } from "./utils/personalDetailsValidation";

// @desc    Get all users
// @route   GET /users
// @access  Private
export const GET = async () => {
  try {
    // connect before first call to DB
    await connectDB();

    const users = await User.find().select("-password").lean();

    return !users?.length
      ? new NextResponse(JSON.stringify({ message: "No users found" }), {
          status: 404,
        })
      : new NextResponse(JSON.stringify(users), { status: 200 });
  } catch (error: any) {
    return new NextResponse("Error: " + error, { status: 500 });
  }
};

// @desc    Create new user
// @route   POST /users
// @access  Private
export const POST = async (req: Request) => {
  try {
    const {
      username,
      email,
      password,
      idType,
      idNumber,
      allUserRoles,
      personalDetails,
      taxNumber,
      joinDate,
      active,
      onDuty,
      vacationDaysPerYear,
      business,
      address,
      photo,
      contractHoursWeek,
      grossMonthlySalary,
      netMonthlySalary,
      comments,
    } = req.body as unknown as IUser;

    // check required fields
    if (
      !username ||
      !email ||
      !password ||
      !idType ||
      !idNumber ||
      !allUserRoles ||
      !personalDetails ||
      !taxNumber ||
      !joinDate ||
      active === undefined ||
      onDuty === undefined ||
      !vacationDaysPerYear ||
      !business
    ) {
      return new NextResponse(
        JSON.stringify({ message: "Missing required fields" }),
        { status: 400 }
      );
    }

    // connect before first call to DB
    await connectDB();

    // check for duplicates username, email, taxNumber and idNumber with same business ID
    const duplicateUser: IUser | null = await User.findOne({
      business,
      $or: [{ username }, { email }, { taxNumber }, { idNumber }],
    }).lean();

    if (duplicateUser) {
      if (duplicateUser.active === true) {
        return new NextResponse(
          JSON.stringify({
            message:
              "Username, email, taxNumber or idNumber already exists in an active user!",
          }),
          { status: 409 }
        );
      } else {
        return new NextResponse(
          JSON.stringify({
            message:
              "Username, email, taxNumber or idNumber already exists in an unactive user!",
          }),
          { status: 409 }
        );
      }
    }

    // check address validation
    if (address) {
      const checkAddressValidation = addressValidation(address);
      if (checkAddressValidation !== true) {
        return new NextResponse(
          JSON.stringify({ message: checkAddressValidation }),
          { status: 400 }
        );
      }
    }

    // check personalDetails validation
    const checkPersonalDetailsValidation =
      personalDetailsValidation(personalDetails);
    if (checkPersonalDetailsValidation !== true) {
      return new NextResponse(
        JSON.stringify({ message: checkPersonalDetailsValidation }),
        { status: 400 }
      );
    }

    // create user object with required fields
    const userObj = {
      username,
      email,
      password: await hash(password, 10),
      idType,
      idNumber,
      allUserRoles,
      personalDetails: personalDetails,
      taxNumber,
      joinDate,
      active,
      onDuty,
      vacationDaysPerYear,
      business,
      address: address || undefined,
      photo: photo || "../public/images/avatar.png",
      contractHoursWeek: contractHoursWeek || undefined,
      grossMonthlySalary: grossMonthlySalary || undefined,
      netMonthlySalary: netMonthlySalary || undefined,
      comments: comments || undefined,
    };

    // create user
    await User.create(userObj);

    return new NextResponse(
      JSON.stringify({ message: `New user ${username} created successfully!` }),
      { status: 201 }
    );
  } catch (error: any) {
    return new NextResponse("Failed to create User - Error: " + error, {
      status: 500,
    });
  }
};
