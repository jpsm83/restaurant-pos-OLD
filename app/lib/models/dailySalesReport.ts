import { Schema, model, models } from "mongoose";
import { paymentMethod } from "./paymentMethod";

const userGoodsSchema = new Schema({
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

const userDailySalesReportArraySchema = new Schema({
  // required fields
  user: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  }, // user that closed the table, table.responsibleBy

  // optional fields on creation, required on update
  hasOpenTables: { type: Boolean }, // if the user has open tables, the user can view but not close the daily report
  // those "SALES" refer table sales closed by the user (table.responsibleBy)
  // not "SALES" made by the user, the user can close the table of another user if shifts are passed and the previous user has opened the tables
  // when a table is closed, the sales from the previews user is pass to the new one because the new user is responsible for the table and will handle the payment in the end
  userPayments: [paymentMethod], // array of payment methods used by the user
  userTotalSales: { type: Number }, // sum of all orders made by the table.closedBy regardless of promotions, discounts, voids, or cancellations
  userTotalNetPaid: { type: Number }, // sum of all orders after adjustments have been made to the final price, vois, invitations, discounts, and promotions
  userTotalTips: { type: Number }, // sum of all tips
  // if table is passed to another user, new user will be responsible for the previews sales, and also the customers served at the table will be pass to the new user
  // we recomment users to close their tables on a shift change, so the individual analitics by user will be more accurate
  // this has no negative impact on the business analitics, because the sales will be passed to the new user, and the customers served will be passed to the new user
  userCustomersServed: {
    type: Number,
    default: 0,
  }, // total of customers served
  userAverageCustomersExpended: {
    type: Number,
    default: 0,
  }, // average of customers expended (total of customers served / total of sales)

  // those "GOODS" refer to the goods sold or void by the user itself, not the one that closed the table (order.user)
  userGoodsSoldArray: [userGoodsSchema], // array of goods sold by the user
  userGoodsVoidArray: [userGoodsSchema], // array of goods void by the user
  userGoodsInvitedArray: [userGoodsSchema], // array of goods invited by the user
  userTotalVoid: { type: Number }, // sum of the price of the voided items
  userTotalInvited: { type: Number }, // sum of the price of the invited items
}); // individual sales report of the user

const dailySalesReportSchema = new Schema(
  {
    // required fields
    dayReferenceNumber: { type: Number, required: true, unique: true }, // This is the reference number of the work day, we cant use dates to refer to work day because one work day can be closed in the next day, therefore we need a reference number to refer to the work day report.
    dailyReportOpen: { type: Boolean, required: true, default: true }, // This is the status of the daily report, if it is open or closed, if it is open the user can still add sales to the report, if it is closed the user can only see the report. Once close all the calculations will be done and the report will be closed for editing.
    countdownTimeToClose: { type: Number, required: true }, // This date is the limit date to close the daily report, it usualy will be the next 24 hours after the current dayReferenceNumber is created.
    usersDailySalesReport: {
      type: [userDailySalesReportArraySchema],
      required: true,
    }, // array of objects with each individual sales report of the user
    business: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
    },

    // optional fields for creation, required for update
    totalPayments: [paymentMethod], // array of all payment methods and its total sales
    totalSales: { type: Number }, // sum of all users sales
    totalNetPaid: { type: Number }, // sum of all users netPaid
    totaltips: { type: Number }, // sum of all users tips
    totalCost: { type: Number }, // sum of all goods costPrice incluiding voids and invitaions
    profit: { type: Number }, // difference between totalNetPaid and totalCost (totalNetPaid - totalCost)
    businessTotalCustomersServed: { type: Number }, // sum of all users customersServed
    businessAverageCustomersExpended: { type: Number }, // average of all users customersExpended (totalNetPaid / businessTotalCustomersServed)
    businessGoodsSoldArray: [userGoodsSchema], // array of goods sold on the day
    businessGoodsVoidArray: [userGoodsSchema], // array of goods void on the day
    businessGoodsInvitedArray: [userGoodsSchema], // array of goods invited on the day
    businessTotalVoidPrice: { type: Number }, // sum of the price of the void items
    businessTotalInvitedPrice: { type: Number }, // sum of the price of the invited items
    posSystemAppComission: { type: Number }, // comission of the POS system app
  },
  { timestamps: true, minimize: false }
);

const DailySalesReport = models.DailySalesReport || model("DailySalesReport", dailySalesReportSchema);
export default DailySalesReport;