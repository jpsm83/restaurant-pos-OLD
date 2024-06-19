import { Schema, model, models } from "mongoose";

const category = [
  "Food",
  "Beverage",
  "Merchandise",
  "Cleaning",
  "Office",
  "Furniture",
  "Disposable",
  "Services",
  "Equipment",
  "Other",
];

const saleUnit = [
  "Unit",
  "Dozen",
  "Case",
  "Slice",
  "Portion",
  "Piece",
  "Packet",
  "Bag",
  "Box",
  "Can",
  "Jar",
  "Bunch",
  "Bundle",
  "Roll",
  "Bottle",
  "Container",
  "Crate",
  "Gallon",
];

const measurementUnit = [
  "mg",
  "g",
  "kg",
  "oz",
  "lb",
  "ml",
  "l",
  "kl",
  "tsp",
  "Tbs",
  "fl-oz",
  "cup",
  "pnt",
  "qt",
  "gal",
];

// metric abreveations for the convert-units library
//    MASS
//      mg - Milligram
//      g - Gram
//      kg - Kilogram
//      oz - Ounce
//      lb - Pound
//    VOLUME
//      ml - Milliliter
//      l - Liter
//      kl - Kiloliter
//      tsp - Teaspoon
//      Tbs - Tablespoon
//      fl-oz - Fluid Ounce
//      cup - Cup
//      pnt - Pint
//      qt - Quart
//      gal - Gallon

const allergen = [
  "Gluten",
  "Crustaceans",
  "Eggs",
  "Fish",
  "Peanuts",
  "Soybeans",
  "Milk",
  "Nuts",
  "Celery",
  "Mustard",
  "Sesame",
  "Sulphur dioxide",
  "Lupin",
  "Molluscs",
];

const budgetImpact = ["Very Low", "Low", "Medium", "High", "Very High"];

const inventorySchedule = ["daily", "weekly", "monthly"];

// cant use arrow functions because they dont have their own "THIS" as context
const subcategory = function () {
    // @ts-ignore
  if (this.category === "Food") {
    return [
      "Bake",
      "Dairy",
      "Fruits",
      "Vegetables",
      "Herbs & Spices",
      "Gluten-Free",
      "Meat",
      "Fish",
      "Seafood",
      "Snacks",
      "Condiments",
      "Sauces",
      "Grains",
      "Pasta",
      "Prepared Meals",
      "Oils & Vinegars",
      "Others",
    ];
    // @ts-ignore
  } else if (this.category === "Beverage") {
    return [
      "Red Wine",
      "White Wine",
      "Rose Wine",
      "Sparkling Wine",
      "Champagne",
      "Beer",
      "Vodka",
      "Whiskey",
      "Rum",
      "Gin",
      "Tequila",
      "Brandy",
      "Cognac",
      "Liqueur",
      "Juices",
      "Water",
      "Milk",
      "Non-Alcoholic Wine",
      "Non-Alcoholic Beer",
      "Energy Drinks",
      "Coffee",
      "Tea",
      "Soft Drinks",
      "Others",
    ];
    // @ts-ignore
  } else if (this.category === "Merchandise") {
    return [
      "Clothing",
      "Accessories",
      "Toys & Games",
      "Health & Beauty",
      "Souvenirs",
      "Others",
    ];
  } else {
    return [
      "Cleaning",
      "Office",
      "Furniture",
      "Disposable",
      "Services",
      "Equipment",
      "Other",
    ];
  }
};

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
    subCategory: {
      type: String,
      enum: subcategory(),
      required: true,
    }, // subcategory of the good - "Bake"
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

    // optional fields
    description: { type: String }, // description of the good
    allergens: { type: [String], enum: allergen, default: undefined }, // allergens of the good
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
    timestamps: true, minimize: false }
);

const SupplierGood = models.SupplierGood || model("SupplierGood", supplierGoodSchema);

export default SupplierGood;