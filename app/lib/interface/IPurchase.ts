import { Types } from "mongoose";

export interface IPurchaseItem {
  supplierGoodId: Types.ObjectId;
  quantityPurchased: number;
  purchasePrice: number;
}

export interface IPurchase {
  supplierId: Types.ObjectId;
  imageUrl?: string;
  purchaseDate: Date;
  businessId: Types.ObjectId;
  purchasedByUserId: Types.ObjectId;
  purchaseItems: IPurchaseItem[];
  totalAmount: number;
  receiptId: string;
}
