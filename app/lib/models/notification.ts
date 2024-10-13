import { Schema, model, models } from "mongoose";
import { notificationTypes } from "../enums.js";

const notificationSchema = new Schema(
  {
    // required fields
    notificationType: { type: notificationTypes, required: true }, // Type of notification "warning", "emergency", "info"
    message: { type: String, required: true }, // notification message
    userRecipientsId: {
      type: [Schema.Types.ObjectId],
      ref: "User",
      required: true,
    }, // Reference to the user receiving the notification
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
    }, // Reference to the business where the notification was created

    // non required fields
    userSenderId: { type: Schema.Types.ObjectId, ref: "User" }, // Reference to the user who created the notification, only used on messages
  },
  {
    timestamps: true,
  }
);

const Notification =
  models.Notification || model("Notification", notificationSchema);
export default Notification;
