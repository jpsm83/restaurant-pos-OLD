import { Types } from "mongoose";

export interface IInventoryGood {
    supplierGood: Types.ObjectId;
    systemCountQuantity?: number;
    currentCountQuantity?: number;
    deviationPercent?: number;
    quantityNeeded?: number;
}

export interface IInventory {
    currentCountScheduleDate: Date;
    business: string;
    setFinalCount: boolean;
    inventoryGoods: IInventoryGood[];
    countedDate?: Date;
    doneBy?: string;
    previewsCountedDate?: Date;
}