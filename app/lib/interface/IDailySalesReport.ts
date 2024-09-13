import { Types } from "mongoose";
import { IPaymentMethod } from "./IPaymentMethod";

export interface IUserGoods {
  good: Types.ObjectId;
  quantity: number;
  totalPrice: number;
  totalCostPrice: number;
}

export interface IUserDailySalesReport {
  userId: Types.ObjectId;
  hasOpenTables?: boolean;
  userPaymentMethods?: IPaymentMethod[];
  totalSalesBeforeAdjustments?: number;
  totalNetPaidAmount?: number;
  totalTipsReceived?: number;
  totalCostOfGoodsSold?: number;
  totalCustomersServed?: number;
  averageCustomerExpenditure?: number;
  soldGoods?: IUserGoods[];
  voidedGoods?: IUserGoods[];
  invitedGoods?: IUserGoods[];
  totalVoidValue?: number;
  totalInvitedValue?: number;
}

export interface IDailySalesReport {
  _id?: Types.ObjectId;
  dailyReferenceNumber: number;
  isDailyReportOpen: boolean;
  timeCountdownToClose: number;
  usersDailySalesReport: IUserDailySalesReport[];
  businessId: Types.ObjectId;
  businessPaymentMethods?: IPaymentMethod[];
  dailyTotalSalesBeforeAdjustments?: number;
  dailyNetPaidAmount?: number;
  dailyTipsReceived?: number;
  dailyCostOfGoodsSold?: number;
  dailyProfit?: number;
  dailyCustomersServed?: number;
  dailyAverageCustomerExpenditure?: number;
  dailySoldGoods?: IUserGoods[];
  dailyVoidedGoods?: IUserGoods[];
  dailyInvitedGoods?: IUserGoods[];
  dailyTotalVoidValue?: number;
  dailyTotalInvitedValue?: number;
  dailyPosSystemCommission?: number;
}
