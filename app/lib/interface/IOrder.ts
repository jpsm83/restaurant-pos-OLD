import { Types } from "mongoose";
import { IPayment } from "./IPayment";

export interface IOrder {
    _id?: Types.ObjectId;
    dailyReferenceNumber: number;
    orderPrice: number;
    orderNetPrice: number;
    orderCostPrice: number;
    user: Types.ObjectId;
    userRole?: string;
    table: Types.ObjectId;
    businessGoods: Types.ObjectId[];
    businessGoodsCategory?: string;
    business: Types.ObjectId;
    orderStatus?: string;
    orderCode: string;
    allergens?: string[];
    promotionApplyed?: string;
    discountPercentage?: number;
    comments?: string;
    billingStatus?: string;
    paymentMethod?: IPayment[];
}
