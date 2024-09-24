import { NextResponse } from "next/server";
import { hash } from "bcrypt";
import { Types } from "mongoose";

// imported utils
import connectDb from "@/app/lib/utils/connectDb";
import { personalDetailsValidation } from "../utils/personalDetailsValidation";
import { addressValidation } from "@/app/lib/utils/addressValidation";
import { handleApiError } from "@/app/lib/utils/handleApiError";
import { calculateVacationProportional } from "../utils/calculateVacationProportional";

// imported interfaces
import { IUser } from "@/app/lib/interface/IUser";

// imported models
import User from "@/app/lib/models/user";
import Table from "@/app/lib/models/salesLocation";
import Order from "@/app/lib/models/order";
import Schedule from "@/app/lib/models/schedule";
import Notification from "@/app/lib/models/notification";
import DailySalesReport from "@/app/lib/models/dailySalesReport";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";
import salaryValidation from "../utils/salaryValidation";
import Printer from "@/app/lib/models/printer";

// @desc    Get user by ID
// @route   GET /users/:userId
// @access  Private
export const GET = async (
  req: Request,
  context: { params: { userId: Types.ObjectId } }
) => {
  try {
    const userId = context.params.userId;

    if (isObjectIdValid([userId]) !== true) {
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
      salary,
      terminatedDate,
      comments,
    } = (await req.json()) as IUser;

    // validate userId
    if (isObjectIdValid([userId]) !== true) {
      return new NextResponse(
        JSON.stringify({ message: "User ID is not valid!" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // prepare update object
    const updateUserObj: Partial<IUser> = {};

    // add address fields
    if (address) {
      const validAddress = addressValidation(address);
      if (validAddress !== true) {
        return new NextResponse(JSON.stringify({ message: validAddress }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
      updateUserObj.address = address;
    }

    // check personalDetails validation
    if (personalDetails) {
      const checkPersonalDetailsValidation =
        personalDetailsValidation(personalDetails);
      if (checkPersonalDetailsValidation !== true) {
        return new NextResponse(
          JSON.stringify({ message: checkPersonalDetailsValidation }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
      updateUserObj.personalDetails = personalDetails;
    }

    if (salary) {
      const salaryValidationResult = salaryValidation(salary);
      if (salaryValidationResult !== true) {
        return new NextResponse(
          JSON.stringify({ message: salaryValidationResult }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
      updateUserObj.salary = salary;
    }

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
      const message = duplicateUser.active
        ? "Username, email, taxNumber, or idNumber already exists and user is active!"
        : "Username, email, taxNumber, or idNumber already exists in an inactive user!";

      return new NextResponse(JSON.stringify({ message }), {
        status: 409,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Hash password asynchronously only if it is provided
    if (password) {
      updateUserObj.password = await hash(password, 10);
    }

    // Calculate vacationDaysLeft if relevant fields are updated
    if (vacationDaysPerYear || joinDate) {
      updateUserObj.vacationDaysLeft = calculateVacationProportional(
        new Date(joinDate || user.joinDate),
        vacationDaysPerYear || user.vacationDaysPerYear
      );
    }

    // Populate the update object with other provided fields
    if (username) updateUserObj.username = username;
    if (email) updateUserObj.email = email;
    if (idType) updateUserObj.idType = idType;
    if (idNumber) updateUserObj.idNumber = idNumber;
    if (allUserRoles) updateUserObj.allUserRoles = allUserRoles;
    if (taxNumber) updateUserObj.taxNumber = taxNumber;
    if (joinDate) updateUserObj.joinDate = joinDate;
    if (active !== undefined) updateUserObj.active = active;
    if (onDuty !== undefined) updateUserObj.onDuty = onDuty;
    if (vacationDaysPerYear)
      updateUserObj.vacationDaysPerYear = vacationDaysPerYear;
    if (currentShiftRole) updateUserObj.currentShiftRole = currentShiftRole;
    if (contractHoursWeek) updateUserObj.contractHoursWeek = contractHoursWeek;
    if (terminatedDate) updateUserObj.terminatedDate = terminatedDate;
    if (comments) updateUserObj.comments = comments;

    // update the user
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updateUserObj },
      {
        new: true,
        lean: true,
      }
    );

    // after updating user, if user id not active, delete printer related data
    if (active === false) {
      await Printer.updateMany(
        {
          businessId: user.businessId,
          $or: [
            { usersAllowedToPrintDataIds: userId },
            { "configurationSetupToPrintOrders.excludeUserIds": userId },
          ],
        },
        {
          $pull: {
            usersAllowedToPrintDataIds: userId,
            "configurationSetupToPrintOrders.excludeUserIds": userId,
          },
        }
      );
    }

    // Check if the purchase was found and updated
    if (!updatedUser) {
      return new NextResponse(JSON.stringify({ message: "User not found!" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new NextResponse(
      JSON.stringify({
        message: `User ${updateUserObj.username} updated successfully!`,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return handleApiError("Update user failed!", error);
  }
};

// delete an user shouldnt be allowed for data integrity, historical purposes and analytics
// the only case where an user should be deleted is if the business itself is deleted
// If you delete a user from the database and there are other documents that have a relationship with that user, those related documents may still reference the deleted user. This can lead to issues such as orphaned records, broken references, and potential errors when querying or processing those related documents.
// @desc    Delete user
// @route   DELETE /users/:userId
// @access  Private
export const DELETE = async (
  req: Request,
  context: { params: { userId: Types.ObjectId } }
) => {
  try {
    const userId = context.params.userId;

    // check if the userId is a valid ObjectId
    if (!isObjectIdValid([userId])) {
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
