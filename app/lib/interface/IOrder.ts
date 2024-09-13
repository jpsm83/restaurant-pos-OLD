import { Types } from "mongoose";
import { IPaymentMethod } from "./IPaymentMethod";

export interface IOrder {
    _id?: Types.ObjectId;
    dailyReferenceNumber: number;
    orderPrice: number;
    orderNetPrice: number;
    orderCostPrice: number;
    userId: Types.ObjectId;
    userRole?: string;
    tableId: Types.ObjectId;
    businessGoodsIds: Types.ObjectId[];
    businessGoodsCategory?: string;
    businessId: Types.ObjectId;
    orderStatus?: string;
    orderCode: string;
    allergens?: string[];
    promotionApplyed?: string;
    discountPercentage?: number;
    comments?: string;
    billingStatus?: string;
    paymentMethod?: IPaymentMethod[];
}
