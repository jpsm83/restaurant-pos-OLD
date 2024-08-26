import { Types } from "mongoose";

interface IInventoryCount {
  countedDate: Date;
  currentCountQuantity: number;
  systemCountQuantity: number;
  deviationPercent: number;
  quantityNeeded?: number;
  countedBy: Types.ObjectId;
  comments?: string;
  reedited?: {
    reeditedBy: Types.ObjectId;
    date: Date;
    reason: string;
    originalValues: {
      currentCountQuantity: number;
      systemCountQuantity: number;
      deviationPercent: number;
    };
  };
}

interface IInventoryGoods {
  supplierGood: Types.ObjectId;
  monthlyCounts: IInventoryCount[];
  averageDeviationPercent: number;
  dynamicCountFromLastInventory: number;
}

interface IInventory {
  business: Types.ObjectId;
  setFinalCount: boolean;
  inventoryGoods: IInventoryGoods[];
}

export default IInventory;
