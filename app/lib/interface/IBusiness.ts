import { IAddress } from "./IAddress";

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
  businessTables?: string[] | undefined;
}
