import { Types } from "mongoose";
import { IAddress } from "./IAddress";

export interface IBusinessSalesLocation {
  _id?: Types.ObjectId;
  locationReferenceName: string;
  locationType?: string;
  selfOrdering: boolean;
  qrCode: string;
  qrEnabled: boolean;
  qrLastScanned?: Date;
}

export interface IMetrics {
  foodCostPercentage: number;
  beverageCostPercentage: number;
  laborCostPercentage: number;
  fixedCostPercentage: number;
  supplierGoodWastePercentage: {
    veryLowBudgetImpact: number;
    lowBudgetImpact: number;
    mediumBudgetImpact: number;
    hightBudgetImpact: number;
    veryHightBudgetImpact: number;
  };
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
  metrics?: IMetrics;
  contactPerson?: string;
  salesLocation?: IBusinessSalesLocation[];
}