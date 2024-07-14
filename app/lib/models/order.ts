import { Schema, model, models } from "mongoose";
import { allergens, billingStatus, orderStatus } from "../enums.js";

// example of a payment method object
// paymentMethod = [
//   {
//     method: "Card",
//     card: "Visa",
//     paymentMethodAmount: 40,
//   },
//   {
//     method: "Cash",
//     paymentMethodAmount: 60,
//   },
// ];

const paymentMethodSchema = new Schema({
  method: {
    type: String,
    enum: ["Cash", "Card", "Crypto", "Other"],
    required: true,
  }, // payment method used by the client
  card: {
    type: String,
    enum: ["Visa", "MasterCard", "Dinners", "American Express", "Others"],
    required: function () {
      // @ts-ignore
      return this.method === "Card";
    },
  }, // card used by the client
  crypto: {
    type: String,
    enum: ["Bitcoin", "Ethereum"],
    required: function () {
      // @ts-ignore
      return this.method === "Crypto";
    },
  }, // crypto used by the client
  other: {
    type: String,
    required: function () {
      // @ts-ignore
      return this.method === "Other";
    },
  }, // other payment method used by the client
  paymentMethodAmount: {
    type: Number,
    required: true,
  }, // amount paid by the client
});

const orderSchema = new Schema(
  {
    // required fields
    dayReferenceNumber: { type: Number, required: true }, // reference number for the day, every object create in the same day will have the same reference number
    
    // OPEN - order is open and can be paid
    // PAID - order is paid and can't be changed
    // VOID - order been done but is voided by manager, good been lost and business will not be paid, ex: client left without paying, good was badly done and have to be remake, mistake was made
    // CANCEL - good been order but has not been done and is cancel by manager, there is no lost for the business, ex: user order by mistake and cancel it before it is done
    // INVITATION - order is an invitation, no payment is required, ex: business is offering a free meal to a client
    billingStatus: {
      type: String,
      enum: billingStatus,
      default: "Open",
      required: true,
    }, // general status regarding the payment of the order - only VOID, CANCEL and INVITATION can be manually changed by user
    orderStatus: {
      type: String,
      enum: orderStatus,
      default: "Sent",
      required: true,
    }, // status regarding the order action to be taken or already taken
    orderPrice: { type: Number, required: true }, // final price of the sun of product being sold regardless of any discounts, voids, or cancellations
    orderNetPrice: { type: Number, required: true }, // amount after adjustments have been made to the final price, vois, invitations, discounts and promotions
    orderCostPrice: { type: Number, required: true }, // cost price of the sun of product being sold regardless of any discounts, voids, or cancellations
    user: { type: Schema.Types.ObjectId, ref: "User", required: true }, // user that made the order
    table: {
      type: Schema.Types.ObjectId,
      ref: "Table",
      required: true,
    }, // table where the order was made
    businessGoods: {
      type: [Schema.Types.ObjectId],
      ref: "BusinessGood",
      required: true,
    }, // can be an aray of business goods (3) "burger with extra cheese and add bacon"
    business: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
    }, // business where the order was made

    // non required fields
    orderTips: { type: Number }, // tips given or amount left by the client
    paymentMethod: {
      type: [paymentMethodSchema],
      default: undefined,
    },
    allergens: { type: [String], enum: allergens, default: undefined }, // this property is manualy added by the user, the pos will filter all the business goods allergens that applyed and dont offer them to be purchased, this value will go to the kitcken
    promotionApplyed: { type: String }, // check if promotion is applyed by promotion date and time - done on the front end
    discountPercentage: { type: Number }, // percentage discount applyed manually to the order
    comments: { type: String }, // if discount, void or cancel are applyed, the reason for it or if or if kitchen needs to know something
  },
  {
    timestamps: true,
    minimize: false,
  }
);

const Order = models.Order || model("Order", orderSchema);

export default Order;
