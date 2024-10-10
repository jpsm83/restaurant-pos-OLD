import { Schema, model, models } from "mongoose";
import { tableStatus } from "../enums.js";

const salesInstanceSchema = new Schema(
  {
    // required fields
    dailyReferenceNumber: { type: Number, required: true }, // reference number for the day, every object create in the same day will have the same reference number
    salesInstanceReferenceId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
    }, // reference with the business sales instance
    guests: { type: Number, required: true }, // number of guests in the table - REQUIRED FOR ANALYTICS
    status: { type: String, enum: tableStatus, default: "Occupied" }, // status of the table
    openedById: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    }, // user that opened the table
    responsibleById: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    }, // user that is responsible for the table - one user can open, finish the shift then pass the responsability to another user
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
    }, // business where the table is located

    // non required fields
    clientName: { type: String }, // name of the client that is in the table
    ordersIds: {
      type: [Schema.Types.ObjectId],
      ref: "Order",
      default: undefined,
    }, // array of orders made in the table
    closedAt: { type: Date }, // date and time when the table was closed
    closedById: { type: Schema.Types.ObjectId, ref: "User" }, // user that closed the table, same as responsibleBy
  },
  { timestamps: true, minimize: false }
);

const SalesInstance = models.SalesInstance || model("SalesInstance", salesInstanceSchema);
export default SalesInstance;