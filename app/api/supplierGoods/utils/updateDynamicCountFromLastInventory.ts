import { Types } from "mongoose";

export const updateDynamicCountFromLastInventory = async (supplierGood: Types.ObjectId, currentCountQuantity: number) => {
    return supplierGood + " " + currentCountQuantity;
};