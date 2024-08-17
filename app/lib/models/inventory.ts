import { Schema, model, models } from "mongoose";

const inventoryGoodsSchema = new Schema({
  // required fields
  supplierGood: {
    type: Schema.Types.ObjectId,
    ref: "SupplierGood",
    required: true,
  }, // good that is in the inventory

  // optional fields on creation
  // those properties will be calculated during the update of the inventory
  systemCountQuantity: { type: Number }, // is the value of the supplierGood.dynamicCountFromLastInventory at the time of the inventory count
  currentCountQuantity: { type: Number }, // quantity of the good in the current real count
  deviationPercent: { type: Number }, // differece between the systemCountQuantity and the currentCountQuantity in percentage. For a perfect inventory, this number should be 0
  quantityNeeded: { type: Number }, // quantity needed to reach the parLevel. Difference between the parLevel and the currentCountQuantity
});

// Then the supplierGood.dynamicCountFromLastInventory will be updated to the currentCountQuantity
const inventorySchema = new Schema(
  {
    title: { type: String, required: true }, // title of the inventory
    // required fields
    business: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
    }, // business that the inventory belongs to
    setFinalCount: { type: Boolean, required: true, default: false }, // set to true after inventory has been counted, it cannot update the supplierGood.dynamicCountFromLastInventory
    
    // All goods that are in the inventory
    // only goods that apply for the schedule of the inventory will be in this list (daily, weekly, monthly)
    inventoryGoods: {
      type: [inventoryGoodsSchema],
      required: true,
    },
    
    // optional fields
    comments: { type: String }, // comments about the inventory
    countedDate: { type: Date }, // date that the inventory was counted
    doneBy: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ], // user that counted the inventory, could be done by multiple users
  },
  {
    timestamps: true,
    minimize: false,
  }
);

const Inventory = models.Inventory || model("Inventory", inventorySchema);
export default Inventory;