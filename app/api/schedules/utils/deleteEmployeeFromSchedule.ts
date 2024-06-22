import connectDB from "@/app/lib/db";
import { IEmployee, ISchedule } from "@/app/lib/interface/ISchedule";
import Schedule from "@/app/lib/models/schedule";
import User from "@/app/lib/models/user";
import { Types } from "mongoose";

// delete employee from schedule
export const deleteEmployeeFromSchedule = async (
  scheduleId: Types.ObjectId,
  userId: Types.ObjectId
) => {
  try {
    // check if the schedule ID is valid
    if (!scheduleId || !Types.ObjectId.isValid(scheduleId)) {
      return "Invalid schedule Id!";
    }

    // check if the user ID is valid
    if (!userId || !Types.ObjectId.isValid(userId)) {
      return "Invalid user Id!";
    }

    // connect before first call to DB
    await connectDB();

    // check if the schedule exists
    const schedule: ISchedule | null = await Schedule.findById(scheduleId)
      .select(
        "employees.userId employees.vacation employees.shiftHours employees.weekHoursLeft employees.employeeCost weekNumber"
      )
      .lean();

    if (!schedule) {
      return "Schedule not found!";
    }

    const employeeSchedule: IEmployee | null =
      schedule.employees.find(
        (emp: { userId: Types.ObjectId }) => emp.userId == userId
      ) || null;

    const weekNumber = schedule.weekNumber;
    const weekHoursLeft =
      (employeeSchedule?.weekHoursLeft ?? 0) +
      (employeeSchedule?.shiftHours ?? 0);
    const vacation = employeeSchedule?.vacation;

    const employeeScheduleOnTheWeek = await Schedule.find({
      weekNumber: weekNumber,
      "employees.userId": { $in: [userId] },
    })
      .select("_id employees.userId")
      .lean();

    const weeklySchedulesToUpdate = employeeScheduleOnTheWeek.flatMap(
      (schedule) =>
        schedule.employees
          .filter((user: { userId: Types.ObjectId }) =>
            user.userId.equals(userId)
          )
          .map(() => ({
            scheduleId: schedule._id,
            userId: userId,
          }))
    );

    for (const { scheduleId } of weeklySchedulesToUpdate) {
      await Schedule.findByIdAndUpdate(
        scheduleId,
        { $set: { "employees.$[elem].weekHoursLeft": weekHoursLeft } },
        {
          new: true,
          arrayFilters: [{ "elem.userId": userId }],
        }
      );
    }

    // Delete the employee from the schedule
    await Schedule.findByIdAndUpdate(
      scheduleId, // Assuming schedule._id is the correct identifier
      {
        $pull: { employees: { userId: userId } },
        $inc: {
          totalEmployeesScheduled: -1,
          totalDayEmployeesCost: -(employeeSchedule?.employeeCost ?? 0),
        },
      },
      { new: true, useFindAndModify: false }
    );

    // update user vacation days left
    if (vacation) {
      await User.findByIdAndUpdate(
        userId,
        { $inc: { vacationDaysLeft: 1 } },
        { new: true, useFindAndModify: false }
      );
    }
    return "Employee deleted from schedule!";
  } catch (error) {
    return "Delete employee from schedule failed! " + error;
  }
};
