import { Types } from "mongoose";

export interface ISupplierGood {
    _id: Types.ObjectId;
    name: string;
    keyword: string;
    category: string;
    subCategory: string;
    currentlyInUse: boolean;
    supplier: Types.ObjectId;
    business: Types.ObjectId;
    description?: string;
    allergen?: string[];
    budgetImpact?: string;
    image?: string;
    saleUnit?: string;
    wholeSalePrice?: number;
    measurementUnit?: string;
    totalQuantityPerUnit?: number;
    pricePerUnit?: number;
    parLevel?: number;
    minimumQuantityRequired?: number;
    inventorySchedule?: string;
    dynamicCountFromLastInventory: number;
}