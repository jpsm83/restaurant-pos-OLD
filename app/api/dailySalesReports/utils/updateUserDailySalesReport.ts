import { Types } from "mongoose";

// imported utils
import connectDb from "@/app/lib/utils/connectDb";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";

// imported interfaces
import { IUserDailySalesReport } from "@/app/lib/interface/IDailySalesReport";
import { IPaymentMethod } from "@/app/lib/interface/IPaymentMethod";

// import models
import Order from "@/app/lib/models/order";
import DailySalesReport from "@/app/lib/models/dailySalesReport";
import BusinessGood from "@/app/lib/models/businessGood";
import SalesLocation from "@/app/lib/models/salesLocation";

interface IBusinessGood {
  good: Types.ObjectId;
  quantity: number;
  totalPrice: number;
  totalCostPrice: number;
}

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
        // Fetch all tables closed by the user for the given dailyReferenceNumber
        const salesLocation = await SalesLocation.find({
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
              select:
                "_id name mainCategory subCategory sellingPrice costPrice",
            },
            select:
              "user paymentMethod billingStatus orderPrice orderNetPrice orderTips orderCostPrice",
          })
          .select(
            "dailyReferenceNumber status business orderNetPrice orderTips guests closedBy"
          )
          .lean();

        // Initialize user sales report object
        let userGoodsReport: {
          goodsSold: IBusinessGood[];
          goodsVoid: IBusinessGood[];
          goodsInvited: IBusinessGood[];
        } = {
          goodsSold: [],
          goodsVoid: [],
          goodsInvited: [],
        };

        let userDailySalesReportObj: IUserDailySalesReport = {
          userId: userId,
          hasOpenTables: false,
          userPaymentMethods: [] as IPaymentMethod[],
          totalSalesBeforeAdjustments: 0,
          totalNetPaidAmount: 0,
          totalTipsReceived: 0,
          totalCostOfGoodsSold: 0,
          totalCustomersServed: 0 as number,
          averageCustomerExpenditure: 0,
        };

        // Process each table for the user
        if (salesLocation && salesLocation.length > 0) {
          salesLocation.forEach((eachTableDocument) => {
            userDailySalesReportObj.hasOpenTables =
              eachTableDocument.status !== "Closed"
                ? true
                : userDailySalesReportObj.hasOpenTables;

            // Process orders in the table
            if (
              eachTableDocument.orders &&
              eachTableDocument.orders.length > 0
            ) {
              eachTableDocument.orders.forEach((order: any) => {
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
                  order.orderPrice ?? 0;
                userDailySalesReportObj.totalCostOfGoodsSold +=
                  order.orderCostPrice ?? 0;

                // Update business goods sales report
                if (order.businessGoods && order.businessGoods.length > 0) {
                  order.businessGoods.forEach((businessGood: any) => {
                    const updateGoodsArray = (array: any[]) => {
                      const existingGood = array.find(
                        (item: any) => item.good === businessGood._id
                      );

                      if (existingGood) {
                        existingGood.quantity += businessGood.quantity ?? 1;
                        existingGood.totalPrice += businessGood.sellingPrice;
                        existingGood.totalCostPrice += businessGood.costPrice;
                      } else {
                        array.push({
                          good: businessGood._id,
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
    await DailySalesReport.findOneAndUpdate(
      { dailyReferenceNumber },
      { $set: { usersDailySalesReport: userReports } },
      { new: true } // This option returns the updated document
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

// export const updateUsersDailySalesReport = async (
//   userId: Types.ObjectId,
//   dailyReferenceNumber: number,
// ) => {
//   try {
//     // validate userId
//     if (isObjectIdValid([userId]) !== true) {
//       return "Invalid userId!";
//     }

//     // check required fields
//     if (!dailyReferenceNumber)
//       return "UserId and dailyReferenceNumber are required!";

//     // connect before first call to DB
//     await connectDb();

//     // get all tables closed by the user at the given dailyReferenceNumber
//     const salesLocation = await SalesLocation.find({
//       responsibleBy: userId,
//       dailyReferenceNumber: dailyReferenceNumber,
//     })
//       .populate({
//         path: "orders",
//         model: Order,
//         populate: {
//           path: "businessGoods",
//           model: BusinessGood,
//           populate: {
//             path: "setMenu",
//             select: "_id name mainCategory subCategory",
//           },
//           select: "_id name mainCategory subCategory sellingPrice costPrice",
//         },
//         select:
//           "user paymentMethod billingStatus orderPrice orderNetPrice orderTips orderCostPrice",
//       })
//       .select(
//         "dailyReferenceNumber status business orderNetPrice orderTips guests closedBy"
//       )
//       .lean();

//     // user goods sales report
//     let userGoodsReport: {
//       goodsSold: IBusinessGood[];
//       goodsVoid: IBusinessGood[];
//       goodsInvited: IBusinessGood[];
//     } = {
//       goodsSold: [],
//       goodsVoid: [],
//       goodsInvited: [],
//     };

//     // prepare the update object
//     let userDailySalesReportObj: IUserDailySalesReport = {
//       userId: userId,
//       hasOpenTables: false,
//       userPaymentMethods: [] as IPaymentMethod[],
//       totalSalesBeforeAdjustments: 0,
//       totalNetPaidAmount: 0,
//       totalTipsReceived: 0,
//       totalCostOfGoodsSold: 0,
//       totalCustomersServed: 0,
//       averageCustomerExpenditure: 0,
//     };

//     // go through all the tables closed by the user
//     if (salesLocation && salesLocation.length > 0) {
//       salesLocation.forEach((eachTableDocument) => {
//         userDailySalesReportObj.hasOpenTables =
//           eachTableDocument.status !== "Closed"
//             ? true
//             : userDailySalesReportObj.hasOpenTables;

//         // update all the user sales
//         if (eachTableDocument.orders && eachTableDocument.orders.length > 0) {
//           eachTableDocument.orders.forEach((order: any) => {
//             order.paymentMethod.forEach((payment: IPaymentMethod) => {
//               // Find if the payment method and branch combination already exists in the userDailySalesReportObj.userPaymentMethods array
//               const existingPayment =
//                 userDailySalesReportObj?.userPaymentMethods?.find(
//                   (p: any) =>
//                     p.paymentMethodType === payment.paymentMethodType &&
//                     p.methodBranch === payment.methodBranch
//                 );

//               if (existingPayment) {
//                 // If it exists, add the current payment's methodSalesTotal to the existing one
//                 existingPayment.methodSalesTotal += payment.methodSalesTotal;
//               } else {
//                 // If it doesn't exist, create a new entry in the userDailySalesReportObj.userPaymentMethods array
//                 userDailySalesReportObj?.userPaymentMethods?.push({
//                   paymentMethodType: payment.paymentMethodType,
//                   methodBranch: payment.methodBranch,
//                   methodSalesTotal: payment.methodSalesTotal,
//                 });
//               }
//             });

//             userDailySalesReportObj.totalNetPaidAmount +=
//               order.orderNetPrice ?? 0;
//             userDailySalesReportObj.totalTipsReceived += order.orderTips ?? 0;
//             userDailySalesReportObj.totalSalesBeforeAdjustments +=
//               order.orderPrice ?? 0;
//             userDailySalesReportObj.totalCostOfGoodsSold +=
//               order.orderCostPrice ?? 0;

//             // Check billing status and update the business goods report without duplicates
//             if (order.businessGoods && order.businessGoods.length > 0) {
//               order.businessGoods.forEach((businessGood: any) => {
//                 const updateGoodsArray = (array: any[]) => {
//                   const existingGood = array.find(
//                     (item: any) => item.good === businessGood._id
//                   );

//                   if (existingGood) {
//                     // If the item already exists, update the quantity, totalPrice, and totalCostPrice
//                     existingGood.quantity += businessGood.quantity ?? 1;
//                     existingGood.totalPrice += businessGood.sellingPrice;
//                     existingGood.totalCostPrice += businessGood.costPrice;
//                   } else {
//                     // If it doesn't exist, create a new entry
//                     array.push({
//                       good: businessGood._id,
//                       quantity: businessGood.quantity ?? 1,
//                       totalPrice: businessGood.sellingPrice,
//                       totalCostPrice: businessGood.costPrice,
//                     });
//                   }
//                 };

//                 // Push or update the object in the correct array based on the order's billing status
//                 switch (order.billingStatus) {
//                   case "Paid":
//                     updateGoodsArray(userGoodsReport.goodsSold);
//                     break;
//                   case "Void":
//                     updateGoodsArray(userGoodsReport.goodsVoid);
//                     break;
//                   case "Invitation":
//                     updateGoodsArray(userGoodsReport.goodsInvited);
//                     break;
//                   default:
//                     break;
//                 }
//               });
//             }
//           });
//         }

//         // Update the total customers served
//         userDailySalesReportObj.totalCustomersServed +=
//           eachTableDocument.guests ?? 0;
//       });
//     }

//     // Ensure totalCustomersServed is not zero to avoid division by zero error
//     if (
//       userDailySalesReportObj.totalCustomersServed &&
//       userDailySalesReportObj.totalCustomersServed > 0
//     ) {
//       userDailySalesReportObj.averageCustomerExpenditure =
//         userDailySalesReportObj.totalCustomersServed
//           ? (userDailySalesReportObj.totalSalesBeforeAdjustments ?? 0) /
//             userDailySalesReportObj.totalCustomersServed
//           : 0;
//     }

//     userDailySalesReportObj.soldGoods = userGoodsReport.goodsSold;
//     userDailySalesReportObj.voidedGoods = userGoodsReport.goodsVoid;
//     userDailySalesReportObj.invitedGoods = userGoodsReport.goodsInvited;
//     userDailySalesReportObj.totalVoidValue = userGoodsReport.goodsVoid.reduce(
//       (acc, curr) => acc + curr.totalPrice,
//       0
//     );
//     userDailySalesReportObj.totalInvitedValue =
//       userGoodsReport.goodsInvited.reduce(
//         (acc, curr) => acc + curr.totalPrice,
//         0
//       );

//     return userDailySalesReportObj;
//   } catch (error) {
//     return "Failed to update user daily sales report! " + error;
//   }
// };
