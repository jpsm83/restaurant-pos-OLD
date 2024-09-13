import { Schema, model, models } from "mongoose";
import { addressSchema } from "./address";
import { subscription, mainCategories } from "../enums.js";

const salesLocationSchema = new Schema({
  locationReferenceName: { type: String, required: true }, // name of the location sale reference - ex: 101
  locationType: { type: String }, // table, room, bar, seat, etc - ex: Table101
  selfOrdering: { type: Boolean, default: false }, // manager decision if location can order by itself using QR code
  qrCode: { type: String, required: true }, // auto created QR code for the location
  qrEnabled: { type: Boolean, default: true }, // QR code enabled or disabled - when QR is scanned, it will be disabled and a timer on the frontend will set, if the timer expires, the frontend page will close and the QR code will be enabled again - only if selfOrdering is true
  qrLastScanned: { type: Date }, // last time the QR code was scanned
  printFor: [
    {
      mainCategory: {
        type: String,
        enum: mainCategories,
        required: true,
      }, // this will dictate what the printer will print as main category
      subCategories: {
        type: [String],
        required: true,
      }, // this will dictate what the printer will print as sub category from the main category
      printerId: { type: Schema.Types.ObjectId, ref: "Printer", required: true }, // printer reference
    },
  ], // what and where the location sales can print for and which printer
});

const metricsSchema = new Schema({
  foodCostPercentage: { type: Number, default: 30 }, // Food cost percentage acceptable - 28-35% of sales average
  beverageCostPercentage: { type: Number, default: 20 }, // Beverage cost percentage acceptable - 18-24% of sales average
  laborCostPercentage: { type: Number, default: 30 }, // Labor cost percentage acceptable - 28-35% of sales average
  fixedCostPercentage: { type: Number, default: 20 }, // Fixed cost percentage acceptable - 18-24% of sales average
  // the sun of the cost percentage above should be 100%
  supplierGoodWastePercentage: {
    veryLowBudgetImpact: { type: Number, default: 9 }, // Food waste percentage acceptable - 8-12% of sales average
    lowBudgetImpact: { type: Number, default: 7 }, // Food waste percentage acceptable - 6-10% of sales average
    mediumBudgetImpact: { type: Number, default: 5 }, // Food waste percentage acceptable - 4-8% of sales average
    hightBudgetImpact: { type: Number, default: 3 }, // Food waste percentage acceptable - 2-5% of sales average
    veryHightBudgetImpact: { type: Number, default: 1 }, // Food waste percentage acceptable - 0-2% of sales average
  }, // Food waste percentage acceptable - 3-7% of sales average
});

const businessSchema = new Schema(
  {
    // required fields
    tradeName: { type: String, required: true }, // Company Name for the public
    legalName: { type: String, required: true }, // Legal Name of the company, not unique because could happens of same name bussines in different countries
    imageUrl: { type: String }, // Logo of the company as url link to cloudinary
    email: { type: String, required: true }, // Email of the company, not unique because could happens of one office managing multiple companies
    password: { type: String, required: true }, // Password of the company pos account
    phoneNumber: { type: String, required: true }, // Phone number of the company
    taxNumber: { type: String, required: true, unique: true }, // Tax number of the company
    currencyTrade: { type: String, required: true }, // currency of the price
    subscription: {
      type: String,
      enum: subscription,
      default: "Free",
      required: true,
    }, // Subscription plan for the company
    address: { type: addressSchema, required: true }, // Address of the company
    metrics: { type: metricsSchema }, // Metrics of the company

    // optional fields
    contactPerson: { type: String }, // Contact person of the company
    salesLocation: [salesLocationSchema], // sales location reference and qr code of the company
  },
  {
    timestamps: true,
    minimize: false,
  }
);

const Business = models.Business || model("Business", businessSchema);
export default Business;
