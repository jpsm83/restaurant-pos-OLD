import { Types } from "mongoose";
import { IAddress } from "./IAddress";

interface salesLocation {
  locationReferenceName: string;
  locationType?: string;
  selfOrdering: boolean;
  qrCode: string;
  qrEnabled: boolean;
  qrLastScanned?: Date;
}

export interface IBusiness {
  tradeName: string;
  legalName: string;
  email: string;
  password: string;
  phoneNumber: string;
  taxNumber: string;
  currencyTrade: string;
  subscription: string;
  address: IAddress;
  contactPerson?: string;
  salesLocation?: salesLocation[];
}
