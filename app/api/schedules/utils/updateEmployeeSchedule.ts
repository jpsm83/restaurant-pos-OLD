import { Types } from "mongoose";
import connectDB from "@/app/lib/db";
import { IEmployee, ISchedule } from "@/app/lib/interface/ISchedule";
import Schedule from "@/app/lib/models/schedule";
import { IUser } from "@/app/lib/interface/IUser";
import User from "@/app/lib/models/user";
import { employeesValidation } from "./employeesValidation";

export const updateEmployeeSchedule = async (
  scheduleId: Types.ObjectId,
  employeeSchedule: IEmployee
) => {
  try {
    // check if the schedule ID is valid
    if (!scheduleId || !Types.ObjectId.isValid(scheduleId)) {
      return "Invalid schedule Id!";
    }

    // check if the user ID is valid
    if (
      !employeeSchedule.userId ||
      !Types.ObjectId.isValid(employeeSchedule.userId)
    ) {
      return "Invalid user Id!";
    }

    // validate employee object
    const validEmployees = employeesValidation(employeeSchedule);
    if (validEmployees !== true) {
      return validEmployees;
    }

    // connect before first call to DB
    await connectDB();

    // check if the schedule exists
    const schedule: ISchedule | null = await Schedule.findById(scheduleId)
      .select(
        "employees.userId employees.vacation employees.shiftHours employees.weekHoursLeft employees.employeeCost employees.timeRange weekNumber totalDayEmployeesCost"
      )
      .lean();

    if (!schedule) {
      return "Schedule not found!";
    }

    const employeeScheduleToUpdate: IEmployee | null =
      schedule.employees.find(
        (emp: { userId: Types.ObjectId }) =>
          emp.userId == employeeSchedule.userId
      ) || null;

    const userId = employeeSchedule?.userId;
    const role = employeeSchedule?.role;
    const startTime = employeeSchedule?.timeRange.startTime
      ? new Date(employeeSchedule.timeRange.startTime)
      : new Date();
    const endTime = employeeSchedule?.timeRange.endTime
      ? new Date(employeeSchedule.timeRange.endTime)
      : new Date();
    const vacation = employeeSchedule?.vacation;

    // Calculate difference in milliseconds, then convert to hours
    const differenceInHours =
      (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);

      const userEmployee: IUser | null = await User.findById(userId)
      .select("contractHoursWeek grossHourlySalary vacationDaysLeft")
      .lean();

    const employeeScheduleOnTheWeek: ISchedule[] | any[] = await Schedule.find({
      _id: { $ne: scheduleId },
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
    const newEmployeeCost = hourlySalary * differenceInHours;
    const newTotalDayEmployeesCost = schedule.employees.reduce((acc, emp) => acc + emp.employeeCost, 0) - (employeeScheduleToUpdate?.employeeCost ?? 0) + newEmployeeCost;

    const employeeToUpdate = {
      userId: userId,
      role: role,
      timeRange: {
        startTime: startTime,
        endTime: endTime,
      },
      vacation: vacation,
      shiftHours: differenceInHours,
      weekHoursLeft,
      employeeCost: newEmployeeCost,
    };

    await Schedule.findByIdAndUpdate(
      scheduleId,
      {
        $set: {
          "employees.$[elem]": employeeToUpdate, // Correctly replaces the entire matching employee object
          totalDayEmployeesCost: newTotalDayEmployeesCost // Moved inside the $set object
        }
      },      {
        new: true,
        arrayFilters: [{ "elem.userId": userId }], // Ensure this correctly identifies the employee
      }
    );
    return "Employee schedule updated!";
  } catch (error) {
    return "Updating employee to schedule failed!" + error;
  }
};
