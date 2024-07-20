import { Types } from "mongoose";

export interface IInventoryGood {
    supplierGood: Types.ObjectId;
    systemCountQuantity?: number;
    currentCountQuantity?: number;
    deviationPercent?: number;
    quantityNeeded?: number;
    lastInventoryCountDate?: Date;
}

export interface IInventory {
    title: string;
    business: Types.ObjectId;
    setFinalCount: boolean;
    inventoryGoods: IInventoryGood[];
    comments?: string;
    countedDate?: Date;
    doneBy?: Types.ObjectId[];
}