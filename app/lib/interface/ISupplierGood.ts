import { Types } from "mongoose";

export interface ISupplierGood {
  _id?: Types.ObjectId;
  name: string;
  keyword: string;
  mainCategory: string;
  subCategory?: string;
  currentlyInUse: boolean;
  supplier: Types.ObjectId;
  business?: Types.ObjectId;
  description?: string;
  allergens?: string[];
  budgetImpact?: string;
  imageUrl?: string;
  saleUnit?: string;
  measurementUnit?: string;
  pricePerUnit: number;
  parLevel?: number;
  minimumQuantityRequired?: number;
  inventorySchedule?: string;
}
