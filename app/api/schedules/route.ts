import connectDB from "@/app/lib/db";
import { NextResponse } from "next/server";

// imported models
import Schedule from "@/app/lib/models/schedule";
import { ISchedule } from "@/app/lib/interface/ISchedule";
import { employeesValidation } from "./utils/employeesValidation";
import { handleApiError } from "@/app/utils/handleApiError";
import User from "@/app/lib/models/user";
import { get } from "http";
import { getWeekNumber } from "./utils/getWeekNumber";
import { IUser } from "@/app/lib/interface/IUser";
import { convertToShiftHours } from "./utils/convertToShiftHours";

// @desc    Get all schedules
// @route   GET /schedules
// @access  Public
export const GET = async () => {
  try {
    // connect before first call to DB
    await connectDB();

    const schedules = await Schedule.find()
      .populate("employees.employee", "username allUserRoles")
      .lean();

    return !schedules.length
      ? new NextResponse("No schedules found!", {
          status: 404,
        })
      : new NextResponse(JSON.stringify(schedules), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
  } catch (error) {
    return handleApiError("Get all schedules failed!", error);
  }
};

// @desc    Create a new schedule
// @route   POST /schedules
// @access  Private
export const POST = async (req: Request) => {
  try {
    const { date, employees, business, comments } =
      (await req.json()) as ISchedule;

    // check required fields
    if (!date || !employees || !business) {
      return new NextResponse(
        "Date, employees and business are required fields",
        { status: 400 }
      );
    }

    // validate employee object
    const validEmployees = employeesValidation(employees);
    if (validEmployees !== true) {
      return new NextResponse(validEmployees, {
        status: 400,
      });
    }

    // get the week number
    const weekNumber = getWeekNumber(new Date(date));

    // populate employees array with individual employee calculations
    const employeesPopulationCalculations = employees.map(async (employee) => {
      const startTime = new Date(employee.timeRange.startTime);
      const endTime = new Date(employee.timeRange.endTime);

      // Calculate difference in milliseconds, then convert to hours
      const differenceInHours =
        (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);

      const userEmployee: IUser | null = await User.findById(employee.employee)
        .select("contractHoursWeek grossHourlySalary vacationDaysLeft")
        .lean();

      const employeeScheduleOnTheWeek: ISchedule | any = await Schedule.findOne(
        {
          weekNumber: weekNumber,
          "employees.employee": { $in: [employee.employee] },
        }
      )
        .sort({ date: -1 })
        .select("employees.employee employees.weekHoursLeft")
        .lean(); // Sorting by date in descending order

      let weekHoursLeft = 0;
      if (employeeScheduleOnTheWeek) {
        for (employee of employeeScheduleOnTheWeek.employees) {
          if (employee.employee === employee.employee) {
            weekHoursLeft = employee.weekHoursLeft as number - differenceInHours;
          }
        }
      } else {
        weekHoursLeft =
          (userEmployee?.contractHoursWeek ?? 0) - differenceInHours;
      }
      if (employee.vacation) {
        await User.findByIdAndUpdate(
          employee.employee,
          { $inc: { vacationDaysLeft: -1 } },
          { new: true, useFindAndModify: false }
        );
      }

      const hourlySalary = userEmployee?.grossHourlySalary ?? 0;
      const employeeCost = hourlySalary * differenceInHours;

      return {
        employee: employee.employee,
        role: employee.role,
        timeRange: employee.timeRange,
        vacation: employee.vacation,
        shiftHours: differenceInHours,
        weekHoursLeft,
        employeeCost,
      };
    });

    // Since map returns a promise, we need to resolve all promises
    const populatedEmployees = await Promise.all(
      employeesPopulationCalculations
    );

    // connect before first call to DB
    await connectDB();

    // check if schedule already exists
    const duplicateSchedule = await Schedule.findOne({ date, business });

    if (duplicateSchedule) {
      return new NextResponse(
        `Schedule for ${date} already exists for business ${business}`,
        { status: 409 }
      );
    }

    // create schedule object
    const newSchedule = {
      date,
      weekNumber: weekNumber,
      employees: populatedEmployees,
      totalEmployeesScheduled: populatedEmployees.length,
      totalDayEmployeesCost: populatedEmployees.reduce(
        (acc: number, curr: any) => acc + curr.employeeCost,
        0
      ),
      business,
      comments: comments || undefined,
    };

    // create new schedule
    await Schedule.create(newSchedule);

    return new NextResponse(`Schedule ${newSchedule.date} created!`, {
      status: 201,
    });
  } catch (error) {
    return handleApiError("Create schedule failed!", error);
  }
};
