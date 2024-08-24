import { Schema, model, models } from "mongoose";
import { addressSchema } from "./address";
import { subscription, locationTypes } from "../enums.js";

const salesLocation = new Schema({
  locationReferenceName: { type: String, required: true }, // Table name or location name
  locationType: { type: String },
  selfOrdering: { type: Boolean, default: false },
  qrCode: { type: String, required: true }, // auto created QR code for the location
  qrEnabled: { type: Boolean, default: true }, // QR code enabled or disabled - when QR is scanned, it will be disabled and a timer on the frontend will set, if the timer expires, the frontend page will close and the QR code will be enabled again
  qrLastScanned: { type: Date }, // last time the QR code was scanned
});

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
    contactPerson: { type: String, default: "Table", enum: locationTypes }, // Contact person of the company
    salesLocation: { type: [salesLocation] }, // tables reference and qr code of the company
  },
  {
    timestamps: true,
    minimize: false,
  }
);

const Business = models.Business || model("Business", businessSchema);
export default Business;
