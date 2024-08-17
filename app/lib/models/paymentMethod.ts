import { Schema } from "mongoose";

import {
  paymentMethods,
  cardTypes,
  cryptoTypes,
  otherPaymentTypes,
} from "../enums.js";

// example of a payment method object
// paymentMethod = [
//   {
//     paymentMethodType: "Cash",
//     methdBranch: "Cash",
//     methodSalesTotal: 100,
//   },
//   {
//     paymentMethodType: "Card",
//     methdBranch: "Visa",
//     methodSalesTotal: 150,
//   },
//   {
//     paymentMethodType: "Crypto",
//     methdBranch: "Bitcoin",
//     methodSalesTotal: 200,
//   },
//   {
//     paymentMethodType: "Other",
//     methdBranch: "Voucher",
//     methodSalesTotal: 50,
//   },
// ];

// Define the generic payment method schema
export const paymentMethod = new Schema({
  paymentMethodType: {
    type: String,
    required: true,
    enum: paymentMethods, // Add more types as needed
  },
  methodBranch: {
    type: String,
    required: true,
  }, // Branch/type of the payment method (e.g., card branch, crypto type, etc.)
  methodSalesTotal: {
    type: Number,
    required: true,
  }, // Sum of sales for this payment method
});
