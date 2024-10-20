import { Types } from "mongoose";

export interface IInventoryCount {
  _id?: Types.ObjectId;
  countedDate?: Date;
  currentCountQuantity: number;
  deviationPercent?: number;
  quantityNeeded?: number;
  countedByUserId: Types.ObjectId;
  lastCount?: boolean;
  comments?: string;
  reedited?: {
    reeditedByUserId: Types.ObjectId;
    date: Date;
    reason: string;
    originalValues: {
      currentCountQuantity: number;
      dynamicSystemCount: number;
      deviationPercent: number;
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