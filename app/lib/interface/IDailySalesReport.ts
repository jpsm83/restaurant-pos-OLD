import { Types } from "mongoose";
import { IPaymentMethod } from "./IPaymentMethod";

export interface IGoodsReduced {
  businessGoodId: Types.ObjectId; // reference to the "Order" model
  quantity: number; // quantity of the good sold or void
  totalPrice: number; // total price of the good sold or void
  totalCostPrice: number; // total cost price of the good sold or void
}

export interface IUserDailySalesReport {
  userId: Types.ObjectId;
  hasOpenSalesInstances?: boolean;
  userPaymentMethods?: IPaymentMethod[];
  totalSalesBeforeAdjustments?: number;
  totalNetPaidAmount?: number;
  totalTipsReceived?: number;
  totalCostOfGoodsSold?: number;
  totalCustomersServed?: number;
  averageCustomerExpenditure?: number;
  soldGoods?: IGoodsReduced[];
  voidedGoods?: IGoodsReduced[];
  invitedGoods?: IGoodsReduced[];
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
  dailySoldGoods?: IGoodsReduced[];
  dailyVoidedGoods?: IGoodsReduced[];
  dailyInvitedGoods?: IGoodsReduced[];
  dailyTotalVoidValue?: number;
  dailyTotalInvitedValue?: number;
  dailyPosSystemCommission?: number;
}
