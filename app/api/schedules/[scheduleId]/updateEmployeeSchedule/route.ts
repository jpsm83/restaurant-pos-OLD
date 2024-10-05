import mongoose, { Types } from "mongoose";
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
// @route   PATCH /schedules/:schedulesId/updateEmployeeSchedule
// @access  Private
export const PATCH = async (
  req: Request,
  context: { params: { scheduleId: Types.ObjectId } }
) => {
  // Start a session to handle transactions
  // with session if any error occurs, the transaction will be aborted
  // session is created outside of the try block to be able to abort it in the catch/finally block
  const session = await mongoose.startSession();
  session.startTransaction();

  if (!session) {
    return new NextResponse(
      JSON.stringify({ message: "Failed to start session for transaction" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  try {
    const { employeeSchedule, userScheduleId } = (await req.json()) as {
      employeeSchedule: IEmployeeSchedule;
      userScheduleId: Types.ObjectId;
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

    // Fetch schedule and user data concurrently
    const [schedule, user] = await Promise.all([
      Schedule.findById(scheduleId)
        .select(
          "employeesSchedules._id employeesSchedules.userId employeesSchedules.vacation employeesSchedules.timeRange"
        )
        .lean<ISchedule | null>(),
      User.findById(userId)
        .select("salary.grossSalary salary.payFrequency")
        .lean<IUser | null>(),
    ]);

    if (!schedule) {
      return new NextResponse(
        JSON.stringify({
          message: "Schedule not found!",
        }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!user) {
      return new NextResponse(
        JSON.stringify({
          message: "User not found!",
        }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // Find the specific employee schedule to update
    const employeeScheduleToUpdate = schedule.employeesSchedules.find(
      (empSch) => empSch._id.toString() === userScheduleId.toString()
    );

    if (!employeeScheduleToUpdate) {
      return new NextResponse(
        JSON.stringify({
          message: "Employee schedule not found!",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // check if the employee is scheduled more than once
    const employeeAlreadyScheduled = schedule.employeesSchedules.filter(
      (emp) =>
        emp.userId.toString() === userId.toString() &&
        emp._id.toString() !== userScheduleId.toString()
    );

    // if there are more than one schedule for the employee, it means he cant be on vacation
    if (employeeAlreadyScheduled.length > 0 && vacation) {
      return new NextResponse(
        JSON.stringify({
          message: "Employee has multiple schedules, can't be on vacation!",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // create on object for each schedule with start and end time
    const timeRangeArr = employeeAlreadyScheduled.map((el) => ({
      startTime: new Date(el.timeRange.startTime),
      endTime: new Date(el.timeRange.endTime),
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

    // Calculate difference in milliseconds
    const shiftDurationMs = endTime.getTime() - startTime.getTime();
    const weekdaysInMonth = getWeekdaysInMonth(
      new Date().getFullYear(),
      new Date().getMonth()
    );
    let employeeCost = 0;

    if (user?.salary) {
      employeeCost = calculateEmployeeCost(
        user.salary,
        shiftDurationMs,
        weekdaysInMonth
      );
    }

    // prepare the user schedule update object
    const updateUserSchedule = {
      _id: userScheduleId,
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

    const updatedSchedule = await Schedule.findOneAndUpdate(
      {
        _id: scheduleId,
        "employeesSchedules._id": userScheduleId, // Match the employee schedule by its _id
      },
      {
        $set: { "employeesSchedules.$": updateUserSchedule }, // Use the positional operator to update the matched element
        $inc: {
          totalDayEmployeesCost: employeeCost,
          totalEmployeesScheduled:
            employeeScheduleToUpdate?.vacation && !vacation
              ? 1
              : employeeScheduleToUpdate?.vacation === false && vacation
              ? -1
              : 0,
          totalEmployeesVacation:
            employeeScheduleToUpdate?.vacation && !vacation
              ? -1
              : employeeScheduleToUpdate?.vacation === false && vacation
              ? 1
              : 0,
        },
      },
      { new: true, session }
    );

    if (updatedSchedule) {
      const updatedUser = await User.findByIdAndUpdate(
        userId,
        {
          $inc: {
            vacationDaysLeft:
              employeeScheduleToUpdate?.vacation && !vacation
                ? 1
                : !employeeScheduleToUpdate?.vacation && vacation
                ? -1
                : 0,
          },
        },
        { new: true, session }
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

    // Commit the transaction if both operations succeed
    await session.commitTransaction();
    session.endSession();

    return new NextResponse(
      JSON.stringify({ message: "Employee schedule updated" }),
      { status: 201, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    await session.abortTransaction();
    return handleApiError("Updating employee to schedule failed!", error);
  } finally {
    session.endSession();
  }
};
