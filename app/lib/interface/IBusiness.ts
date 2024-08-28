import { Types } from "mongoose";
import { IAddress } from "./IAddress";

export interface ISalesLocation {
  locationReferenceName: string;
  locationType?: string;
  selfOrdering: boolean;
  qrCode: string;
  qrEnabled: boolean;
  qrLastScanned?: Date;
  _id?: Types.ObjectId;
}

export interface IBusiness {
  tradeName: string;
  legalName: string;
  imageUrl?: string;
  email: string;
  password: string;
  phoneNumber: string;
  taxNumber: string;
  currencyTrade: string;
  subscription: string;
  address: IAddress;
  contactPerson?: string;
  salesLocation?: ISalesLocation[];
}