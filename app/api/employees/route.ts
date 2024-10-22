import { NextResponse } from "next/server";
import { hash } from "bcrypt";

// imported utils
import connectDb from "@/app/lib/utils/connectDb";

// imported interfaces
import { IEmployee } from "@/app/lib/interface/IEmployee";
import { personalDetailsValidation } from "./utils/personalDetailsValidation";
import { addressValidation } from "@/app/lib/utils/addressValidation";
import { handleApiError } from "@/app/lib/utils/handleApiError";
import { calculateVacationProportional } from "./utils/calculateVacationProportional";

// imported models
import Employee from "@/app/lib/models/employee";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";
import salaryValidation from "./utils/salaryValidation";

// @desc    Get all employees
// @route   GET /employees
// @access  Private
export const GET = async (req: Request) => {
  try {
    // connect before first call to DB
    await connectDb();

    const employees = await Employee.find().select("-password").lean();

    return !employees?.length
      ? new NextResponse(JSON.stringify({ message: "No employees found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        })
      : new NextResponse(JSON.stringify(employees), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        });
  } catch (error) {
    return handleApiError("Get all employees failed!", error);
  }
};

// @desc    Create new employee
// @route   POST /employees
// @access  Private
export const POST = async (req: Request) => {
  try {
    const {
      employeeName,
      email,
      password,
      idType,
      idNumber,
      allEmployeeRoles,
      personalDetails,
      taxNumber,
      joinDate,
      active,
      onDuty,
      vacationDaysPerYear,
      businessId,
      address,
      contractHoursWeek, // in milliseconds
      salary,
      comments,
    } = (await req.json()) as IEmployee;

    // check required fields
    if (
      !employeeName ||
      !email ||
      !password ||
      !idType ||
      !idNumber ||
      !allEmployeeRoles ||
      !personalDetails ||
      !taxNumber ||
      !joinDate ||
      !businessId
    ) {
      return new NextResponse(
        JSON.stringify({
          message:
            "EmployeeName, email, password, idType, idNumber, allEmployeeRoles, personalDetails, taxNumber, joinDate and businessId are required fields!",
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

    // check for duplicates employeeName, email, taxNumber and idNumber with same businessId ID
    const duplicateEmployee: IEmployee | null = await Employee.findOne({
      businessId,
      $or: [{ employeeName }, { email }, { taxNumber }, { idNumber }],
    }).lean();

    if (duplicateEmployee) {
      const message = duplicateEmployee.active
        ? "EmployeeName, email, taxNumber, or idNumber already exists and employee is active!"
        : "EmployeeName, email, taxNumber, or idNumber already exists in an inactive employee!";

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

    // convert hours to milliseconds
    // employee might input the contract hours per week as a whole hour number on the front of the application and them it will be converted to milliseconds
    let contractHoursWeekMls;
    if (contractHoursWeek) {
      contractHoursWeekMls = contractHoursWeek * 3600000;
    }

    // Create the employee object
    const newEmployee = {
      employeeName,
      email,
      password: hashedPassword,
      idType,
      idNumber,
      allEmployeeRoles, // array
      personalDetails, // object
      taxNumber,
      joinDate,
      active,
      onDuty,
      vacationDaysPerYear: vacationDaysPerYear || 0,
      vacationDaysLeft,
      businessId,
      address: address || undefined, // object
      contractHoursWeek: contractHoursWeekMls || undefined, // in milliseconds
      salary: salary || undefined, // object
      comments: comments || undefined,
    };

    // create employee
    await Employee.create(newEmployee);

    return new NextResponse(
      JSON.stringify({
        message: `New employee ${employeeName} created successfully!`,
      }),
      {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return handleApiError("Create employee failed!", error);
  }
};
