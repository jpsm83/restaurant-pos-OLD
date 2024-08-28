import { Schema, model, models } from "mongoose";
import { addressSchema } from "./address";

const supplierSchema = new Schema(
  {
    // required fields
    tradeName: { type: String, required: true }, // Suplier company Name for the public
    legalName: { type: String, required: true }, // Legal Name of the suplier company
    imageUrl: { type: String }, // Logo of the suplier company
    email: { type: String, required: true, unique: true }, // Email of the suplier
    phoneNumber: { type: String, required: true }, // Phone number of the suplier
    taxNumber: { type: String, required: true, unique: true }, // Tax number of the suplier
    currentlyInUse: { type: Boolean, default: true, required: true }, // currenctly dealing with the suplier
    business: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
    }, // business that is buying from the suplier

    // optional fields
    address: addressSchema, // Address of the suplier
    contactPerson: { type: String }, // Contact person of the suplier
    supplierGoods: {
      type: [Schema.Types.ObjectId],
      ref: "SupplierGood",
      default: undefined,
    }, // array of supplier goods we are buying from this supplier
  },
  {
    timestamps: true,
    minimize: false,
  }
);

const Supplier = models.Supplier || model("Supplier", supplierSchema);
export default Supplier;