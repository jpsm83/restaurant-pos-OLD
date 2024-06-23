import connectDB from "@/app/lib/db";
import {
  ICardSales,
  ICryptoSales,
  IDailySalesReport,
  IOtherSales,
  IUserDailySalesReport,
} from "@/app/lib/interface/IDailySalesReport";
import { IUser } from "@/app/lib/interface/IUser";
import DailySalesReport from "@/app/lib/models/dailySalesReport";
import User from "@/app/lib/models/user";
import { Types } from "mongoose";
import { updateUserDailySalesReportGeneric } from "./updateUserDailySalesReportGeneric";

// this function will call the updateUserDailySalesReportGeneric function to update the user daily sales report
// them it will update the whole business daily sales report
// this is called by mananger or admin
export const closeDailySalesReport = async (
  userId: Types.ObjectId,
  dailySalesReportId: Types.ObjectId
) => {
  try {
    // check if the userId is valid
    if (!userId || !Types.ObjectId.isValid(userId)) {
      return "Invalid userId!";
    }

    // check if the dailySalesReportId is valid
    if (!dailySalesReportId || !Types.ObjectId.isValid(dailySalesReportId)) {
      return "Invalid dailySalesReportId!";
    }

    // connect before first call to DB
    await connectDB();

    // check if the user is "General Manager", "Manager", "Assistant Manager", "MoD" or "Admin"
    const userRole: IUser | null = await User.findOne({ _id: userId })
      .select("currentShiftRole onDuty")
      .lean();

    const allowedRoles = [
      "General Manager",
      "Manager",
      "Assistant Manager",
      "MoD",
      "Admin",
    ];

    if (
      !userRole ||
      !allowedRoles.includes(userRole.currentShiftRole ?? "") ||
      !userRole.onDuty
    ) {
      return "You are not allowed to close the daily sales report!";
    }

    // get the daily report to update
    const dailySalesReport: IDailySalesReport | null =
      await DailySalesReport.findOne({ _id: dailySalesReportId })
        .select(
          "_id dayReferenceNumber usersDailySalesReport.user usersDailySalesReport.hasOpenTables"
        )
        .lean();

    // check if daily report exists
    if (!dailySalesReport) {
      return "Daily report not found!";
    }

    // prepare dailySalesReportObj to update the daily report
    let dailySalesReportObj: any = {};

    // check if any user has open tables before closing the daily report
    const userWithOpenTables = dailySalesReport.usersDailySalesReport.find(
      (user) => user.hasOpenTables
    );

    if (userWithOpenTables) {
      return (
        "You cant close the daily sales because user " +
        userWithOpenTables.user +
        " has open tables!"
      );
    } else {
      dailySalesReportObj.dailyReportOpen = false;
    }

    // create an array to store the updated user daily sales report
    dailySalesReportObj.usersDailySalesReport = (
      await Promise.all(
        dailySalesReport.usersDailySalesReport.map(async (user) => {
          try {
            // get the user daily sales report object
            const userDailySalesReportObj =
              await updateUserDailySalesReportGeneric(
                user.user,
                dailySalesReport.dayReferenceNumber
              );
            return userDailySalesReportObj;
          } catch (error) {
            // Handle the error per your application's requirements
            // For example, you might want to return null or a specific error object for this user
            return null; // or any other error handling mechanism
          }
        })
      )
    ).filter(
      (userDailySalesReport): userDailySalesReport is IUserDailySalesReport =>
        userDailySalesReport !== null
    );

    dailySalesReportObj.totalCashSales =
      dailySalesReportObj.usersDailySalesReport.reduce(
        (acc: any, curr: { userCashSales: any }) =>
          acc + (curr.userCashSales ? curr.userCashSales : 0),
        0
      );

    // reduce all the sales into their own groups
    dailySalesReportObj.usersDailySalesReport.forEach((sale: any) => {
      sale.forEach((payment: ICardSales | ICryptoSales | IOtherSales) => {
        const { method, card, crypto, other } = payment.paymentMethod;
        const amount = payment.paymentMethodAmount;

        if (method === "Cash") {
          dailySalesReportObj.totalCashSales += amount;
        } else {
          let salesObj: {
            [x: string]: any;
            cardBranch?: any;
            cardSales?: any;
            cryptoType?: any;
            cryptoSales?: any;
            otherType?: any;
            otherSales?: any;
          } = {};
          let salesType: string = "";
          let salesArray;
          let sumSales: string = "";

          switch (method) {
            case "Card":
              salesObj = { cardBranch: card, cardSales: amount };
              salesType = "cardBranch";
              salesArray = dailySalesReportObj.totalCardsSales?.cardDetails;
              sumSales = "sumCardsSales";
              break;
            case "Crypto":
              salesObj = { cryptoType: crypto, cryptoSales: amount };
              salesType = "cryptoType";
              salesArray = dailySalesReportObj.totalCryptosSales?.cryptoDetails;
              sumSales = "sumCryptosSales";
              break;
            case "Other":
              salesObj = { otherType: other, otherSales: amount };
              salesType = "otherType";
              salesArray = dailySalesReportObj.totalOthersSales?.otherDetails;
              sumSales = "sumOthersSales";
              break;
          }

          let sale = salesArray?.find(
            (sale: { [x: string]: any }) =>
              sale[salesType] === salesObj[salesType]
          );
          if (sale) {
            sale[salesType.replace("Type", "Sales")] += amount;
          } else {
            // @ts-ignore
            salesArray.push(salesObj);
          }
          dailySalesReportObj[method.toLowerCase() + "Sales"][sumSales] +=
            amount;
        }
      });
    });

    dailySalesReportObj.totalSales =
      (dailySalesReportObj.totalCashSales ?? 0) +
      (dailySalesReportObj.totalCardsSales?.sumCardsSales ?? 0) +
      (dailySalesReportObj.totalCryptosSales?.sumCryptosSales ?? 0) +
      (dailySalesReportObj.totalOthersSales?.sumOthersSales ?? 0);
    dailySalesReportObj.totalNetPaid =
      dailySalesReportObj.usersDailySalesReport.reduce(
        (acc: any, curr: { userTotalNetPaid: any }) =>
          acc + (curr.userTotalNetPaid ? curr.userTotalNetPaid : 0),
        0
      );
    dailySalesReportObj.totalTips =
      dailySalesReportObj.usersDailySalesReport.reduce(
        (acc: any, curr: { userTotalTips: any }) =>
          acc + (curr.userTotalTips ? curr.userTotalTips : 0),
        0
      );
    dailySalesReportObj.totalCost =
      dailySalesReportObj.usersDailySalesReport.reduce(
        (acc: any, curr: { userTotalCost: any }) => acc + curr.userTotalCost,
        0
      );
    dailySalesReportObj.profit =
      dailySalesReportObj.totalNetPaid - dailySalesReportObj.totalCost;
    dailySalesReportObj.businessTotalCustomersServed =
      dailySalesReportObj.usersDailySalesReport.reduce(
        (acc: any, curr: { userCustomersServed: any }) =>
          acc + (curr.userCustomersServed ? curr.userCustomersServed : 0),
        0
      );
    dailySalesReportObj.businessAverageCustomersExpended =
      dailySalesReportObj.totalNetPaid /
      dailySalesReportObj.businessTotalCustomersServed;

    dailySalesReportObj.businessGoodsSoldArray =
      dailySalesReportObj.usersDailySalesReport.reduce(
        (acc: any[], curr: { userGoodsSoldArray: any[] }) => {
          curr.userGoodsSoldArray.forEach((sale) => {
            const existingSale = acc.find((item) => item.item === sale.item);
            if (existingSale) {
              existingSale.quantity += sale.quantity;
              existingSale.totalPrice += sale.totalPrice;
              existingSale.totalCostPrice += sale.totalCostPrice;
            } else {
              acc.push({ ...sale });
            }
          });
          return acc;
        },
        []
      );

    dailySalesReportObj.businessGoodsVoidArray =
      dailySalesReportObj.usersDailySalesReport.reduce(
        (acc: any[], curr: { userGoodsVoidArray: any[] }) => {
          curr.userGoodsVoidArray.forEach((sale) => {
            const existingSale = acc.find((item) => item.item === sale.item);
            if (existingSale) {
              existingSale.quantity += sale.quantity;
              existingSale.totalPrice += sale.totalPrice;
              existingSale.totalCostPrice += sale.totalCostPrice;
            } else {
              acc.push({ ...sale });
            }
          });

          dailySalesReportObj.businessGoodsInvitedArray =
            dailySalesReportObj.usersDailySalesReport.reduce(
              (acc: any[], curr: { userGoodsInvitedArray: any[] }) => {
                curr.userGoodsInvitedArray.forEach((sale) => {
                  const existingSale = acc.find(
                    (item) => item.item === sale.item
                  );
                  if (existingSale) {
                    existingSale.quantity += sale.quantity;
                    existingSale.totalPrice += sale.totalPrice;
                    existingSale.totalCostPrice += sale.totalCostPrice;
                  } else {
                    acc.push({ ...sale });
                  }
                });

                return acc;
              }
            );

          dailySalesReportObj.businessTotalVoidPrice =
            dailySalesReportObj.businessGoodsVoidArray.reduce(
              (acc: any, curr: { totalPrice: any }) => acc + curr.totalPrice,
              0
            );
          dailySalesReportObj.businessTotalInvitedPrice =
            dailySalesReportObj.businessGoodsInvitedArray.reduce(
              (acc: any, curr: { totalPrice: any }) => acc + curr.totalPrice,
              0
            );

          dailySalesReportObj.posSystemAppComission =
            dailySalesReportObj.totalSales * 0.05;
        }
      );

    // update the document in the database
    await DailySalesReport.findOneAndUpdate(
      { _id: dailySalesReportId },
      dailySalesReportObj,
      { new: true }
    );

    return "Daily sales report updated";
  } catch (error) {
    return "Failed to update daily sales report! " + error;
  }
};
