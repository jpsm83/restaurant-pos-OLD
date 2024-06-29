import { Types } from "mongoose";

export interface IIngredients {
    ingredient: Types.ObjectId;
    measurementUnit: convert.Unit;
    requiredQuantity: number;
    costOfRequiredQuantity?: number;
    [key: string]: string | number | undefined | Types.ObjectId;
  }
  
  export interface IBusinessGood {
    name: string;
    keyword: string;
    category: {
      mainCategory: string;
      setMenuSubCategory?: string;
      foodSubCategory?: string;
      beverageSubCategory?: string;
      merchandiseSubCategory?: string;
    };
    onMenu: boolean;
    available: boolean;
    sellingPrice: number;
    subCategory?: string;
    business?: Types.ObjectId;
    ingredients?: IIngredients[];
    setMenu?: Types.ObjectId[];
    costPrice?: number;
    description?: string;
    allergens?: string[];
    image?: string;
    deliveryTime?: number;
  }