import connectDb from "@/app/lib/utils/connectDb";
import { NextResponse } from "next/server";
import { hash } from "bcrypt";

// imported models
import User from "@/app/lib/models/user";
import Table from "@/app/lib/models/salesLocation";
import Order from "@/app/lib/models/order";
import Schedule from "@/app/lib/models/schedule";
import { Types } from "mongoose";
import { IUser } from "@/app/lib/interface/IUser";
import Notification from "@/app/lib/models/notification";
import DailySalesReport from "@/app/lib/models/dailySalesReport";
import { personalDetailsValidation } from "../utils/personalDetailsValidation";
import { addressValidation } from "@/app/lib/utils/addressValidation";
import { handleApiError } from "@/app/lib/utils/handleApiError";
import { calculateVacationProportional } from "../utils/calculateVacationProportional";

// @desc    Get user by ID
// @route   GET /users/:userId
// @access  Private
export const GET = async (
  req: Request,
  context: { params: { userId: Types.ObjectId } }
) => {
  try {
    const userId = context.params.userId;

    if (!userId || !Types.ObjectId.isValid(userId)) {
      return new NextResponse(JSON.stringify({ message: "Invalid user ID!" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // connect before first call to DB
    await connectDb();

    const user = await User.findById(userId).select("-password").lean();

    return !user
      ? new NextResponse(JSON.stringify({ message: "User not found!" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        })
      : new NextResponse(JSON.stringify(user), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        });
  } catch (error) {
    return handleApiError("Get user by its id failed!", error);
  }
};

// user DO NOT UPDATE notifications, only readFlag
// @desc    Update user
// @route   PATCH /users/:userId
// @access  Private
export const PATCH = async (
  req: Request,
  context: { params: { userId: Types.ObjectId } }
) => {
  try {
    const userId = context.params.userId;

    if (!userId || !Types.ObjectId.isValid(userId)) {
      return new NextResponse(JSON.stringify({ message: "Invalid user ID!" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
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
      contractHoursWeek,
      grossMonthlySalary,
      netMonthlySalary,
      terminatedDate,
      comments,
    } = (await req.json()) as IUser;

    // connect before first call to DB
    await connectDb();

    // check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return new NextResponse(JSON.stringify({ message: "User not found!" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
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
          { status: 409, headers: { "Content-Type": "application/json" } }
        );
      } else {
        return new NextResponse(
          JSON.stringify({
            message:
              "Username, email, taxNumber or idNumber already exists in an unactive user!",
          }),
          { status: 409, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // Ensure user.address is an object if it's undefined or null
    // that is because address is not required on user creation
    // if it does not exist, it will be created as an empty object to avoid errors
    user.address = user.address ?? {};

    // prepare update address object
    const updatedAddress = {
      country: address?.country ?? user.address.country ?? undefined,
      state: address?.state ?? user.address.state ?? undefined,
      city: address?.city ?? user.address.city ?? undefined,
      street: address?.street ?? user.address.street ?? undefined,
      buildingNumber:
        address?.buildingNumber ?? user.address.buildingNumber ?? undefined,
      postCode: address?.postCode ?? user.address.postCode ?? undefined,
      region: address?.region ?? user.address.region ?? undefined,
      additionalDetails:
        address?.additionalDetails ??
        user.address.additionalDetails ??
        undefined,
      coordinates:
        address?.coordinates ?? user.address.coordinates ?? undefined,
    };

    // add address fields
    if (address) {
      const validAddress = addressValidation(updatedAddress);
      if (validAddress !== true) {
        return new NextResponse(JSON.stringify({ message: validAddress }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // prepare update personalDetails object
    const updatedPersonalDetails = {
      firstName: personalDetails?.firstName || user.personalDetails.firstName,
      lastName: personalDetails?.lastName || user.personalDetails.lastName,
      nationality:
        personalDetails?.nationality || user.personalDetails.nationality,
      gender: personalDetails?.gender || user.personalDetails.gender,
      birthDate: personalDetails?.birthDate || user.personalDetails.birthDate,
      phoneNumber:
        personalDetails?.phoneNumber || user.personalDetails.phoneNumber,
    };

    // check personalDetails validation
    const checkPersonalDetailsValidation = personalDetailsValidation(
      updatedPersonalDetails
    );
    if (checkPersonalDetailsValidation !== true) {
      return new NextResponse(
        JSON.stringify({ message: checkPersonalDetailsValidation }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // calculate vacation days if joinDate or vacationDaysPerYear are updated
    let calculateVacationDaysPerYear: number | undefined;
    if (
      joinDate !== user.joinDate ||
      vacationDaysPerYear !== user.vacationDaysPerYear
    ) {
      calculateVacationDaysPerYear = calculateVacationProportional(
        new Date(joinDate),
        vacationDaysPerYear
      );
    }

    let grossHourlySalaryCalculation: number | undefined;
    if (
      typeof grossMonthlySalary === "number" &&
      typeof contractHoursWeek === "number"
    ) {
      grossHourlySalaryCalculation =
        grossMonthlySalary / (contractHoursWeek * 4);
    } else {
      grossHourlySalaryCalculation = undefined;
    }

    // prepare update object
    const updatedUser = {
      username: username || user.username,
      email: email || user.email,
      password: password ? await hash(password, 10) : user.password,
      idType: idType || user.idType,
      idNumber: idNumber || user.idNumber,
      allUserRoles: allUserRoles || user.allUserRoles,
      personalDetails: updatedPersonalDetails,
      taxNumber: taxNumber || user.taxNumber,
      joinDate: joinDate || user.joinDate,
      active: active !== undefined ? active : user.active,
      onDuty: onDuty !== undefined ? onDuty : user.onDuty,
      vacationDaysPerYear: vacationDaysPerYear || user.vacationDaysPerYear,
      vacationDaysLeft: calculateVacationDaysPerYear
        ? calculateVacationDaysPerYear
        : user.vacationDaysLeft,
      currentShiftRole: currentShiftRole || user.currentShiftRole,
      address: updatedAddress,
      contractHoursWeek: contractHoursWeek || user.contractHoursWeek,
      grossMonthlySalary: grossMonthlySalary || user.grossMonthlySalary,
      grossHourlySalary: grossHourlySalaryCalculation || user.grossHourlySalary,
      netMonthlySalary: netMonthlySalary || user.netMonthlySalary,
      terminatedDate: terminatedDate || user.terminatedDate,
      comments: comments || user.comments,
    };

    // update the user
    await User.findByIdAndUpdate(userId, updatedUser, {
      new: true,
    });

    return new NextResponse(
      JSON.stringify({
        message: `User ${updatedUser.username} updated successfully!`,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return handleApiError("Update user failed!", error);
  }
};

// delete an user shouldnt be allowed for data integrity, historical purposes and analytics
// the only case where an user should be deleted is if the business itself is deleted
// @desc    Delete user
// @route   DELETE /users/:userId
// @access  Private
export const DELETE = async (
  req: Request,
  context: { params: { userId: Types.ObjectId } }
) => {
  try {
    const userId = context.params.userId;

    if (!userId || !Types.ObjectId.isValid(userId)) {
      return new NextResponse(JSON.stringify({ message: "Invalid user ID!" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // connect before first call to DB
    await connectDb();

    // Delete the user
    const result = await User.deleteOne({ _id: userId });

    if (result.deletedCount === 0) {
      return new NextResponse(JSON.stringify({ message: "User not found!" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    } else {
      // Delete all related data in parallel
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
      ]);
    }

    return new NextResponse(
      JSON.stringify({ message: `User id ${userId} deleted successfully` }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return handleApiError("Delete user failed!", error);
  }
};
