import { Schema, model, models } from "mongoose";
import { tableStatus } from "../enums.js";

const tableSchema = new Schema(
  {
    // required fields
    dayReferenceNumber: { type: Number, required: true }, // reference number for the day, every object create in the same day will have the same reference number
    tableReference: { type: String, required: true }, // reference for the table - have to match the businessTables array in the business
    guests: { type: Number, required: true }, // number of guests in the table - REQUIRED FOR ANALYTICS
    status: { type: String, enum: tableStatus, default: "Occupied", required: true }, // status of the table
    openedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    }, // user that opened the table
    responsibleBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    }, // user that is responsible for the table - one user can open, finish the shift then pass the responsability to another user
    business: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
    }, // business where the table is located

    // non required fields
    clientName: { type: String }, // name of the client that is in the table
    tableTotalPrice: { type: Number }, // table total price is the sum of all orders prices regardless of any discounts, voids, or cancellations - sum of all orders orderPrice
    tableTotalNetPaid: { type: Number }, // amount after adjustments have been made to the final price, vois, invitations, discounts and promotions - sum of all orders orderNetPrice
    tableTotalTips: { type: Number }, // sum of all orders tips
    orders: {
      type: [Schema.Types.ObjectId],
      ref: "Order",
      default: undefined,
    }, // array of orders made in the table
    closedAt: { type: Date }, // date and time when the table was closed
    closedBy: { type: Schema.Types.ObjectId, ref: "User" }, // user that closed the table, same as responsibleBy
  },
  { timestamps: true, minimize: false }
);

const Table = models.Table || model("Table", tableSchema);

export default Table;
