import { Types } from "mongoose";
import connectDb from "@/app/lib/utils/connectDb";
import { IEmployeeSchedule, ISchedule } from "@/app/lib/interface/ISchedule";
import Schedule from "@/app/lib/models/schedule";
import { IUser } from "@/app/lib/interface/IUser";
import User from "@/app/lib/models/user";
import { employeesValidation } from "../../utils/employeesValidation";
import { NextResponse } from "next/server";
import { handleApiError } from "@/app/lib/utils/handleApiError";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";
import isScheduleOverlapping from "../../utils/isScheduleOverlapping";
import getWeekdaysInMonth from "../../utils/getWeekDaysInMonth";

// @desc    Create new schedules
// @route   POST /schedules/:schedulesId/addEmployeeToSchedule
// @access  Private
export const POST = async (
  req: Request,
  context: { params: { scheduleId: Types.ObjectId } }
) => {
  try {
    const { employeeSchedule } = (await req.json()) as {
      employeeSchedule: IEmployeeSchedule;
    };

    const scheduleId = context.params.scheduleId;

    const { userId, role, timeRange, vacation } = employeeSchedule;
    const startTime = new Date(timeRange.startTime);
    const endTime = new Date(timeRange.endTime);

    // check if the schedule ID is valid
    if (isObjectIdValid([scheduleId]) !== true) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid schedule Id!" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // validate employee object
    const validEmployees = employeesValidation(employeeSchedule);
    if (validEmployees !== true) {
      return new NextResponse(JSON.stringify({ message: validEmployees }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // connect before first call to DB
    await connectDb();

    // check if the schedule exists
    const schedule: ISchedule | null = await Schedule.findById(scheduleId)
      .select(
        "employeesSchedules.userId employeesSchedules.vacation employeesSchedules.timeRange weekNumber businessId totalDayEmployeesCost totalEmployeesScheduled"
      )
      .lean();

    if (!schedule) {
      return new NextResponse(
        JSON.stringify({ message: "Schedule not found!" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // create on object for each schedule with start and end time
    let timeRangeArr: any[] = [];

    if (
      Array.isArray(schedule.employeesSchedules) &&
      schedule.employeesSchedules.length > 0
    ) {
      timeRangeArr = schedule.employeesSchedules
        .filter((el) => el.userId.toString() === userId.toString()) // Filter by userId
        .map((el) => {
          return {
            startTime: el.timeRange.startTime,
            endTime: el.timeRange.endTime,
          };
        });
    }

    // the new schedule should not start or end inside an already scheduled shift
    if (timeRangeArr.length > 0) {
      if (isScheduleOverlapping(startTime, endTime, timeRangeArr) === true) {
        return new NextResponse(
          JSON.stringify({
            message: "Employee scheduled overlaps existing one!",
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // Calculate difference in milliseconds
    const shiftDurationMs = endTime.getTime() - startTime.getTime();

    const userEmployee: IUser | null = await User.findById(userId)
      .select(
        "contractHoursWeek salary.grossSalary salary.payFrequency vacationDaysLeft"
      )
      .lean();

    if (!userEmployee) {
      return new NextResponse(JSON.stringify({ message: "User not found!" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Calculate employee cost based on pay frequency
    let employeeCost; // Convert ms to hours

    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth();
    const weekdaysInMonth = getWeekdaysInMonth(currentYear, currentMonth);

    switch (userEmployee.salary && userEmployee.salary.payFrequency) {
      case "Monthly":
        employeeCost =
          userEmployee.salary &&
          userEmployee.salary.grossSalary / weekdaysInMonth;
        break;
      case "Weekly":
        employeeCost =
          userEmployee.salary && userEmployee.salary.grossSalary / 5; // Assuming 5 working days in a week
        break;
      case "Daily":
        employeeCost = userEmployee.salary && userEmployee.salary.grossSalary;
        break;
      default:
        employeeCost =
          userEmployee.salary &&
          userEmployee.salary.grossSalary * (shiftDurationMs / 3600000);
        break;
    }

    // prepare the user schedule update object
    const updateUserSchedule = {
      userId,
      role,
      timeRange: {
        startTime,
        endTime,
      },
      vacation: vacation !== undefined ? vacation : false,
      shiftHours: shiftDurationMs,
      employeeCost,
    };

    // Update the user's schedule and the schedule's total cost in a single operation
    const totalEmployeesScheduledIncrement = schedule.employeesSchedules.some(
      (e) => e.userId.toString() === userId.toString()
    )
      ? 0
      : 1;

    await Schedule.findByIdAndUpdate(
      scheduleId,
      {
        $push: { employeesSchedules: updateUserSchedule },
        $inc: {
          totalDayEmployeesCost: updateUserSchedule.employeeCost,
          totalEmployeesScheduled: totalEmployeesScheduledIncrement,
        },
      },
      { new: true }
    );

    if (vacation) {
      await User.findByIdAndUpdate(
        userId,
        { $inc: { vacationDaysLeft: -1 } },
        { new: true }
      );
    }

    return new NextResponse(
      JSON.stringify({ message: "Employee added to schedule!" }),
      { status: 201, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return handleApiError("Adding employee to schedule failed!", error);
  }
};
