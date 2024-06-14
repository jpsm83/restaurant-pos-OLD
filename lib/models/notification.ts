import { Schema, model, models } from "mongoose";

const notificationTypes = ["Warning", "Emergency", "Info", "Message"];

// example of prependListener
//   "Supplier good is running low",
//   "Supplier good is out of stock",
//   "Business good is running low",
//   "Business good is out of stock",
//   "Employee is late",
//   "Employee was absent",
//   "Employee is leaving early",
//   "Daily report was closed",
//   "Message from the general manager",
//   "Message",

const notificationSchema = new Schema(
  {
    // required fields
    dayReferenceNumber: { type: Number, required: true }, // reference number for the day, every object create in the same day will have the same reference number
    notificationType: { type: notificationTypes, required: true }, // Type of notification "warning", "emergency", "info"
    message: { type: String, required: true }, // notification message
    recipient: {
      type: [Schema.Types.ObjectId],
      ref: "User",
      required: true,
    }, // Reference to the user receiving the notification
    business: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
    }, // Reference to the business where the notification was created

    // non required fields
    sender: { type: Schema.Types.ObjectId, ref: "User" }, // Reference to the user who created the notification, only used on messages
  },
  {
    timestamps: true,
    minimize: false,
  }
);

const Notification =
  models.Notification || model("Notification", notificationSchema);

export default Notification;
