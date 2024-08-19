import { Types } from "mongoose";
import { IPayment } from "./IPayment";

export interface IBaseSales {
  [key: string]: any;
}

export interface IUserGoods {
  good: Types.ObjectId;
  quantity: number;
  totalPrice: number;
  totalCostPrice: number;
}

export interface IUserDailySalesReport extends IBaseSales {
  user: Types.ObjectId;
  hasOpenTables?: boolean;
  userPayments?: IPayment[];
  userTotalSales?: number;
  userTotalNetPaid?: number;
  userTotalTips?: number;
  userTotalCost?: number;
  userCustomersServed?: number;
  userAverageCustomersExpended?: number;
  userGoodsSoldArray?: IUserGoods[];
  userGoodsVoidArray?: IUserGoods[];
  userGoodsInvitedArray?: IUserGoods[];
  userTotalVoid?: number;
  userTotalInvited?: number;
}

export interface IDailySalesReport extends IBaseSales {
  _id?: Types.ObjectId;
  dayReferenceNumber: number;
  dailyReportOpen: boolean;
  countdownTimeToClose: number;
  usersDailySalesReport: IUserDailySalesReport[];
  business: Types.ObjectId;
  businessPayments?: IPayment[];
  businessTotalSales?: number;
  businessTotalNetPaid?: number;
  businessTotalTips?: number;
  businessTotalCost?: number;
  businessTotalProfit?: number;
  businessTotalCustomersServed?: number;
  businessAverageCustomersExpended?: number;
  businessGoodsSoldArray?: IUserGoods[];
  businessGoodsVoidArray?: IUserGoods[];
  businessGoodsInvitedArray?: IUserGoods[];
  businessTotalVoidPrice?: number;
  businessTotalInvitedPrice?: number;
  posSystemAppComission?: number;
}
