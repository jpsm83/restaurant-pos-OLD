import { Schema, model, models } from "mongoose";

const idTypes = ["National ID", "Passport", "Driving License"];

const roles = [
  "General Manager",
  "Manager",
  "Assistant Manager",
  "MoD",
  "Operator",
  "Employee",
  "Cashier",
  "Floor Staff",
  "Bartender",
  "Barista",
  "Waiter",
  "Head Chef",
  "Sous Chef",
  "Line Cooks",
  "Kitchen Porter",
  "Cleaner",
  "Security",
  "Host",
  "Runner",
  "Supervisor",
  "Client",
  "Other",
];

const personalDetailsSchema = new Schema({
  // required fields
  firstName: { type: String, required: true }, // first name
  lastName: { type: String, required: true }, // last name
  email: { type: String, required: true, unique: true }, // email
  nationality: { type: String, required: true }, // country of birth
  gender: { type: String, enum: ["Man", "Woman", "Other"], required: true }, // gender
  birthDate: { type: Date, required: true }, // date of birth
  phoneNumber: { type: String, required: true }, // phone number
});

const addressSchema = new Schema({
  // required fields
  country: { type: String, required: true }, // country
  state: { type: String, required: true }, // state
  city: { type: String, required: true }, // city
  street: { type: String, required: true }, // street
  buildingNumber: { type: String, required: true }, // building number
  postCode: { type: String, required: true }, // local post code

  // optional fields
  region: { type: String },
  additionalDetails: { type: String }, // additional details about the location
  coordinates: { type: [Number], default: undefined }, // [longitude, latitude] ex: [40.712776, -74.005974] New York City - it will auto complete after required fields are filled
});

const userSchema = new Schema(
  {
    // required fields
    username: { type: String, required: true, unique: true }, // username for the user
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
        enum: roles,
        required: true,
      },
    ], // all roles of the user, can be multiple
    personalDetails: { type: personalDetailsSchema, required: true }, // personal details of the user
    taxNumber: { type: String, required: true, unique: true }, // tax number of the user
    joinDate: { type: Date, required: true }, // date when the user joined the business
    active: { type: Boolean, required: true, default: true }, // if the user is active, could be a sesonality worker
    onDuty: { type: Boolean, required: true, default: false }, // if the user is on duty, shift working right now
    vacationDaysPerYear: { type: Number, required: true }, // days of holidays per year
    business: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
    }, // business where the user works

    // optional fields
    currentShiftRole: { type: String, enum: roles }, // current shift role of the user
    address: addressSchema, // address of the user
    photo: { type: String, default: "../public/images/avatar.png" }, // photo of the user
    contractHoursWeek: { type: Number }, // contract hours per week
    grossMonthlySalary: { type: Number }, // monthly user salary before taxes
    netMonthlySalary: { type: Number }, // net user monthly salary after taxes
    terminatedDate: { type: Date }, // date when the user left the business
    notifications: {
      type: [
        {
          notification: {
            type: Schema.Types.ObjectId,
            ref: "Notification",
          },
          readFlag: { type: Boolean, default: false },
        },
      ],
      default: undefined,
    }, // if the user wants to receive notifications
    comments: { type: String }, // comments about the user
  },
  { timestamps: true, minimize: false }
);

const User = models.User || model("User", userSchema);

export default User;
