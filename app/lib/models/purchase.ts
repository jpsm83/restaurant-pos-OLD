import { Schema, model, models } from "mongoose";

// on the time of record the purchase, user should be able to select the supplier good in a dropdown
// and from there user should be able to see the supplierGood.pricePerUnit to compare with the price of the purchase
// if they are not the same, the user should be able to edit the supplierGood.pricePerUnit
const purchaseItemSchema = new Schema({
  supplierGoodId: {
    type: Schema.Types.ObjectId,
    ref: "SupplierGood",
    required: true,
  }, // Reference to the specific good

  // ************************* IMPORTANT *************************
  // this quantity is base on the supplierGood.MEAUREMENTUNIT - NOT on the supplierGood.SALEUNIT
  quantityPurchased: { type: Number, required: true }, // Quantity of this good purchased - ex: 10kg, 1L, 5 units
  // *************************************************************

  // ************************* IMPORTANT *************************
  purchasePrice: { type: Number, required: true }, // this is calculate on the FRONT before be saved on DB supplierGood.pricePerUnit * quantityPurchased for user confirmation
  // ex: 10kg * 2€ = 20€ - if the receipt says 25€, the user should be able to edit the supplierGood.pricePerUnit
});

const purchaseSchema = new Schema(
  {
    supplierId: {
      type: Schema.Types.ObjectId,
      ref: "Supplier",
      required: true,
    }, // Supplier from whom the goods are purchased
    imageUrl: { type: String }, // Photo of the receipt
    purchaseDate: { type: Date, required: true }, // Date of the purchase
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
    }, // Business that made the purchase
    purchasedByUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    }, // User who made the purchase
    purchaseItems: [purchaseItemSchema], // Array of goods in this purchase
    totalAmount: { type: Number, required: true }, // Total price of the purchase
    receiptId: { type: String, required: true }, // supplier receipt identification from supplier - if not available, system will generate one
  },
  {
    timestamps: true,
    minimize: false,
  }
);

const Purchase = models.Purchase || model("Purchase", purchaseSchema);
export default Purchase;
