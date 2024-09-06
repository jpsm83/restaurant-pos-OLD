import { Types } from "mongoose";

interface IInventoryCount {
  countedDate: Date;
  currentCountQuantity: number;
  deviationPercent: number;
  quantityNeeded?: number;
  countedByUserId: Types.ObjectId;
  comments?: string;
  reeditedByUserId?: {
    reeditedBy: Types.ObjectId;
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