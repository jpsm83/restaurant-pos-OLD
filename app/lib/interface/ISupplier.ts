import { Types } from "mongoose";
import { IAddress } from "./IAddress";

export interface ISupplier {
  _id?: Types.ObjectId;
  tradeName: string;
  legalName: string;
  email?: string;
  phoneNumber: string;
  taxNumber: string;
  currentlyInUse: boolean;
  business: Types.ObjectId;
  address?: IAddress;
  contactPerson?: string;
  supplierGoods?: Types.ObjectId[];
  imageUrl?: string;
}
