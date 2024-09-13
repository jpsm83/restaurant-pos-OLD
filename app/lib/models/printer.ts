import { Schema, model, models } from "mongoose";
import { mainCategories, foodSubCategory, beverageSubCategory, merchandiseSubCategory, othersSubcategory} from "../enums";

// {
//   "printerName": "Desert Printer",
//   "connected": true,
//   "ipAddress": "192.168.1.100",
//   "port": 9100,
//   "business": "60d5ecb8b3920c56aef7e633",
//   "printFor": {
//     "user": ["60d5ecb8b3920c56aef7e634", "60d5ecb8b3920c56aef7e635"],
//     "category": ["Food", "Beverage"],
//     "subCategory": ["dessert", "coffee&tea"]
//   },
//   "location": "Kitchen",
//   "description": "This printer is used for printing dessert orders"
// }

const printerSchema = new Schema(
  {
    // required fields
    printerName: { type: String, required: true }, // name of the printer "Desert Printer"
    connected: { type: Boolean, required: true }, // is printer working?
    ipAddress: { type: String, required: true, unique: true }, // IP address of the printer
    port: { type: Number, required: true }, // port of the printer
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
    }, // business that owns the printer

    // non-required fields
    printFor: {
      usersId: {
        type: [{ type: Schema.Types.ObjectId, ref: 'User', default: undefined}],
      },
      mainCategories: {
        type: [String],
        enum: mainCategories,
        default: undefined,
      },
      subCategories: {
        type: [String],
        enum: foodSubCategory || beverageSubCategory || merchandiseSubCategory || othersSubcategory,
        default: undefined,
      },
    }, // whon and what the printer prints for
    location: { type: String }, // location of the printer "Kitchen"
    description: { type: String }, // description of the printer
  },
  { timestamps: true, minimize: false }
);

const Printer = models.Printer || model("Printer", printerSchema);
export default Printer;