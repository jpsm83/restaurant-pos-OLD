import { Schema, model, models } from "mongoose";

const mainCategories = ["Food", "Set Menu", "Beverage", "Merchandise"];

const foodCategories = [
  "Set menu",
  "Pastries",
  "Sandwiches",
  "Snacks",
  "Burgers",
  "Gluten-free",
  "Add-ons", // for example, extra cheese, extra bacon, etc.
  "Main",
  "Appetizer",
  "Starter",
  "Entrée",
  "Pasta",
  "Pizza",
  "Salad",
  "Dessert",
  "Snack",
  "Other",
];

const beverageCategories = [
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
  "Cocktail",
  "Non-Alcoholic Wine",
  "Non-Alcoholic Beer",
  "Energy Drinks",
  "Coffee",
  "Tea",
  "Soft Drinks",
  "Others",
];

const merchandiseCategories = [
  "Clothing",
  "Accessories",
  "Toys & Games",
  "Health & Beauty",
  "Souvenirs",
  "Others",
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

const categorySchema = new Schema({
  mainCategory: {
    type: String,
    enum: mainCategories,
    required: true,
  }, // main category of the business good
  setMenuSubCategory: {
    type: String,
    required: function () {
      // @ts-ignore
      return this.mainCategory === "Set Menu";
    },
  }, // subcategories for the "Set Menu" category
  foodSubCategory: {
    type: String,
    enum: [foodCategories],
    required: function () {
      // @ts-ignore
      return this.mainCategory === "Food";
    },
  }, // subcategories for the "Food" category
  beverageSubCategory: {
    type: String,
    enum: [beverageCategories],
    required: function () {
      // @ts-ignore
      return this.mainCategory === "Beverage";
    },
  }, // subcategories for the "Beverage" category
  merchandiseSubCategory: {
    type: String,
    enum: [merchandiseCategories],
    required: function () {
      // @ts-ignore
      return this.mainCategory === "Merchandise";
    },
  }, // subcategories for the "Merchandise" category
});

const businessGoodSchema = new Schema(
  {
    // required fields
    name: { type: String, required: true }, // name of the business good
    keyword: { type: String, required: true }, // keyword for search "burger", "sides", "beer"
    category: {
      type: categorySchema,
      required: true,
    }, // category of the business good "Food"
    onMenu: { type: Boolean, required: true, default: true }, // if the business good is on the menu right now
    available: { type: Boolean, required: true, default: true }, // if the business good is available for sale
    sellingPrice: { type: Number, required: true }, // price for customers
    business: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
    },

    // BUSINESSGOOD CAN HAVE A SUPPLIERGOODS ARRAY OR SETMENU ARRAY - IT CANNOT BE BOTH
    // AT LEAST ONE OF THEM IS REQUIRED
    // supplierGoods is an array of objects that contains the supplierGood and the quantity needed to build a businessGood
    ingredients: {
      type: [
        {
          ingredient: {
            type: Schema.Types.ObjectId,
            ref: "SupplierGood",
            required: true,
          }, // Supplier good used as an ingredient - e.g., ground meat (id)
          measurementUnit: {
            type: String,
            enum: measurementUnit,
            required: true,
          }, // Unit used for measurement - e.g., (grams) of ground meat - REQUIRED FOR ANALYTICS
          requiredQuantity: { type: Number, required: true }, // Quantity needed to prepare the business good - e.g., (250) grams of ground meat
          costOfRequiredQuantity: { type: Number }, // Cost price of the required quantity to prepare the business good
          // Before the calculation, make sure the ingredient.measurementUnit is the same as the measurementUnit
          // If not, convert the measurementUnit to the ingredient.measurementUnit
          // Then calculate the cost price of the required quantity
          // This calculation is done in the frontend and saved here
        },
      ],
      default: undefined,
    },
    // set menu is a group of business goods that are sold together in a single cheaper price
    setMenu: {
      type: [Schema.Types.ObjectId],
      ref: "BusinessGood",
      default: undefined,
    }, // all business goods that are part of the set menu
    // optional fields
    costPrice: { type: Number }, // sun of all ingredients.costOfRequiredQuantity
    description: { type: String }, // description of the business good
    allergens: { type: [String], enum: allergen, default: undefined }, // allergens of the business good - have to follow the allergens from the supplier goods and add more if needed
    image: { type: String, default: "../public/images/default_img.png" }, // photo of the business good
    deliveryTime: { type: Number }, // maximun time to deliver the business good to client
  },
  { timestamps: true, minimize: false }
);

const BusinessGood =
  models.BusinessGood || model("BusinessGood", businessGoodSchema);

export default BusinessGood;
