import { NextResponse } from "next/server";
import { hash } from "bcrypt";

// imported utils
import connectDb from "@/app/lib/utils/connectDb";

// imported interfaces
import { IUser } from "@/app/lib/interface/IUser";
import { personalDetailsValidation } from "./utils/personalDetailsValidation";
import { addressValidation } from "@/app/lib/utils/addressValidation";
import { handleApiError } from "@/app/lib/utils/handleApiError";
import { calculateVacationProportional } from "./utils/calculateVacationProportional";

// imported models
import User from "@/app/lib/models/user";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";
import salaryValidation from "./utils/salaryValidation";

// @desc    Get all users
// @route   GET /users
// @access  Private
export const GET = async (req: Request) => {
  try {
    // connect before first call to DB
    await connectDb();

    const users = await User.find().select("-password").lean();

    return !users?.length
      ? new NextResponse(JSON.stringify({ message: "No users found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        })
      : new NextResponse(JSON.stringify(users), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        });
  } catch (error) {
    return handleApiError("Get all users failed!", error);
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
      businessId,
      address,
      contractHoursWeek,
      salary,
      comments,
    } = (await req.json()) as IUser;

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
      !businessId
    ) {
      return new NextResponse(
        JSON.stringify({
          message:
            "Username, email, password, idType, idNumber, allUserRoles, personalDetails, taxNumber, joinDate and businessId are required fields!",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // validate businessId
    if (isObjectIdValid([businessId]) !== true) {
      return new NextResponse(
        JSON.stringify({ message: "Business ID is not valid!" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

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

    // check personalDetails validation
    const checkPersonalDetailsValidation =
      personalDetailsValidation(personalDetails);
    if (checkPersonalDetailsValidation !== true) {
      return new NextResponse(
        JSON.stringify({ message: checkPersonalDetailsValidation }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    //if salary, validate fields
    if (salary) {
      const salaryValidationResult = salaryValidation(salary);
      if (salaryValidationResult !== true) {
        return new NextResponse(
          JSON.stringify({ message: salaryValidationResult }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // connect before first call to DB
    await connectDb();

    // check for duplicates username, email, taxNumber and idNumber with same businessId ID
    const duplicateUser: IUser | null = await User.findOne({
      businessId,
      $or: [{ username }, { email }, { taxNumber }, { idNumber }],
    }).lean();

    if (duplicateUser) {
      const message = duplicateUser.active
        ? "Username, email, taxNumber, or idNumber already exists and user is active!"
        : "Username, email, taxNumber, or idNumber already exists in an inactive user!";

      return new NextResponse(JSON.stringify({ message }), {
        status: 409,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Hash password asynchronously
    const hashedPassword = await hash(password, 10);

    // Calculate vacation days if provided
    const vacationDaysLeft = vacationDaysPerYear
      ? calculateVacationProportional(new Date(joinDate), vacationDaysPerYear)
      : 0;

    // Create the user object
    const newUser = {
      username,
      email,
      password: hashedPassword,
      idType,
      idNumber,
      allUserRoles, // array
      personalDetails, // object
      taxNumber,
      joinDate,
      active,
      onDuty,
      vacationDaysPerYear: vacationDaysPerYear || 0,
      vacationDaysLeft,
      businessId,
      address: address || undefined, // object
      contractHoursWeek: contractHoursWeek || undefined,
      salary: salary || undefined, // object
      comments: comments || undefined,
    };

    // create user
    await User.create(newUser);

    return new NextResponse(
      JSON.stringify({ message: `New user ${username} created successfully!` }),
      {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return handleApiError("Create user failed!", error);
  }
};
