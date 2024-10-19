import { Types } from "mongoose";

export interface IInventoryCount {
  _id?: Types.ObjectId;
  countedDate?: Date;
  currentCountQuantity: number;
  deviationPercent?: number;
  quantityNeeded?: number;
  countedByUserId: Types.ObjectId;
  comments?: string;
  reedited?: {
    reeditedByUserId: Types.ObjectId;
    date: Date;
    reason: string;
    originalValues: {
      currentCountQuantity: number | null;
      dynamicSystemCount: number | null;
      deviationPercent: number | null;
    };
  };
}

export interface IInventoryGood {
  supplierGoodId: Types.ObjectId;
  monthlyCounts: IInventoryCount[];
  averageDeviationPercent?: number;
  dynamicSystemCount: number;
}

export interface IInventory {
  businessId: Types.ObjectId;
  setFinalCount: boolean;
  inventoryGoods: IInventoryGood[];
}