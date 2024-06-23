import connectDB from "@/app/lib/db";
import { IEmployee, ISchedule } from "@/app/lib/interface/ISchedule";
import Schedule from "@/app/lib/models/schedule";
import User from "@/app/lib/models/user";
import { Types } from "mongoose";

// delete employee from schedule
export const deleteEmployeeFromSchedule = async (
  scheduleId: Types.ObjectId,
  userId: Types.ObjectId,
  userScheduleId: Types.ObjectId
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

    // check if the userScheduleId is valid
    if (!userScheduleId || !Types.ObjectId.isValid(userScheduleId)) {
      return "Invalid userScheduleId!";
    }

    // connect before first call to DB
    await connectDB();

    // check if the schedule exists
    const schedule: ISchedule | null = await Schedule.findById(scheduleId)
      .select(
        "employees._id employees.userId employees.vacation employees.shiftHours employees.weekHoursLeft employees.employeeCost weekNumber"
      )
      .lean();

    if (!schedule) {
      return "Schedule not found!";
    }

    const employeeSchedule: IEmployee | null =
      schedule.employees.find(
        (emp) => emp._id == userScheduleId && emp.userId == userId
      ) || null;

    // check if the employee is in the schedule
    if (!employeeSchedule) {
      return "Employee not found in schedule!";
    }

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

    let countsOfUserId = 0;
    schedule.employees.forEach(employee => {
      if(employee.userId == userId) {
        countsOfUserId += 1;
      }
    });

    // Delete the employee from the schedule
    await Schedule.findByIdAndUpdate(
      scheduleId, // Assuming schedule._id is the correct identifier
      {
        $pull: { employees: { _id: userScheduleId } },
        $inc: {
          totalEmployeesScheduled: - (countsOfUserId >= 2 ? 0 : 1),
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
