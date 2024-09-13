import { Schema, model, models } from "mongoose";
import { paymentMethod } from "./paymentMethod";
import { businessGoodReduceSchema } from "./businessGoodReduce";

const userDailySalesReportSchema = new Schema({
  // required fields
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  }, // user that closed the table, table.responsibleBy

  // optional fields on creation, required on update
  hasOpenTables: { type: Boolean }, // if the user has open tables, the user can view but not close the daily report
  // those "SALES" refer table sales closed by the user (table.responsibleBy)
  // not "SALES" made by the user, the user can close the table of another user if shifts are passed and the previous user has opened the tables
  // when a table is closed, the sales from the previews user is pass to the new one because the new user is responsible for the table and will handle the payment in the end
  userPaymentMethods: [paymentMethod], // array of payment methods used by the user
  totalSalesBeforeAdjustments: { type: Number }, // sum of all orders made by the table.closedBy regardless of promotions, discounts, voids, or cancellations
  totalNetPaidAmount: { type: Number }, // sum of all orders after adjustments have been made to the final price, vois, invitations, discounts, and promotions
  totalTipsReceived: { type: Number }, // sum of all tips
  totalCostOfGoodsSold: { type: Number }, // sum of the cost price of all goods sold by the user
  // if table is passed to another user, new user will be responsible for the previews sales, and also the customers served at the table will be pass to the new user
  // we recomment users to close their tables on a shift change, so the individual analitics by user will be more accurate
  // this has no negative impact on the business analitics, because the sales will be passed to the new user, and the customers served will be passed to the new user
  totalCustomersServed: {
    type: Number,
    default: 0,
  }, // total of customers served
  averageCustomerExpenditure: {
    type: Number,
    default: 0,
  }, // average of customers expended (total of customers served / total of sales)
  // those "GOODS" refer to the goods sold or void by the user itself, not the one that closed the table (order.user)
  soldGoods: [businessGoodReduceSchema], // array of goods sold by the user
  voidedGoods: [businessGoodReduceSchema], // array of goods void by the user
  invitedGoods: [businessGoodReduceSchema], // array of goods invited by the user
  totalVoidValue: { type: Number }, // sum of the price of the voided items
  totalInvitedValue: { type: Number }, // sum of the price of the invited items
}); // individual sales report of the user

const dailySalesReportSchema = new Schema(
  {
    // required fields
    dailyReferenceNumber: { type: Number, required: true, unique: true }, // This is the reference number of the work day, we cant use dates to refer to work day because one work day can be closed in the next day, therefore we need a reference number to refer to the work day report.
    isDailyReportOpen: { type: Boolean, required: true, default: true }, // This is the status of the daily report, if it is open or closed, if it is open the user can still add sales to the report, if it is closed the user can only see the report. Once close all the calculations will be done and the report will be closed for editing.
    timeCountdownToClose: { type: Number, required: true }, // This date is the limit date to close the daily report, it usualy will be the next 24 hours after the current dailyReferenceNumber is created.
    usersDailySalesReport: {
      type: [userDailySalesReportSchema],
      required: true,
    }, // array of objects with each individual sales report of the user
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
    },

    // optional fields for creation, required for update
    businessPaymentMethods: [paymentMethod], // array of all payment methods and its total sales
    dailyTotalSalesBeforeAdjustments: { type: Number }, // sum of all users sales
    dailyNetPaidAmount: { type: Number }, // sum of all users netPaid
    dailyTipsReceived: { type: Number }, // sum of all users tips
    dailyCostOfGoodsSold: { type: Number }, // sum of all goods costPrice incluiding voids and invitaions
    dailyProfit: { type: Number }, // difference between totalNetPaid and totalCost (totalNetPaid - totalCost)
    dailyCustomersServed: { type: Number }, // sum of all users customersServed
    dailyAverageCustomerExpenditure: { type: Number }, // average of all users customersExpended (totalNetPaid / dailyCustomersServed)
    dailySoldGoods: [businessGoodReduceSchema], // array of goods sold on the day
    dailyVoidedGoods: [businessGoodReduceSchema], // array of goods void on the day
    dailyInvitedGoods: [businessGoodReduceSchema], // array of goods invited on the day
    dailyTotalVoidValue: { type: Number }, // sum of the price of the void items
    dailyTotalInvitedValue: { type: Number }, // sum of the price of the invited items
    dailyPosSystemCommission: { type: Number }, // comission of the POS system app
  },
  { timestamps: true, minimize: false }
);

const DailySalesReport =
  models.DailySalesReport || model("DailySalesReport", dailySalesReportSchema);
export default DailySalesReport;
