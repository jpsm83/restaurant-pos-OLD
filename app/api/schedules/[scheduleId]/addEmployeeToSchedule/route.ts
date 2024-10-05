import { Types } from "mongoose";
import { NextResponse } from "next/server";

// imported utils
import connectDb from "@/app/lib/utils/connectDb";
import { handleApiError } from "@/app/lib/utils/handleApiError";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";
import { employeesValidation } from "../../utils/employeesValidation";
import isScheduleOverlapping from "../../utils/isScheduleOverlapping";
import getWeekdaysInMonth from "../../utils/getWeekDaysInMonth";
import calculateEmployeeCost from "../../utils/calculateEmployeeCost";

// imported interfaces
import { IUser } from "@/app/lib/interface/IUser";
import { IEmployeeSchedule, ISchedule } from "@/app/lib/interface/ISchedule";

// imported models
import Schedule from "@/app/lib/models/schedule";
import User from "@/app/lib/models/user";

// @desc    Create new schedules
// @route   PATCH /schedules/:schedulesId/addEmployeeToSchedule
// @access  Private
export const PATCH = async (
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
        "employeesSchedules.userId employeesSchedules.vacation employeesSchedules._id totalDayEmployeesCost totalEmployeesScheduled totalEmployeesVacation"
      )
      .lean();

    if (!schedule) {
      return new NextResponse(
        JSON.stringify({ message: "Schedule not found!" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // check if the employee is already in the schedule
    const employeeAlreadyScheduled = schedule.employeesSchedules.find(
      (emp) => emp.userId === userId
    );

    if (vacation && employeeAlreadyScheduled) {
      if (employeeAlreadyScheduled.vacation) {
        return new NextResponse(
          JSON.stringify({ message: "Employee already on vacation!" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
      return new NextResponse(
        JSON.stringify({ message: "Employee already scheduled!" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // create on object for each schedule with start and end time
    const timeRangeArr = schedule.employeesSchedules
      .filter((el) => el.userId === userId)
      .map((el) => ({
        startTime: el.timeRange.startTime,
        endTime: el.timeRange.endTime,
      }));

    // the new schedule should not start or end inside an already scheduled shift
    if (timeRangeArr.length > 0) {
      if (isScheduleOverlapping(startTime, endTime, timeRangeArr)) {
        return new NextResponse(
          JSON.stringify({
            message: "Employee scheduled overlaps existing one!",
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    const userEmployee: IUser | null = await User.findById(userId)
      .select("salary")
      .lean();

    if (!userEmployee) {
      return new NextResponse(JSON.stringify({ message: "User not found!" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Calculate difference in milliseconds
    const shiftDurationMs = endTime.getTime() - startTime.getTime();
    const weekdaysInMonth = getWeekdaysInMonth(
      new Date().getFullYear(),
      new Date().getMonth()
    );
    let employeeCost = 0;

    if (userEmployee?.salary) {
      employeeCost = calculateEmployeeCost(
        userEmployee.salary,
        shiftDurationMs,
        weekdaysInMonth
      );
    }

    // prepare the user schedule update object
    const addUserSchedule = {
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

    // Update the schedule and user in a single operation
    const totalEmployeesScheduledIncrement = employeeAlreadyScheduled ? 0 : 1;

    const updatedSchedule = await Schedule.findByIdAndUpdate(
      scheduleId,
      {
        $push: { employeesSchedules: addUserSchedule },
        $inc: {
          totalDayEmployeesCost: employeeCost,
          totalEmployeesScheduled: vacation
            ? 0
            : totalEmployeesScheduledIncrement,
          totalEmployeesVacation: vacation ? 1 : 0,
        },
      },
      { new: true }
    );

    if (updatedSchedule && vacation) {
      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { $inc: { vacationDaysLeft: -1 } },
        { new: true }
      );

      if (!updatedUser) {
        return new NextResponse(
          JSON.stringify({
            message:
              "Update user vacation days left failed upon adding user to schedule!",
          }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    return new NextResponse(
      JSON.stringify({ message: "Employee added to schedule!" }),
      { status: 201, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return handleApiError("Adding employee to schedule failed!", error);
  }
};
