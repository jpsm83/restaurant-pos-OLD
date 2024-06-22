import { Types } from "mongoose";
import { NextResponse } from "next/server";
import connectDB from "@/app/lib/db";
import { IEmployee, ISchedule } from "@/app/lib/interface/ISchedule";
import Schedule from "@/app/lib/models/schedule";
import { IUser } from "@/app/lib/interface/IUser";
import User from "@/app/lib/models/user";
import { handleApiError } from "@/app/utils/handleApiError";
import { employeesValidation } from "./employeesValidation";

export const addEmployeeToSchedule = async (
  scheduleId: Types.ObjectId,
  employeeSchedule: IEmployee
) => {
  try {
    // check if the schedule ID is valid
    if (!scheduleId || !Types.ObjectId.isValid(scheduleId)) {
      return new NextResponse("Invalid schedule Id!", {
        status: 400,
      });
    }

    // validate employee object
    const validEmployees = employeesValidation(employeeSchedule);
    if (validEmployees !== true) {
      return new NextResponse(validEmployees, {
        status: 400,
      });
    }

    // connect before first call to DB
    await connectDB();

    // check if the schedule exists
    const schedule: ISchedule | null = await Schedule.findById(scheduleId)
      .select(
        "employees.userId employees.vacation employees.shiftHours employees.weekHoursLeft weekNumber"
      )
      .lean();

    if (!schedule) {
      return new NextResponse("Schedule not found!", {
        status: 404,
      });
    }

    const userId = employeeSchedule.userId;
    const role = employeeSchedule.role;
    const startTime = new Date(employeeSchedule.timeRange.startTime);
    const endTime = new Date(employeeSchedule.timeRange.endTime);
    const vacation = employeeSchedule.vacation;

    // Calculate difference in milliseconds, then convert to hours
    const differenceInHours =
      (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);

    const userEmployee: IUser | null = await User.findById(userId)
      .select("contractHoursWeek grossHourlySalary vacationDaysLeft")
      .lean();

    const employeeScheduleOnTheWeek: ISchedule[] | any[] = await Schedule.find({
      weekNumber: schedule.weekNumber,
      "employees.userId": { $in: [userId] },
    })
      .select(
        "_id employees.userId employees.weekHoursLeft employees.shiftHours date"
      )
      .lean();

    let weekHoursLeft;
    let totalScheduleWeekHours = differenceInHours;
    const updates: { scheduleId: Types.ObjectId; userId: Types.ObjectId }[] =
      [];

    if (
      employeeScheduleOnTheWeek !== null &&
      employeeScheduleOnTheWeek.length > 0
    ) {
      employeeScheduleOnTheWeek.forEach((schedule) => {
        schedule.employees.forEach(
          (user: { userId: Types.ObjectId; shiftHours: number }) => {
            if (user.userId == userId) {
              totalScheduleWeekHours += user.shiftHours;
              updates.push({ scheduleId: schedule._id, userId: userId });
            }
          }
        );
      });
      weekHoursLeft =
        (userEmployee?.contractHoursWeek ?? 0) - totalScheduleWeekHours;
    } else {
      weekHoursLeft =
        (userEmployee?.contractHoursWeek ?? 0) - differenceInHours;
    }

    if (updates.length > 0) {
      for (const update of updates) {
        await Schedule.findByIdAndUpdate(
          update.scheduleId,
          { $set: { "employees.$[elem].weekHoursLeft": weekHoursLeft } },
          {
            new: true,
            arrayFilters: [{ "elem.userId": update.userId }], // Specify the filter condition for the array
          }
        );
      }
    }

    if (vacation) {
      await User.findByIdAndUpdate(
        userId,
        { $inc: { vacationDaysLeft: -1 } },
        { new: true, useFindAndModify: false }
      );
    }

    const hourlySalary = userEmployee?.grossHourlySalary ?? 0;
    const employeeCost = hourlySalary * differenceInHours;

    const employeeToAdd = {
      userId: userId,
      role: role,
      timeRange: {
        startTime: startTime,
        endTime: endTime,
      },
      vacation: vacation,
      shiftHours: differenceInHours,
      weekHoursLeft,
      employeeCost,
    };

    await Schedule.findByIdAndUpdate(
      scheduleId,
      {
        $push: { employees: employeeToAdd },
        $inc: {
          totalEmployeesScheduled: 1,
          totalDayEmployeesCost: employeeCost,
        },
      },
      { new: true, useFindAndModify: false }
    );
  } catch (error) {
    return handleApiError("Adding employee to schedule failed!", error);
  }
};
