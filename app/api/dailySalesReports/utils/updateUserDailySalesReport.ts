import { Types } from "mongoose";

// imported utils
import connectDb from "@/app/lib/utils/connectDb";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";

// imported interfaces
import {
  IGoodsReduced,
  IUserDailySalesReport,
} from "@/app/lib/interface/IDailySalesReport";
import { IPaymentMethod } from "@/app/lib/interface/IPaymentMethod";

// import models
import Order from "@/app/lib/models/order";
import DailySalesReport from "@/app/lib/models/dailySalesReport";
import BusinessGood from "@/app/lib/models/businessGood";
import SalesInstance from "@/app/lib/models/salesInstance";

// this function will update individual user daily sales report
// it will be fired individualy when the user closes his daily sales report for the day or if he just want to see the report at current time
// it also will be fired when manager closes the day sales report, running for all users
export const updateUsersDailySalesReport = async (
  userIds: Types.ObjectId[], // Now accepts an array of userIds
  dailyReferenceNumber: number
) => {
  try {
    // validate userIds
    if (isObjectIdValid(userIds) !== true) {
      return "Invalid userIds!";
    }

    // check required fields
    if (!dailyReferenceNumber) {
      return "UserIds and dailyReferenceNumber are required!";
    }

    // connect before first call to DB
    await connectDb();

    // Array to collect results for each user
    const userReports: IUserDailySalesReport[] = [];
    const errors: string[] = [];

    // Loop through each userId and process the report
    for (const userId of userIds) {
      try {
        // Fetch all sales instance closed by the user for the given dailyReferenceNumber
        const salesInstance = await SalesInstance.find({
          responsibleById: userId,
          dailyReferenceNumber: dailyReferenceNumber,
        })
          .populate({
            path: "salesGroup.ordersIds",
            model: Order,
            populate: {
              path: "businessGoodsIds",
              model: BusinessGood,
              populate: {
                path: "setMenuIds",
                select: "_id name mainCategory subCategory",
              },
              select:
                "_id name mainCategory subCategory sellingPrice costPrice",
            },
            select:
              "userId paymentMethod billingStatus orderGrossPrice orderNetPrice orderTips orderCostPrice",
          })
          .select(
            "dailyReferenceNumber status businessId orderNetPrice orderTips guests closedById"
          )
          .lean();

        // Initialize user sales report object
        let userGoodsReport: {
          goodsSold: IGoodsReduced[];
          goodsVoid: IGoodsReduced[];
          goodsInvited: IGoodsReduced[];
        } = {
          goodsSold: [],
          goodsVoid: [],
          goodsInvited: [],
        };

        let userDailySalesReportObj: IUserDailySalesReport = {
          userId: userId,
          hasOpenSalesInstances: false,
          userPaymentMethods: [] as IPaymentMethod[],
          totalSalesBeforeAdjustments: 0,
          totalNetPaidAmount: 0,
          totalTipsReceived: 0,
          totalCostOfGoodsSold: 0,
          totalCustomersServed: 0 as number,
          averageCustomerExpenditure: 0,
        };

// ******************************************
// MUST REFACTOR THSI CODE BLOCK
// salesInstance.ordersIds does not exist anymore
// now it is salesInstance.salesGroup.ordersIds
// ****************************************

        // Process each table for the user
        if (salesInstance && salesInstance.length > 0) {
          salesInstance.forEach((eachTableDocument) => {
            userDailySalesReportObj.hasOpenSalesInstances =
              eachTableDocument.status !== "Closed"
                ? true
                : userDailySalesReportObj.hasOpenSalesInstances;

            // Process orders in the table
            if (
              eachTableDocument.ordersIds &&
              eachTableDocument.ordersIds.length > 0
            ) {
              eachTableDocument.ordersIds.forEach((order: any) => {
                order.paymentMethod.forEach((payment: IPaymentMethod) => {
                  const existingPayment =
                    userDailySalesReportObj?.userPaymentMethods?.find(
                      (p: any) =>
                        p.paymentMethodType === payment.paymentMethodType &&
                        p.methodBranch === payment.methodBranch
                    );

                  if (existingPayment) {
                    existingPayment.methodSalesTotal +=
                      payment.methodSalesTotal;
                  } else {
                    userDailySalesReportObj?.userPaymentMethods?.push({
                      paymentMethodType: payment.paymentMethodType,
                      methodBranch: payment.methodBranch,
                      methodSalesTotal: payment.methodSalesTotal,
                    });
                  }
                });

                userDailySalesReportObj.totalNetPaidAmount +=
                  order.orderNetPrice ?? 0;
                userDailySalesReportObj.totalTipsReceived +=
                  order.orderTips ?? 0;
                userDailySalesReportObj.totalSalesBeforeAdjustments +=
                  order.orderGrossPrice ?? 0;
                userDailySalesReportObj.totalCostOfGoodsSold +=
                  order.orderCostPrice ?? 0;

                // Update business goods sales report
                if (
                  order.businessGoodsIds &&
                  order.businessGoodsIds.length > 0
                ) {
                  order.businessGoodsIds.forEach((businessGood: any) => {
                    const updateGoodsArray = (array: any[]) => {
                      const existingGood = array.find(
                        (item: any) => item.businessGoodId === businessGood._id
                      );

                      if (existingGood) {
                        existingGood.quantity += businessGood.quantity ?? 1;
                        existingGood.totalPrice += businessGood.sellingPrice;
                        existingGood.totalCostPrice += businessGood.costPrice;
                      } else {
                        array.push({
                          businessGoodId: businessGood._id,
                          quantity: businessGood.quantity ?? 1,
                          totalPrice: businessGood.sellingPrice,
                          totalCostPrice: businessGood.costPrice,
                        });
                      }
                    };

                    // Update the correct array based on billing status
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

            // Update total customers served
            userDailySalesReportObj.totalCustomersServed +=
              eachTableDocument.guests ?? 0;
          });
        }

        // Calculate average customer expenditure
        if ((userDailySalesReportObj.totalCustomersServed ?? 0) > 0) {
          userDailySalesReportObj.averageCustomerExpenditure =
            (userDailySalesReportObj.totalSalesBeforeAdjustments ?? 0) /
            (userDailySalesReportObj.totalCustomersServed ?? 0);
        }

        // Add goods reports to user object
        userDailySalesReportObj.soldGoods = userGoodsReport.goodsSold;
        userDailySalesReportObj.voidedGoods = userGoodsReport.goodsVoid;
        userDailySalesReportObj.invitedGoods = userGoodsReport.goodsInvited;

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

        // Add the updated result to the array
        userReports.push(userDailySalesReportObj);
      } catch (error: any) {
        // Log errors for specific users
        errors.push(`Error updating user ${userId}: ${error.message}`);
      }
    }

    // Update DailySalesReport after processing all users
    await DailySalesReport.updateOne(
      { dailyReferenceNumber },
      { $set: { usersDailySalesReport: userReports } },
    );

    // Return both successful reports and errors
    return {
      updatedUsers: userReports,
      errors,
    };
  } catch (error: any) {
    return `Failed to update user daily sales reports! ${error.message}`;
  }
};
