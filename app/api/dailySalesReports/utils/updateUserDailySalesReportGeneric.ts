import connectDb from "@/app/lib/utils/connectDb";
import { Types } from "mongoose";

// imported interfaces
import { IUserDailySalesReport } from "@/app/lib/interface/IDailySalesReport";

interface IBusinessGood {
  good: Types.ObjectId;
  quantity: number;
  totalPrice: number;
  totalCostPrice: number;
}

// import models
import Order from "@/app/lib/models/order";
import DailySalesReport from "@/app/lib/models/dailySalesReport";
import BusinessGood from "@/app/lib/models/businessGood";
import Table from "@/app/lib/models/salesLocation";
import { IPayment } from "@/app/lib/interface/IPayment";


// this function will update individual user daily sales report
// it is used ONLY when managers close the day sales report CLOSEDAILYSALESREPORT route
export const updateUserDailySalesReportGeneric = async (
  userId: Types.ObjectId,
  dailyReferenceNumber: number
) => {
  try {
    // check required fields
    if (!userId || !dailyReferenceNumber)
      return "UserId and dailyReferenceNumber are required!";

    // connect before first call to DB
    await connectDb();

    // get all tables closed by the user at the given dailyReferenceNumber
    const tableDocument = await Table.find({
      responsibleBy: userId,
      dailyReferenceNumber: dailyReferenceNumber,
    })
      .populate({
        path: "orders",
        model: Order,
        populate: {
          path: "businessGoods",
          model: BusinessGood,
          populate: {
            path: "setMenu",
            select: "_id name mainCategory subCategory",
          },
          select: "_id name mainCategory subCategory sellingPrice costPrice",
        },
        select:
          "user paymentMethod billingStatus orderPrice orderNetPrice orderTips orderCostPrice",
      })
      .select(
        "dailyReferenceNumber status business orderNetPrice orderTips guests closedBy"
      )
      .lean();

    // user goods sales report
    let userGoodsReport: {
      goodsSold: IBusinessGood[];
      goodsVoid: IBusinessGood[];
      goodsInvited: IBusinessGood[];
    } = {
      goodsSold: [],
      goodsVoid: [],
      goodsInvited: [],
    };

    // prepare the update object
    let userDailySalesReportObj: IUserDailySalesReport = {
      user: userId,
      hasOpenTables: false,
      userPaymentMethods: [] as IPayment[],
      totalSalesBeforeAdjustments: 0,
      totalNetPaidAmount: 0,
      totalTipsReceived: 0,
      totalCostOfGoodsSold: 0,
      totalCustomersServed: 0,
      averageCustomerExpenditure: 0,
    };

    // go through all the tables closed by the user
    if (tableDocument && tableDocument.length > 0) {
      tableDocument.forEach((eachTableDocument) => {
        userDailySalesReportObj.hasOpenTables =
          eachTableDocument.status !== "Closed"
            ? true
            : userDailySalesReportObj.hasOpenTables;

        // update all the user sales
        if (eachTableDocument.orders && eachTableDocument.orders.length > 0) {
          eachTableDocument.orders.forEach((order: any) => {
            order.paymentMethod.forEach((payment: IPayment) => {
              // Find if the payment method and branch combination already exists in the userDailySalesReportObj.userPaymentMethods array
              const existingPayment = userDailySalesReportObj?.userPaymentMethods?.find(
                (p: any) =>
                  p.paymentMethodType === payment.paymentMethodType &&
                  p.methodBranch === payment.methodBranch
              );

              if (existingPayment) {
                // If it exists, add the current payment's methodSalesTotal to the existing one
                existingPayment.methodSalesTotal += payment.methodSalesTotal;
              } else {
                // If it doesn't exist, create a new entry in the userDailySalesReportObj.userPaymentMethods array
                userDailySalesReportObj?.userPaymentMethods?.push({
                  paymentMethodType: payment.paymentMethodType,
                  methodBranch: payment.methodBranch,
                  methodSalesTotal: payment.methodSalesTotal,
                });
              }
            });

            userDailySalesReportObj.totalNetPaidAmount +=
              order.orderNetPrice ?? 0;
            userDailySalesReportObj.totalTipsReceived += order.orderTips ?? 0;
            userDailySalesReportObj.totalSalesBeforeAdjustments += order.orderPrice ?? 0;
            userDailySalesReportObj.totalCostOfGoodsSold += order.orderCostPrice ?? 0;

            // Check billing status and update the business goods report without duplicates
            if (order.businessGoods && order.businessGoods.length > 0) {
              order.businessGoods.forEach((businessGood: any) => {
                const updateGoodsArray = (array: any[]) => {
                  const existingGood = array.find(
                    (item: any) => item.good === businessGood._id
                  );

                  if (existingGood) {
                    // If the item already exists, update the quantity, totalPrice, and totalCostPrice
                    existingGood.quantity += businessGood.quantity ?? 1;
                    existingGood.totalPrice += businessGood.sellingPrice;
                    existingGood.totalCostPrice += businessGood.costPrice;
                  } else {
                    // If it doesn't exist, create a new entry
                    array.push({
                      good: businessGood._id,
                      quantity: businessGood.quantity ?? 1,
                      totalPrice: businessGood.sellingPrice,
                      totalCostPrice: businessGood.costPrice,
                    });
                  }
                };

                // Push or update the object in the correct array based on the order's billing status
                switch (order.billingStatus) {
                  case "Paid":
                    updateGoodsArray(userGoodsReport.goodsSold);
                    break;
                  case "Void":
                    updateGoodsArray(userGoodsReport.goodsVoid);
                    break;
                  case "Invitation":
                    updateGoodsArray(userGoodsReport.goodsInvited);
                    break;
                  default:
                    break;
                }
              });
            }
          });
        }

        // Update the total customers served
        userDailySalesReportObj.totalCustomersServed +=
          eachTableDocument.guests ?? 0;
      });
    }

    // Ensure totalCustomersServed is not zero to avoid division by zero error
    if (
      userDailySalesReportObj.totalCustomersServed &&
      userDailySalesReportObj.totalCustomersServed > 0
    ) {
      userDailySalesReportObj.averageCustomerExpenditure =
        userDailySalesReportObj.totalCustomersServed
          ? (userDailySalesReportObj.totalSalesBeforeAdjustments ?? 0) /
            userDailySalesReportObj.totalCustomersServed
          : 0;
    }

    userDailySalesReportObj.soldGoods = userGoodsReport.goodsSold;
    userDailySalesReportObj.voidedGoods = userGoodsReport.goodsVoid;
    userDailySalesReportObj.invitedGoods =
      userGoodsReport.goodsInvited;
    userDailySalesReportObj.totalVoidValue =
      userGoodsReport.goodsVoid.reduce(
        (acc, curr) => acc + curr.totalPrice,
        0
      );
    userDailySalesReportObj.totalInvitedValue =
      userGoodsReport.goodsInvited.reduce(
        (acc, curr) => acc + curr.totalPrice,
        0
      );

    // update the document in the database
    await DailySalesReport.findOneAndUpdate(
      {
        dailyReferenceNumber: dailyReferenceNumber,
        "usersDailySalesReport.user": userId,
      },
      { $set: { "usersDailySalesReport.$": userDailySalesReportObj } },
      { new: true }
    );

    return userDailySalesReportObj;
  } catch (error) {
    return "Failed to update user daily sales report! " + error;
  }
};
