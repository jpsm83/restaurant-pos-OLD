import connectDB from "@/lib/db";
import { NextResponse } from "next/server";

// imported models
import Schedule from "@/lib/models/schedule";
import { ISchedule } from "@/app/interface/ISchedule";
import { employeesValidation } from "./utils/employeesValidation";

// @desc    Get all schedules
// @route   GET /schedules
// @access  Public
export const getSchedules = async () => {
  try {
    // connect before first call to DB
    await connectDB();

    const schedules = await Schedule.find()
      .populate("employees.employee", "username allUserRoles")
      .lean();

    return !schedules.length
      ? new NextResponse(JSON.stringify({ message: "No schedules found" }), {
          status: 404,
        })
      : new NextResponse(JSON.stringify(schedules), { status: 200 });
  } catch (error: any) {
    return new NextResponse("Error: " + error, { status: 500 });
  }
};

// @desc    Create a new schedule
// @route   POST /schedules
// @access  Private
export const createSchedule = async (req: Request) => {
  try {
    const { date, employees, totalDayEmployeesCost, business, comments } =
      req.body as unknown as ISchedule;

    // check required fields
    if (!date || !employees || !totalDayEmployeesCost || !business) {
      return new NextResponse(
        JSON.stringify({
          message:
            "Date, employees, totalDayEmployeesCost and business are required fields",
        }),
        { status: 400 }
      );
    }

    // connect before first call to DB
    await connectDB();

    // check if schedule already exists
    const duplicateSchedule = await Schedule.findOne({ date, business }).lean();
    if (duplicateSchedule) {
      return new NextResponse(
        JSON.stringify({
          message: `Schedule for ${date} already exists for business ${business}`,
        }),
        { status: 409 }
      );
    }

    // create schedule object
    const scheduleObj: ISchedule = {
      date,
      employees: [],
      totalEmployeesScheduled: employees.length,
      totalDayEmployeesCost,
      business,
      comments: comments || undefined,
    };

    // validate employee object
    const validEmployees = employeesValidation(employees);
    if (validEmployees === true) {
      scheduleObj.employees = employees;
    } else {
      return new NextResponse(JSON.stringify({ message: validEmployees }), {
        status: 400,
      });
    }

    // create new schedule
    const newSchedule = await Schedule.create(scheduleObj);

    return newSchedule
      ? new NextResponse(
          JSON.stringify({ message: `Schedule ${newSchedule._id} created` }),
          { status: 201 }
        )
      : new NextResponse(
          JSON.stringify({ message: "Schedule could not be created" }),
          { status: 400 }
        );
  } catch (error: any) {
    return new NextResponse("Error: " + error, { status: 500 });
  }
};
