import { Schema, model, models } from "mongoose";
import { addressSchema } from "./address";

const subscription = ["Free", "Basic", "Premium", "Enterprise"];

const businessSchema = new Schema(
  {
    // required fields
    tradeName: { type: String, required: true }, // Company Name for the public
    legalName: { type: String, required: true }, // Legal Name of the company, not unique because could happens of same name bussines in different countries
    email: { type: String, required: true }, // Email of the company, not unique because could happens of one office managing multiple companies
    password: { type: String, required: true }, // Password of the company pos account
    phoneNumber: { type: String, required: true }, // Phone number of the company
    taxNumber: { type: String, required: true, unique: true }, // Tax number of the company
    currencyTrade: { type: String, default: "EUR", required: true }, // currency of the price
    subscription: {
      type: String,
      enum: subscription,
      default: "Free",
      required: true,
    }, // Subscription plan for the company
    address: { type: addressSchema, required: true }, // Address of the company

    // optional fields
    contactPerson: { type: String }, // Contact person of the company
    businessTables: { type: [String], default: undefined }, // Reference name of tables in the business
  },
  {
    timestamps: true,
    minimize: false,
  }
);

const Business = models.Business || model("Business", businessSchema);

export default Business;
