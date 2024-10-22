import { Schema, model, models } from "mongoose";
import { addressSchema } from "./address";
import { idTypes, userRoles } from "../enums.js";

const personalDetailsSchema = new Schema({
  // required fields
  firstName: { type: String, required: true }, // first name
  lastName: { type: String, required: true }, // last name
  nationality: { type: String, required: true }, // country of birth
  gender: { type: String, enum: ["Man", "Woman", "Other"], required: true }, // gender
  birthDate: { type: Date, required: true }, // date of birth
  phoneNumber: { type: String, required: true }, // phone number
});

const salarySchema = new Schema({
  payFrequency: {
    type: String,
    enum: ["Hourly", "Daily", "Weekly", "Monthly"],
    required: true,
  }, // frequency of the payment
  grossSalary: { type: Number, required: true }, // hourly user salary before taxes
  netSalary: { type: Number, required: true }, // net user salary after taxes
});

const userSchema = new Schema(
  {
    // required fields
    username: { type: String, required: true, unique: true }, // username for the user
    email: { type: String, required: true, unique: true }, // email
    password: { type: String, required: true }, // password for the user
    idType: {
      type: String,
      enum: idTypes,
      required: true,
    }, // type of ID used by the user
    idNumber: { type: String, required: true, unique: true }, // ID number of the user
    allUserRoles: [
      {
        type: String,
        enum: userRoles,
        required: true,
      },
    ], // all roles of the user, can be multiple
    personalDetails: { type: personalDetailsSchema, required: true }, // personal details of the user
    taxNumber: { type: String, required: true, unique: true }, // tax number of the user
    joinDate: { type: Date, required: true }, // date when the user joined the business
    active: { type: Boolean, required: true, default: true }, // if the user is active, could be a sesonality worker
    onDuty: { type: Boolean, required: true, default: false }, // if the user is on duty, shift working right now
    vacationDaysPerYear: { type: Number }, // days of holidays per year
    vacationDaysLeft: { type: Number }, // days of holidays left
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
    }, // business where the user works

    // optional fields
    deviceToken: { type: String }, // token for push notifications with Firebase Cloud Messaging
    currentShiftRole: { type: String, enum: userRoles }, // current shift role of the user
    address: addressSchema, // address of the user
    imageUrl: { type: String }, // photo of the user
    // *** IMPORTANTE ***
    // user might input the contract hours per week as a whole hour number on the front of the application and them it will be converted to milliseconds
    contractHoursWeek: { type: Number }, // contract hours per week in milliseconds
    salary: { type: salarySchema }, // salary of the user
    terminatedDate: { type: Date }, // date when the user left the business
    notifications: {
      type: [
        {
          notificationId: {
            type: Schema.Types.ObjectId,
            ref: "Notification",
          },
          readFlag: { type: Boolean, default: false },
          deletedFlag: { type: Boolean, default: false },
        },
      ],
      default: undefined,
    }, // if the user wants to receive notifications
    comments: { type: String }, // comments about the user
  },
  { timestamps: true }
);

const User = models.User || model("User", userSchema);
export default User;
