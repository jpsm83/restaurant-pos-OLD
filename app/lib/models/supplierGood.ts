import { Schema, model, models } from "mongoose";
import {
  mainCategories,
  saleUnit,
  measurementUnit,
  allergens,
  budgetImpact,
  inventorySchedule,
} from "../enums.js";

const supplierGoodSchema = new Schema(
  {
    // required fields
    name: { type: String, required: true }, // name of the good "King Authur all purpose flour"
    keyword: { type: String, required: true }, // keyword of the good "flour"
    mainCategory: { type: String, enum: mainCategories, required: true }, // principal category of the business good
    subCategory: { type: String, required: true }, // secondary category of the business good
    currentlyInUse: { type: Boolean, required: true, default: true }, // if the good is currently in use base on the business goods
    supplierId: {
      type: Schema.Types.ObjectId,
      ref: "Supplier",
      required: true,
    }, // supplier of the good - it is required upon creation but it can be updated to undefined if supplier is deleted
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
    }, // business that deals with the supplier

    // optional fields
    description: { type: String }, // description of the good
    allergens: { type: [String], enum: allergens, default: undefined }, // allergens of the good
    budgetImpact: { type: String, enum: budgetImpact }, // how relevant is the good on the business budget
    imageUrl: {
      type: String,
    }, // photo of the good
    inventorySchedule: { type: String, enum: inventorySchedule }, // daily, weekly, monthly

    // analytics fields
    minimumQuantityRequired: { type: Number }, // limit quantity required for a day work
    
    // ************************* IMPORTANT *************************
    // parLevel is base on MEASUREMENT UNIT,
    parLevel: { type: Number }, // optimal quantity to maintain, bar orders have to reach this level - if par level is 100, you got 20, today is order day, you have to order 80
    // *************************************************************
    
    saleUnit: {
      type: String,
      enum: saleUnit,
    }, // unit in which the good is sold - block of cheese, bag of bread, milk gallon
    measurementUnit: {
      type: String,
      enum: measurementUnit,
    }, // unit used for conversion, measurement on how to good is bought
    pricePerUnit: { type: Number }, // price of the good per unit - user will divede the price of the product by the quantity of unit to get this value
    
    // saleUnit | measurementUnit |  pricePerUnit
    //   Packet |     Kilogram    | 2€ per kilogram
    //    Unit  |       Unit      |   3€ per unit
    //   Carton |      Liters     |  1€ per liter

    // IMPORTANT *** this caluclation will be done automatically in the backend
    // this will need information of orders to do so
    // ONLY FOR FOOD AND BEVERAGE GOODS
    // LOGIC HAVE TO BE CREATE IN THE ORDER CONTROLLER
  },
  {
    timestamps: true,
    minimize: false,
  }
);

const SupplierGood =
  models.SupplierGood || model("SupplierGood", supplierGoodSchema);
export default SupplierGood;
