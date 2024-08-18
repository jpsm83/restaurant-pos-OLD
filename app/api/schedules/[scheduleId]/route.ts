import connectDB from "@/app/lib/db";
import { NextResponse } from "next/server";
import { Types } from "mongoose";

// imported interfaces
import { ISchedule } from "@/app/lib/interface/ISchedule";

// imported utils
import { handleApiError } from "@/app/lib/utils/handleApiError";

// imported models
import Schedule from "@/app/lib/models/schedule";
import User from "@/app/lib/models/user";

// @desc    Get schedule by ID
// @route   GET /schedules/:scheduleId
// @access  Public
export const GET = async (
  req: Request,
  context: { params: { scheduleId: Types.ObjectId } }
) => {
  try {
    const scheduleId = context.params.scheduleId;
    // check if the schedule ID is valid
    if (!scheduleId || !Types.ObjectId.isValid(scheduleId)) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid schedule ID!" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // connect before first call to DB
    await connectDB();

    const schedule = await Schedule.findById(scheduleId)
      .populate({
        path: "employees.userId",
        select: "username allUserRoles",
        model: User,
      })
      .lean();

    return !schedule
      ? new NextResponse(JSON.stringify({ message: "No schedule found!" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        })
      : new NextResponse(JSON.stringify(schedule), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
  } catch (error) {
    return handleApiError("Get schedule by its id failed!", error);
  }
};

// @desc    Update a schedule
// @route   PATCH /schedules/:scheduleId
// @access  Private
export const PATCH = async (
  req: Request,
  context: { params: { scheduleId: Types.ObjectId } }
) => {
  try {
    const scheduleId = context.params.scheduleId;
    // check if the schedule ID is valid
    if (!scheduleId || !Types.ObjectId.isValid(scheduleId)) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid schedule ID!" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const { comments } = (await req.json()) as ISchedule;

    // connect before first call to DB
    await connectDB();

    // check if the schedule exists
    const schedule: ISchedule | null = await Schedule.findById(scheduleId)
      .select("date")
      .lean();

    if (!schedule) {
      return new NextResponse(
        JSON.stringify({ message: "Schedule not found!" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // prepare update object
    const updatedSchedule = {
      comments: comments || schedule.comments,
    };

    await Schedule.findByIdAndUpdate(scheduleId, updatedSchedule, {
      new: true,
    });
    return new NextResponse(
      JSON.stringify({ message: `Schedule ${schedule.date} updated` }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return handleApiError("Update schedule failed!", error);
  }
};

// @desc    Delete a schedule
// @route   DELETE /schedules/:scheduleId
// @access  Private
export const DELETE = async (
  req: Request,
  context: { params: { scheduleId: Types.ObjectId } }
) => {
  try {
    const scheduleId = context.params.scheduleId;
    // check if the schedule ID is valid
    if (!scheduleId || !Types.ObjectId.isValid(scheduleId)) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid schedule ID!" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // connect before first call to DB
    await connectDB();

    // delete schedule and check if it existed
    const result = await Schedule.deleteOne({ _id: scheduleId });

    if (result.deletedCount === 0) {
      return new NextResponse(
        JSON.stringify({ message: "Schedule not found!" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    return new NextResponse(
      JSON.stringify({ message: `Schedule ${scheduleId} deleted` }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return handleApiError("Delete schedule failed!", error);
  }
};
