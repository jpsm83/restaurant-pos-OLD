import { Types } from "mongoose";

export interface IIngredients {
  supplierGood: Types.ObjectId;
  measurementUnit: convert.Unit;
  requiredQuantity: number;
  costOfRequiredQuantity?: number;
  [key: string]: string | number | undefined | Types.ObjectId;
}

export interface IBusinessGood {
  name: string;
  keyword: string;
  mainCategory: string;
  subCategory?: string;
  onMenu: boolean;
  available: boolean;
  sellingPrice: number;
  business?: Types.ObjectId;
  ingredients?: IIngredients[];
  setMenu?: Types.ObjectId[];
  costPrice?: number;
  description?: string;
  allergens?: string[];
  imageUrl?: string;
  deliveryTime?: number;
}
