import { Types } from "mongoose";

export interface IPromotionPeriod {
  start: Date;
  end: Date;
}

export interface IPromotion {
  promotionName: string;
  promotionPeriod: IPromotionPeriod;
  weekDays: string[];
  promotionType: string;
  activePromotion: boolean;
  business: Types.ObjectId;
  fixedPrice?: number;
  discountPercent?: number;
  twoForOne?: boolean;
  threeForTwo?: boolean;
  secondHalfPrice?: boolean;
  fullComplimentary?: boolean;
  businessGoodsToApply?: Types.ObjectId[];
  description?: string;
}
