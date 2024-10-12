import { Types } from "mongoose";
import { IPaymentMethod } from "./IPaymentMethod";

export interface IOrder {
  dailyReferenceNumber: number;
  billingStatus?: string;
  orderStatus?: string;
  orderGrossPrice: number;
  orderNetPrice: number;
  orderCostPrice: number;
  userId: Types.ObjectId;
  salesInstanceId: Types.ObjectId;
  businessGoodsIds: Types.ObjectId[];
  businessId: Types.ObjectId;
  orderTips?: number;
  paymentMethod?: IPaymentMethod[];
  allergens?: string[];
  promotionApplyed?: string;
  discountPercentage?: number;
  comments?: string;
}
