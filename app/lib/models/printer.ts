import { Schema, model, models } from "mongoose";

// {
//   "printerName": "Desert Printer",
//   "connected": true,
//   "ipAddress": "192.168.1.100",
//   "port": 9100,
//   "business": "60d5ecb8b3920c56aef7e633",
//   "ifErrorPrintAt": "60d5ecb8b3333356aef7e633",
//   "location": "Kitchen",
//   "description": "This printer is used for printing dessert orders"
// }

const printerSchema = new Schema(
  {
    // required fields
    printerName: { type: String, required: true }, // name of the printer "Desert Printer"
    description: { type: String }, // description of the printer
    connected: { type: Boolean, required: true }, // is printer working?
    ipAddress: { type: String, required: true, unique: true }, // IP address of the printer
    port: { type: Number, required: true }, // port of the printer
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
    }, // business that owns the printer
    backupPrinter: { type: Schema.Types.ObjectId, ref: "Printer" }, // printer reference to print if this printer has an error
  },
  { timestamps: true, minimize: false }
);

const Printer = models.Printer || model("Printer", printerSchema);
export default Printer;
