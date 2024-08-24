import { Schema, model, models } from "mongoose";

// Schema for individual count events
const inventoryCountSchema = new Schema({
  countedDate: { type: Date, required: true, default: Date.now }, // Date when the count was performed
  currentCountQuantity: { type: Number, required: true }, // quantity of the good in the current real count, when goods are delivered, the quantity will be added to the currentCountQuantity
  systemCountQuantity: { type: Number, required: true }, // is the value of the supplierGood.dynamicCountFromLastInventory at the time of the inventory count
  deviationPercent: { type: Number, required: true, default: 0 }, // differece between the systemCountQuantity and the currentCountQuantity in percentage. For a perfect inventory, this number should be 0
  countedBy: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  }, // User who counted
  comments: { type: String }, // Comments about the inventory
  // counte cannot be re-edited once is send, if there is a mistake, the user will have to contact the admin to re-edit and this will be recorded in the reedited field
  reedited: {
    by: { type: Schema.Types.ObjectId, ref: "User" }, // User who re-edited
    date: { type: Date, default: Date.now }, // Date when the re-edit occurred
    reason: { type: String }, // Reason for the re-edit
    originalValues: {
      currentCountQuantity: { type: Number },
      systemCountQuantity: { type: Number },
      deviationPercent: { type: Number },
    }, // Original values before re-edit
  },
});

const inventoryGoodsSchema = new Schema({
  supplierGood: {
    type: Schema.Types.ObjectId,
    ref: "SupplierGood",
    required: true,
  }, // Good in the inventory

  monthlyCounts: [inventoryCountSchema], // Array of count events for the month
  averageDeviationPercent: { type: Number }, // sun of all average deviation percent for the month divide by the number of counts
  quantityNeeded: { type: Number }, // quantity needed to reach the parLevel. Difference between the parLevel and the currentCountQuantity. parLevel is defined in the supplierGood
});

// Inventory schema to manage the overall inventory event of the month (1 month = 1 inventory)
const inventorySchema = new Schema(
  {
    business: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
    }, // Business that the inventory belongs to
    setFinalCount: { type: Boolean, required: true, default: false }, // Locking mechanism to prevent further counts, is auto set to true on the final of the last day of the month
    // on the first day of the month, the system will create a new inventory with all the supplier goods and setFinalCount to false
    inventoryGoods: {
      type: [inventoryGoodsSchema],
      required: true,
    }, // Supplier goods that exists on the business
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    }, // Users who recorded the inventory into the app (usualy a manager/admin)
  },
  {
    timestamps: true,
    minimize: false,
  }
);

// Create the model
const Inventory = models.Inventory || model("Inventory", inventorySchema);
export default Inventory;
