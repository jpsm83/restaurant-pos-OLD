import connectDB from "@/lib/db";
import { NextResponse } from "next/server";
import { hash } from "bcrypt";

// imported models
import User from "@/lib/models/user";
import Table from "@/lib/models/table";
import Order from "@/lib/models/order";
import Schedule from "@/lib/models/schedule";
import { Types } from "mongoose";
import { IUser } from "@/app/interface/IUser";
import Notification from "@/lib/models/notification";
import DailySalesReport from "@/lib/models/dailySalesReport";
import { addressValidation } from "../utils/addressValidation";
import { personalDetailsValidation } from "../utils/personalDetailsValidation";

// @desc    Get user by ID
// @route   GET /users/:userId
// @access  Private
export const GET = async (context: { params: any }) => {
  try {
    const userId = context.params.userId;
    // validate userId
    if (!userId || !Types.ObjectId.isValid(userId)) {
      return new NextResponse(JSON.stringify({ message: "Invalid user ID" }), {
        status: 400,
      });
    }

    // connect before first call to DB
    await connectDB();

    const user = await User.findById(userId).select("-password").lean();

    return !user
      ? new NextResponse(JSON.stringify({ message: "User not found" }), {
          status: 404,
        })
      : new NextResponse(JSON.stringify(user), { status: 200 });
  } catch (error: any) {
    return new NextResponse("Error: " + error, { status: 500 });
  }
};

// user DO NOT UPDATE notifications, only readFlag
// @desc    Update user
// @route   PATCH /users/:userId
// @access  Private
export const PATCH = async (req: Request, context: { params: any }) => {
  try {
    const userId = context.params.userId;
    // validate userId
    if (!userId || !Types.ObjectId.isValid(userId)) {
      return new NextResponse(JSON.stringify({ message: "Invalid user ID" }), {
        status: 400,
      });
    }

    const {
      username,
      email,
      password,
      idType,
      idNumber,
      allUserRoles,
      personalDetails,
      taxNumber,
      joinDate,
      active,
      onDuty,
      vacationDaysPerYear,
      currentShiftRole,
      address,
      photo,
      contractHoursWeek,
      grossMonthlySalary,
      netMonthlySalary,
      terminatedDate,
      comments,
    } = req.body as unknown as IUser;

    // connect before first call to DB
    await connectDB();

    // check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return new NextResponse(JSON.stringify({ message: "User not found" }), {
        status: 404,
      });
    }

    // check for duplicates username, email, taxNumber and idNumber with same business ID
    const duplicateUser: IUser | null = await User.findOne({
      _id: { $ne: userId },
      business: user.business,
      $or: [{ username }, { email }, { taxNumber }, { idNumber }],
    }).lean();
    if (duplicateUser) {
      if (duplicateUser.active === true) {
        return new NextResponse(
          JSON.stringify({
            message:
              "Username, email, taxNumber or idNumber already exists in an active user!",
          }),
          { status: 409 }
        );
      } else {
        return new NextResponse(
          JSON.stringify({
            message:
              "Username, email, taxNumber or idNumber already exists in an unactive user!",
          }),
          { status: 409 }
        );
      }
    }

    // check address validation
    if (address) {
      const checkAddressValidation = addressValidation(address);
      if (checkAddressValidation !== true) {
        return new NextResponse(
          JSON.stringify({ message: checkAddressValidation }),
          { status: 400 }
        );
      }
    }

    // check personalDetails validation
    const checkPersonalDetailsValidation =
      personalDetailsValidation(personalDetails);
    if (checkPersonalDetailsValidation !== true) {
      return new NextResponse(
        JSON.stringify({ message: checkPersonalDetailsValidation }),
        { status: 400 }
      );
    }

    // prepare update object
    const updateObj = {
      username: username || user.username,
      email: email || user.email,
      password: password ? await hash(password, 10) : user.password,
      idType: idType || user.idType,
      idNumber: idNumber || user.idNumber,
      allUserRoles: allUserRoles || user.allUserRoles,
      taxNumber: taxNumber || user.taxNumber,
      joinDate: joinDate || user.joinDate,
      active: active !== undefined ? active : user.active,
      onDuty: onDuty !== undefined ? onDuty : user.onDuty,
      vacationDaysPerYear: vacationDaysPerYear || user.vacationDaysPerYear,
      currentShiftRole: currentShiftRole || user.currentShiftRole,
      photo: photo || user.photo,
      contractHoursWeek: contractHoursWeek || user.contractHoursWeek,
      grossMonthlySalary: grossMonthlySalary || user.grossMonthlySalary,
      netMonthlySalary: netMonthlySalary || user.netMonthlySalary,
      terminatedDate: terminatedDate || user.terminatedDate,
      comments: comments || user.comments,
    };

    // update the user
    await user.findByIdAndUpdate({ _id: userId }, updateObj, {
      new: true,
      usefindAndModify: false,
    });

    return new NextResponse(
      JSON.stringify({
        message: `User ${updateObj.username} updated successfully!`,
      }),
      { status: 200 }
    );
  } catch (error: any) {
    return new NextResponse("Failed to update User - Error: " + error, {
      status: 500,
    });
  }
};

// delete an user shouldnt be allowed for data integrity, historical purposes and analytics
// the only case where an user should be deleted is if the business itself is deleted
// @desc    Delete user
// @route   DELETE /users/:userId
// @access  Private
export const DELETE = async (context: { params: any }) => {
  try {
    const userId = context.params.userId;
    // validate userId
    if (!userId || !Types.ObjectId.isValid(userId)) {
      return new NextResponse(JSON.stringify({ message: "Invalid user ID" }), {
        status: 400,
      });
    }

    // connect before first call to DB
    await connectDB();

    // Start all operations in parallel
    await Promise.all([
      // remove the user from all orders
      Order.updateMany(
        { user: userId },
        { $pull: { user: userId } },
        { new: true }
      ),

      // remove the user from all tables
      Table.updateMany(
        { openedBy: userId },
        { $pull: { openedBy: userId } },
        { new: true }
      ),
      Table.updateMany(
        { $or: [{ responsableBy: userId }, { closedBy: userId }] },
        { $pull: { responsableBy: userId, closedBy: userId } },
        { multi: true }
      ),

      // remove the user from all schedules
      Schedule.updateMany(
        { "employees.employee": userId },
        { $pull: { employees: { employee: userId } } },
        { multi: true }
      ),

      // remove the user from all daily reports
      DailySalesReport.updateMany(
        { "usersDailySalesReport.user": userId },
        { $pull: { usersDailySalesReport: { user: userId } } },
        { multi: true }
      ),

      // Remove the user from all notifications
      Notification.updateMany(
        { recipient: userId },
        { $pull: { recipient: userId } }
      ),

      // Delete the user
      User.deleteOne({ _id: userId }),
    ]);

    return new NextResponse(
      JSON.stringify({ message: `User id ${userId} deleted successfully!` }),
      { status: 200 }
    );
  } catch (error: any) {
    return new NextResponse("Delete user failed - Error: " + error, {
      status: 500,
    });
  }
};
