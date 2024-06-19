import connectDB from "@/lib/db";
import { NextResponse } from "next/server";

// imported models
import Schedule from "@/lib/models/schedule";
import { Types } from "mongoose";
import { ISchedule } from "@/app/interface/ISchedule";
import { employeesValidation } from "../utils/employeesValidation";

// @desc    Get schedule by ID
// @route   GET /schedules/:scheduleId
// @access  Public
export const getScheduleById = async (context: { params: any }) => {
  try {
    const scheduleId = context.params.scheduleId;
    // check if the schedule ID is valid
    if (!scheduleId || !Types.ObjectId.isValid(scheduleId)) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid schedule ID" }),
        {
          status: 400,
        }
      );
    }

    // connect before first call to DB
    await connectDB();

    const schedule = await Schedule.findById(scheduleId)
      .populate("employees.employee", "username allUserRoles")
      .lean();

    return !schedule
      ? new NextResponse(JSON.stringify({ message: "No schedule found" }), {
          status: 404,
        })
      : new NextResponse(JSON.stringify(schedule), { status: 200 });
  } catch (error: any) {
    return new NextResponse("Error: " + error, { status: 500 });
  }
};

// @desc    Update a schedule
// @route   PATCH /schedules/:scheduleId
// @access  Private
export const updateSchedule = async (
  req: Request,
  context: { params: any }
) => {
  try {
    const scheduleId = context.params.scheduleId;
    // check if the schedule ID is valid
    if (!scheduleId || !Types.ObjectId.isValid(scheduleId)) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid schedule ID" }),
        {
          status: 400,
        }
      );
    }

    const {
      employees,
      totalEmployeesScheduled,
      totalDayEmployeesCost,
      comments,
    } = req.body as unknown as ISchedule;

    // connect before first call to DB
    await connectDB();

    // check if the schedule exists
    const schedule: ISchedule | null = await Schedule.findById(
      scheduleId
    ).lean();
    if (!schedule) {
      return new NextResponse(
        JSON.stringify({ message: "Schedule not found" }),
        {
          status: 404,
        }
      );
    }

    // prepare update object
    const updateObj = {
      employees: schedule.employees,
      totalEmployeesScheduled:
        employees.length || schedule.totalEmployeesScheduled,
      totalDayEmployeesCost:
        totalDayEmployeesCost || schedule.totalDayEmployeesCost,
      comments: comments || schedule.comments,
    };

    // validate employees object
    if (employees) {
      const validEmployees = employeesValidation(employees);
      if (validEmployees === true) {
        updateObj.employees = employees;
      } else {
        return new NextResponse(JSON.stringify({ message: validEmployees }), {
          status: 400,
        });
      }
    }

    // update schedule or delete it if no employees are scheduled
    if (!employees || employees.length === 0) {
      await Schedule.deleteOne({ _id: scheduleId });
      return new NextResponse(
        JSON.stringify({
          message: `Schedule ${schedule.date} deleted because it has no employees!`,
        }),
        { status: 200 }
      );
    } else {
      const updatedSchedule: ISchedule | null =
        await Schedule.findByIdAndUpdate({ _id: scheduleId }, updateObj, {
          new: true,
          usefindAndModify: false,
        }).lean();
      return updatedSchedule
        ? new NextResponse(
            JSON.stringify({
              message: `Schedule ${updatedSchedule.date} updated`,
            }),
            { status: 200 }
          )
        : new NextResponse(
            JSON.stringify({ message: "Schedule could not be updated" }),
            { status: 400 }
          );
    }
  } catch (error: any) {
    return new NextResponse("Error: " + error, { status: 500 });
  }
};

// @desc    Delete a schedule
// @route   DELETE /schedules/:scheduleId
// @access  Private
export const deleteSchedule = async (context: { params: any }) => {
  try {
    const scheduleId = context.params.scheduleId;
    // check if the schedule ID is valid
    if (!scheduleId || !Types.ObjectId.isValid(scheduleId)) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid schedule ID" }),
        {
          status: 400,
        }
      );
    }

    // connect before first call to DB
    await connectDB();

    // delete schedule and check if it existed
    const result = await Schedule.deleteOne({ _id: scheduleId });

    if (result.deletedCount === 0) {
      return new NextResponse(
        JSON.stringify({ message: "Schedule not found" }),
        { status: 404 }
      );
    }

    return new NextResponse(
      JSON.stringify({ message: `Schedule ${scheduleId} deleted!` }),
      { status: 200 }
    );
  } catch (error: any) {
    return new NextResponse("Error: " + error, { status: 500 });
  }
};
