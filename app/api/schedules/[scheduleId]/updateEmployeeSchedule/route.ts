import { Types } from "mongoose";
import connectDb from "@/app/lib/utils/connectDb";
import { IEmployeeSchedule, ISchedule } from "@/app/lib/interface/ISchedule";
import Schedule from "@/app/lib/models/schedule";
import User from "@/app/lib/models/user";
import { employeesValidation } from "../../utils/employeesValidation";
import { getWeekNumber } from "../../utils/getWeekNumber";
import { NextResponse } from "next/server";
import { handleApiError } from "@/app/lib/utils/handleApiError";

// @desc    Create new schedules
// @route   POST /schedules/:schedulesId/updateEmployeeSchedule
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

    // check if the scheduleId is valid
    if (!scheduleId || !Types.ObjectId.isValid(scheduleId)) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid scheduleId Id!" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // check if the userId is valid
    if (
      !employeeSchedule.userId ||
      !Types.ObjectId.isValid(employeeSchedule.userId)
    ) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid userId Id!" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // check if the userScheduleId is valid
    if (
      !employeeSchedule._id ||
      !Types.ObjectId.isValid(employeeSchedule.userId)
    ) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid userScheduleId Id!" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // validate employee object
    const validEmployees = employeesValidation(employeeSchedule);
    if (validEmployees !== true) {
      return validEmployees;
    }

    const weekNumber = getWeekNumber(
      new Date(employeeSchedule.timeRange.startTime)
    );

    // connect before first call to DB
    await connectDb();

    // get all schedules from the week where user is scheduled
    const employeeScheduleOnTheWeek: ISchedule[] | any[] = await Schedule.find({
      weekNumber: weekNumber,
      employees: {
        $elemMatch: {
          userId: { $in: [employeeSchedule.userId] },
        },
      },
    }).lean();

    // employeeScheduleOnTheWeek is an array of schedules
    let employeeScheduleToUpdate: IEmployeeSchedule | null = null;
    let scheduleToUpdateId: Types.ObjectId | null = null;

    // Iterate over each schedule to find the employee
    for (const schedule of employeeScheduleOnTheWeek) {
      employeeScheduleToUpdate = schedule.employees.find(
        (emp: { userId: Types.ObjectId; _id: Types.ObjectId }) =>
          emp.userId == employeeSchedule.userId &&
          emp._id == employeeSchedule._id
      );
      scheduleToUpdateId = schedule._id;
      // If the employee is found, break the loop
      if (employeeScheduleToUpdate) break;
    }

    if (!employeeScheduleToUpdate) {
      return new NextResponse(
        JSON.stringify({ message: "Employee not found in schedule!" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // calculate the new difference in hours
    const startTime =
      new Date(employeeSchedule?.timeRange.startTime) ||
      new Date(employeeScheduleToUpdate.timeRange.startTime);
    const endTime =
      new Date(employeeSchedule?.timeRange.endTime) ||
      new Date(employeeScheduleToUpdate.timeRange.endTime);

    const differenceInHours =
      (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);

    // calculate the new week hours left
    const employeeCostPerHour =
      (employeeScheduleToUpdate.employeeCost ?? 0) /
      (employeeScheduleToUpdate.shiftHours ?? 0);

    // create updated employee schedule
    let updatedUserSchedule = {
      role: employeeSchedule.role || employeeScheduleToUpdate.role,
      timeRange: {
        startTime: startTime,
        endTime: endTime,
      },
      vacation: employeeSchedule.vacation || employeeScheduleToUpdate.vacation,
      shiftHours: differenceInHours,
      employeeCost: differenceInHours * employeeCostPerHour || 0,
    };

    // update user vacation days left if the employee is on vacation
    if (employeeSchedule.vacation) {
      await User.findByIdAndUpdate(
        { _id: employeeSchedule.userId },
        { $inc: { vacationDaysLeft: -1 } },
        { new: true }
      );
    }

    await Schedule.updateOne(
      {
        _id: scheduleToUpdateId,
        "employees._id": employeeScheduleToUpdate._id,
      },
      {
        $set: {
          "employees.$[elem].role": updatedUserSchedule.role,
          "employees.$[elem].timeRange.startTime":
            updatedUserSchedule.timeRange.startTime,
          "employees.$[elem].timeRange.endTime":
            updatedUserSchedule.timeRange.endTime,
          "employees.$[elem].vacation": updatedUserSchedule.vacation,
          "employees.$[elem].shiftHours": updatedUserSchedule.shiftHours,
          "employees.$[elem].employeeCost": updatedUserSchedule.employeeCost,
        },
      },
      {
        arrayFilters: [{ "elem._id": employeeScheduleToUpdate._id }],
        new: true,
      }
    );
    return new NextResponse(
      JSON.stringify({ message: "Employee schedule updated!" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return handleApiError("Updating employee to schedule failed!", error);
  }
};
