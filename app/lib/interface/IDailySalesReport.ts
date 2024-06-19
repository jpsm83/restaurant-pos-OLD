import { Types } from 'mongoose';

export interface IBaseSales {
    [key: string]: any;
  }
  
  export interface IUserGoods {
    good: Types.ObjectId;
    quantity: number;
    totalPrice: number;
    totalCostPrice: number;
  }
  
  export interface ICardSales {
    [key: string]: any;
    cardBranch: string;
    cardSales: number;
  }
  
  export interface ICryptoSales {
    [key: string]: any;
    cryptoType: string;
    cryptoSales: number;
  }
  
  export interface IOtherSales {
    [key: string]: any;
    otherType: string;
    otherSales: number;
  }
  
  export interface IUserCardSales {
    cardDetails: ICardSales[];
    sumCardsSales: number;
  }
  
  export interface IUserCryptoSales {
    cryptoDetails: ICryptoSales[];
    sumCryptosSales: number;
  }
  
  export interface IUserOtherSales {
    otherDetails: IOtherSales[];
    sumOthersSales: number;
  }
  
  export interface ITotalCardsSales {
    cardDetails: ICardSales[];
    sumCardsSales: number;
  }
  
  export interface ITotalCryptosSales {
    cryptoDetails: ICryptoSales[];
    sumCryptosSales: number;
  }
  
  export interface ITotalOthersSales {
    otherDetails: IOtherSales[];
    sumOthersSales: number;
  }
  
  export interface IUserDailySalesReport extends IBaseSales {
    user: Types.ObjectId;
    hasOpenTables?: boolean;
    userCashSales?: number;
    userCardsSales?: IUserCardSales;
    userCryptosSales?: IUserCryptoSales;
    userOthersSales?: IUserOtherSales;
    userTotalSales?: number;
    userTotalNetPaid?: number;
    userTotalTips?: number;
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
    totalCashSales?: number;
    totalCardsSales?: ITotalCardsSales;
    totalCryptosSales?: ITotalCryptosSales;
    totalOthersSales?: ITotalOthersSales;
    totalSales?: number;
    totalNetPaid?: number;
    totalTips?: number;
    totalCost?: number;
    profit?: number;
    businessTotalCustomersServed?: number;
    businessAverageCustomersExpended?: number;
    businessGoodsSoldArray?: IUserGoods[];
    businessGoodsVoidArray?: IUserGoods[];
    businessGoodsInvitedArray?: IUserGoods[];
    businessTotalVoidPrice?: number;
    businessTotalInvitedPrice?: number;
    posSystemAppComission?: number;
  }
  