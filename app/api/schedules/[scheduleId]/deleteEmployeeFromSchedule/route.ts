import connectDb from "@/app/lib/utils/connectDb";
import { IEmployeeSchedule, ISchedule } from "@/app/lib/interface/ISchedule";
import Schedule from "@/app/lib/models/schedule";
import User from "@/app/lib/models/user";
import { handleApiError } from "@/app/lib/utils/handleApiError";
import { Types } from "mongoose";
import { NextResponse } from "next/server";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";

// @desc    Create new schedules
// @route   POST /schedules/:schedulesId/deleteEmployeeFromSchedule
// @access  Private
export const POST = async (req: Request, context: { params: { scheduleId: Types.ObjectId } }) => {
  // delete employee from schedule
  try {
    const { userId, userScheduleId } = (await req.json()) as {
      userId: Types.ObjectId;
      userScheduleId: Types.ObjectId;
    };

    const scheduleId = context.params.scheduleId;

    // check if the schedule ID is valid
    if (isObjectIdValid([scheduleId, userId, userScheduleId]) !== true) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid schedule, user or userSchedule Id!" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // connect before first call to DB
    await connectDb();

    // check if the schedule exists
    const schedule: ISchedule | null = await Schedule.findById(scheduleId)
      .select(
        "employees._id employees.userId employees.vacation employees.shiftHours employees.employeeCost weekNumber"
      )
      .lean();

    if (!schedule) {
      return new NextResponse(
        JSON.stringify({ message: "Schedule not found!" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // check if the employee is in the schedule
    const employeeSchedule: IEmployeeSchedule | null =
      schedule.employeesSchedules.find(
        (emp) => emp._id == userScheduleId && emp.userId == userId
      ) || null;

    if (!employeeSchedule) {
      return new NextResponse(
        JSON.stringify({ message: "Employee not found in schedule!" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    const vacation = employeeSchedule?.vacation;

    // calculate the number of employees scheduled for the day
    let countsOfUserId: Types.ObjectId[] = [];

    schedule.employeesSchedules.forEach((employee) => {
      if (!employee.vacation && !countsOfUserId.includes(employee.userId)) {
        countsOfUserId.push(employee.userId);
      }
    });

    // Delete the employee from the schedule
    await Schedule.findByIdAndUpdate(
      scheduleId, // Assuming schedule._id is the correct identifier
      {
        $pull: { employees: { _id: userScheduleId } },
        $set: { totalEmployeesScheduled: countsOfUserId.length },
        $inc: {
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
    return new NextResponse(
      JSON.stringify({ message: "Employee deleted from schedule!" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return handleApiError("Delete employee from schedule failed!", error);
  }
};
