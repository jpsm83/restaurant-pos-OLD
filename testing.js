import { IUserDailySalesReport } from "@/app/lib/interface/IDailySalesReport";
import Order from "@/app/lib/models/order";
import DailySalesReport from "@/app/lib/models/dailySalesReport";
import BusinessGood from "@/app/lib/models/businessGood";
import Table from "@/app/lib/models/table";

import mongoose, { model, Types } from "mongoose";
import connectDB from "@/app/lib/db";

// this function will update individual user daily sales report
// it is used ONLY when managers close the day sales report CLOSEDAILYSALESREPORT route
export const updateUserDailySalesReportGeneric = async (
  userId: Types.ObjectId,
  dayReferenceNumber: number
) => {
  try {
    // check required fields
    if (!userId || !dayReferenceNumber)
      return "UserId and dayReferenceNumber are required!";

    // connect before first call to DB
    await connectDB();

    // get all tables closed by the user at the given dayReferenceNumber
    const tableDocument = await Table.find({
      closedBy: userId,
      dayReferenceNumber: dayReferenceNumber,
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
          select: "_id name mainCategory subCategory",
        },
        select:
          "user paymentMethod billingStatus orderPrice orderNetPrice orderTips",
      })
      .select(
        "dayReferenceNumber status business tableTotalPrice tableTotalNetPaid tableTotalTips guests closedBy"
      )
      .lean();

    // prepare the update object
    let userDailySalesReportObj: IUserDailySalesReport = {
      user: userId,
      hasOpenTables: false,
    };

    // Generic payment method object
    // let userPayments = [
    //   {
    //     paymentMethodType: "Cash",
    //     methdBranch: "Cash",
    //     methodSalesTotal: 100,
    //   },
    //   {
    //     paymentMethodType: "Card",
    //     methdBranch: "Visa",
    //     methodSalesTotal: 150,
    //   },
    //   {
    //     paymentMethodType: "Crypto",
    //     methdBranch: "Bitcoin",
    //     methodSalesTotal: 200,
    //   },
    //   {
    //     paymentMethodType: "Other",
    //     methdBranch: "Voucher",
    //     methodSalesTotal: 50,
    //   },
    // ];

    // go through all the tables closed by the user
    if (tableDocument && tableDocument.length > 0) {
      tableDocument.forEach((documentItem) => {
        userDailySalesReportObj.hasOpenTables =
          documentItem.status !== "Closed"
            ? true
            : userDailySalesReportObj.hasOpenTables;
        // update all the user sales
        if (documentItem.orders && documentItem.orders.length > 0) {
          documentItem.orders.forEach((order: any) => {
            order.forEach((payment: any) => {
              const { method, card, crypto, other } = payment.paymentMethod;
              const amount = payment.paymentMethodAmount;

              if (method === "Cash") {
                userDailySalesReportObj.userCashSales += amount;
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
                    salesArray =
                      userDailySalesReportObj.userCardsSales?.cardDetails;
                    sumSales = "sumCardsSales";
                    break;
                  case "Crypto":
                    salesObj = { cryptoType: crypto, cryptoSales: amount };
                    salesType = "cryptoType";
                    salesArray =
                      userDailySalesReportObj.userCryptosSales?.cryptoDetails;
                    sumSales = "sumCryptosSales";
                    break;
                  case "Other":
                    salesObj = { otherType: other, otherSales: amount };
                    salesType = "otherType";
                    salesArray =
                      userDailySalesReportObj.userOthersSales?.otherDetails;
                    sumSales = "sumOthersSales";
                    break;
                }

                let sale = salesArray?.find(
                  (sale) => sale[salesType] === salesObj[salesType]
                );
                if (sale) {
                  sale[salesType.replace("Type", "Sales")] += amount;
                } else {
                  // @ts-ignore
                  salesArray.push(salesObj);
                }
                userDailySalesReportObj[method.toLowerCase() + "Sales"][
                  sumSales
                ] += amount;
              }
            });

            userDailySalesReportObj.userTotalNetPaid +=
              documentItem.tableTotalNetPaid;
            userDailySalesReportObj.userTotalTips +=
              documentItem.tableTotalTips;
            userDailySalesReportObj.userCustomersServed += documentItem.guests;
          });

          // Assuming all properties are possibly undefined, use nullish coalescing to provide a default value of 0
          userDailySalesReportObj.userTotalSales =
            (userDailySalesReportObj.userCashSales ?? 0) +
            (userDailySalesReportObj.userCardsSales?.sumCardsSales ?? 0) +
            (userDailySalesReportObj.userCryptosSales?.sumCryptosSales ?? 0) +
            (userDailySalesReportObj.userOthersSales?.sumOthersSales ?? 0);

          // Ensure userCustomersServed is not zero to avoid division by zero error
          userDailySalesReportObj.userAverageCustomersExpended =
            userDailySalesReportObj.userCustomersServed &&
            userDailySalesReportObj.userCustomersServed > 0
              ? userDailySalesReportObj.userTotalSales /
                userDailySalesReportObj.userCustomersServed
              : 0;
        } else {
          userDailySalesReportObj.hasOpenTables = false;
        }
      });
    }

    // get all the orders from the user
    const userDayOrders = await Order.find({
      user: userId,
      dayReferenceNumber: dayReferenceNumber,
    })
      .select("_id orderPrice")
      .lean();

    // create a userGoodsSoldMap, userGoodsVoidMap, and userGoodsInvitedMap to update
    let userGoodsSoldMap = new Map();
    let userGoodsVoidMap = new Map();
    let userGoodsInvitedMap = new Map();

    // go through all the orders to populate the userGoodsSoldMap, userGoodsVoidMap, and userGoodsInvitedMap
    if (userDayOrders && userDayOrders.length > 0) {
      userDayOrders.forEach((order) => {
        let orderMap = null;

        if (order.billingStatus === "Paid" || order.billingStatus === "Open") {
          orderMap = userGoodsSoldMap;
        } else if (order.billingStatus === "Void") {
          orderMap = userGoodsVoidMap;
        } else if (order.billingStatus === "Invited") {
          orderMap = userGoodsInvitedMap;
        }

        if (orderMap) {
          if (orderMap.has(order._id)) {
            // if the order is found, update the quantity and totalPrice
            let orderData = orderMap.get(order._id);
            orderData.quantity += 1;
            orderData.totalPrice += order.orderPrice;
            orderData.totalCostPrice += order.orderCostPrice;
          } else {
            // if the order is not found, add a new object to the map
            orderMap.set(order._id, {
              good: order._id,
              quantity: 1,
              totalPrice: order.orderPrice,
              totalCostPrice: order.orderCostPrice,
            });
          }
        }
      });
    }

    // convert the maps back to arrays
    let userGoodsSoldArr = Array.from(userGoodsSoldMap.values());
    let userGoodsVoidArr = Array.from(userGoodsVoidMap.values());
    let userGoodsInvitedArr = Array.from(userGoodsInvitedMap.values());

    userDailySalesReportObj.userGoodsSoldArray = userGoodsSoldArr;
    userDailySalesReportObj.userGoodsVoidArray = userGoodsVoidArr;
    userDailySalesReportObj.userGoodsInvitedArray = userGoodsInvitedArr;
    userDailySalesReportObj.userTotalVoid = userGoodsVoidArr.reduce(
      (acc, curr) => acc + curr.totalPrice,
      0
    );
    userDailySalesReportObj.userTotalInvited = userGoodsInvitedArr.reduce(
      (acc, curr) => acc + curr.totalPrice,
      0
    );

    // update the document in the database
    await DailySalesReport.findOneAndUpdate(
      {
        dayReferenceNumber: dayReferenceNumber,
        "usersDailySalesReport.user": userId,
      },
      { $set: { "usersDailySalesReport.$": userDailySalesReportObj } },
      { new: true }
    );

    return "User daily sales report updated";
  } catch (error) {
    return "Failed to update user daily sales report! " + error;
  }
};
