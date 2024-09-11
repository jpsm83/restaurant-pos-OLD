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
  userPaymentMethods?: IPayment[];
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

export interface IDailySalesReport extends IBaseSales {
  _id?: Types.ObjectId;
  dailyReferenceNumber: number;
  isDailyReportOpen: boolean;
  timeCountdownToClose: number;
  usersDailySalesReport: IUserDailySalesReport[];
  business: Types.ObjectId;
  businessPaymentMethods?: IPayment[];
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
