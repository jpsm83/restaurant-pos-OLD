import { Schema, model, models } from "mongoose";
import { category, saleUnit, measurementUnit, allergens, budgetImpact, inventorySchedule } from "../enums.js";

const supplierGoodSchema = new Schema(
  {
    // required fields
    name: { type: String, required: true }, // name of the good "King Authur all purpose flour"
    keyword: { type: String, required: true }, // keyword of the good "flour"
    category: {
      type: String,
      enum: category,
      required: true,
    }, // category of the good - "food"
    currentlyInUse: { type: Boolean, required: true, default: true }, // if the good is currently in use base on the business goods
    supplier: {
      type: Schema.Types.ObjectId,
      ref: "Supplier",
      required: true,
    }, // supplier of the good - it is required upon creation but it can be updated to undefined if supplier is deleted
    business: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
    }, // business that deals with the supplier

    // required subcategory fields
    foodSubCategory: {
      type: String,
      required: function () {
        // @ts-ignore
        return this.category === "Food";
      },
    }, // subcategory of the good - "Bake"
    beverageSubCategory: {
      type: String,
      required: function () {
        // @ts-ignore
        return this.category === "Beverage";
      },
    }, // subcategory of the good - "Beer"
    merchandiseSubCategory: {
      type: String,
      required: function () {
        // @ts-ignore
        return this.category === "Merchandise";
      },
    }, // subcategory of the good - "Clothing"
    cleaningSubCategory: {
      type: String,
      required: function () {
        // @ts-ignore
        return this.category === "Cleaning";
      },
    }, // subcategory of the good - "Clothing"
    officeSubCategory: {
      type: String,
      required: function () {
        // @ts-ignore
        return this.category === "Office";
      },
    }, // subcategory of the good - "Paper A4"
    furnitureSubCategory: {
      type: String,
      required: function () {
        // @ts-ignore
        return this.category === "Furniture";
      },
    }, // subcategory of the good - "Chair"
    disposableSubCategory: {
      type: String,
      required: function () {
        // @ts-ignore
        return this.category === "Disposable";
      },
    }, // subcategory of the good - "Napkin"
    servicesSubCategory: {
      type: String,
      required: function () {
        // @ts-ignore
        return this.category === "Services";
      },
    }, // subcategory of the good - "Cleaning"
    equipmentSubCategory: {
      type: String,
      required: function () {
        // @ts-ignore
        return this.category === "Equipment";
      },
    }, // subcategory of the good - "Oven"
    othersSubCategory: {
      type: String,
      required: function () {
        // @ts-ignore
        return this.category === "Other";
      },
    }, // subcategory of the good - "Other"

    // optional fields
    description: { type: String }, // description of the good
    allergens: { type: [String], enum: allergens, default: undefined }, // allergens of the good
    budgetImpact: { type: String, enum: budgetImpact }, // how relevant is the good on the business budget
    image: {
      type: String,
      default: "../public/images/default_img.png",
    }, // photo of the good

    // analytics fields
    saleUnit: {
      type: String,
      enum: saleUnit,
    }, // unit in which the good is sold
    wholeSalePrice: { type: Number }, // price of the good when sold as a whole
    measurementUnit: {
      type: String,
      enum: measurementUnit,
    }, // unit used for conversion
    totalQuantityPerUnit: { type: Number }, // total quantity in each unit of the good
    pricePerUnit: { type: Number }, // price of the good per unit - calculated automatically in the backend

    // saleUnit | wholeSalePrice | measurementUnit | totalQuantityPerUnit |  pricePerUnit
    //   Packet |       10€      |     Kilogram    |           5          | 2€ per kilogram
    //    Unit  |       03€      |       Unit      |           1          |   3€ per unit
    //    Box   |       20€      |     Kilogram    |           2          | 10€ per kilogram

    parLevel: { type: Number }, // optimal quantity to maintain
    minimumQuantityRequired: { type: Number }, // limit quantity required to make an order
    inventorySchedule: { type: String, enum: inventorySchedule }, // daily, weekly, monthly

    // IMPORTANT *** this caluclation will be done automatically in the backend
    // this will need information of orders to do so
    // ONLY FOR FOOD AND BEVERAGE GOODS
    // LOGIC HAVE TO BE CREATE IN THE ORDER CONTROLLER
    dynamicCountFromLastInventory: { type: Number, default: 0 }, // quantity start point of the good. Its first value will be the first inventory.currentCountQuantity. From there, it will be automaticaly updated base on the orders, substracting its supplierGood used to manufactured the businessGoods in the orders. Upon next inventory count, this field will set the inventory.systemCountQuantity value, then it will be reset to the value of inventory.currentCountQuantity - REQUIRED FOR ANALITCS
  },
  {
    timestamps: true,
    minimize: false,
  }
);

const SupplierGood =
  models.SupplierGood || model("SupplierGood", supplierGoodSchema);

export default SupplierGood;
