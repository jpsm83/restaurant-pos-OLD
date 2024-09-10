import { Schema, model, models } from "mongoose";

export const businessGoodReduceSchema = new Schema({
  good: {
    type: Schema.Types.ObjectId,
    ref: "Order",
    required: true,
  }, // good sold or void
  quantity: {
    type: Number,
    required: true,
  }, // quanity of the good sold or void
  totalPrice: { type: Number, required: true }, // total price of the good sold or void
  totalCostPrice: { type: Number, required: true }, // total cost price of the good sold or void
});
