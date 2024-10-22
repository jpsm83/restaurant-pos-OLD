// this will be used to send push notifications to users
// tokens have to be saved in the user model
// firebase cloud messaging tokens are used to send push notifications to users
// it is not done yet

import { Types } from "mongoose";

// imported utils
import connectDb from "@/app/lib/utils/connectDb";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";

// imported models
import User from "@/app/lib/models/user";

export const saveTokenIntoUser = async (
  userId: Types.ObjectId,
  fcmToken: string
) => {
  // Validate user ID
  if (!isObjectIdValid([userId])) {
    return "Invalid user ID!";
  }

  // Validate fcmToken
  if (typeof fcmToken !== "string" || fcmToken.trim() === "") {
    return "FCM token is required and must be a non-empty string!";
  }

  try {
    // Connect to the database
    await connectDb();

    // Update the user with the new FCM token
    const updatedToken = await User.findByIdAndUpdate(
      userId,
      { $set: { fcmToken } },
      { new: true, lean: true }
    );

    if (!updatedToken) {
      return "User not found!";
    }

    return "FCM token saved into user successfully!";
  } catch (error) {
    return "Save FCM token into user failed! Error: " + error;
  }
};
