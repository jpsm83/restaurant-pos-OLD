import connectDB from "@/app/lib/db";
import { Types } from "mongoose";
import { NextResponse } from "next/server";

// imported interfaces
import { IUserDailySalesReport } from "@/app/lib/interface/IDailySalesReport";
import { IUser } from "@/app/lib/interface/IUser";
import { IPayment } from "@/app/lib/interface/IPayment";

// imported utils
import { updateUserDailySalesReportGeneric } from "../../utils/updateUserDailySalesReportGeneric";
import { handleApiError } from "@/app/lib/utils/handleApiError";

// imported models
import DailySalesReport from "@/app/lib/models/dailySalesReport";
import User from "@/app/lib/models/user";
import Business from "@/app/lib/models/business";

interface IBusinessGood {
  good: Types.ObjectId;
  quantity: number;
  totalPrice: number;
  totalCostPrice: number;
}

// this function will call the updateUserDailySalesReportGeneric function to update the user daily sales report
// them it will update the whole business daily sales report
// this is called by mananger or admin
export const POST = async (req: Request) => {
  try {
    const { userId, dailySalesReportId } = (await req.json()) as {
      userId: Types.ObjectId;
      dailySalesReportId: Types.ObjectId;
    };
    // check if the userId is valid
    if (!userId || !Types.ObjectId.isValid(userId)) {
      return new NextResponse(JSON.stringify({ message: "Invalid userId!" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // check if the dailySalesReportId is valid
    if (!dailySalesReportId || !Types.ObjectId.isValid(dailySalesReportId)) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid dailySalesReportId!" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // connect before first call to DB
    await connectDB();

    // check if the user is "General Manager", "Manager", "Assistant Manager", "MoD" or "Admin"
    const userRoleOnDuty: IUser | null = await User.findOne({ _id: userId })
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
      !userRoleOnDuty ||
      !allowedRoles.includes(userRoleOnDuty.currentShiftRole ?? "") ||
      !userRoleOnDuty.onDuty
    ) {
      return new NextResponse(
        JSON.stringify({
          message: "You are not allowed to close the daily sales report!",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // get the daily report to update
    const dailySalesReport: any = await DailySalesReport.findOne({
      _id: dailySalesReportId,
    })
      .select(
        "_id dayReferenceNumber usersDailySalesReport.user usersDailySalesReport.hasOpenTables business"
      )
      .populate({
        path: "usersDailySalesReport.user",
        select: "username",
        model: User,
      })
      .populate({ path: "business", select: "subscription", model: Business })
      .lean();

    // check if daily report exists
    if (!dailySalesReport) {
      return new NextResponse(
        JSON.stringify({ message: "Daily report not found!" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // business goods sales report
    let businessGoodsReport: {
      goodsSold: IBusinessGood[];
      goodsVoid: IBusinessGood[];
      goodsInvited: IBusinessGood[];
    } = {
      goodsSold: [],
      goodsVoid: [],
      goodsInvited: [],
    };

    // prepare dailySalesReportObj to update the daily report
    let dailySalesReportObj = {
      businessPayments: [] as IPayment[],
      businessTotalSales: 0,
      businessTotalNetPaid: 0,
      businessTotaltips: 0,
      businessTotalCost: 0,
      businessTotalProfit: 0,
      businessTotalCustomersServed: 0,
      businessAverageCustomersExpended: 0,
      businessGoodsSoldArray: [] as IBusinessGood[],
      businessGoodsVoidArray: [] as IBusinessGood[],
      businessGoodsInvitedArray: [] as IBusinessGood[],
      businessTotalVoidPrice: 0,
      businessTotalInvitedPrice: 0,
      posSystemAppComission: 0,
    };

    // Update each user's daily sales report
    const updateUsersDailySalesReport: IUserDailySalesReport[] =
      await Promise.all(
        dailySalesReport.usersDailySalesReport.map(async (user: any) => {
          try {
            // Get the user daily sales report object
            return await updateUserDailySalesReportGeneric(
              user.user,
              dailySalesReport.dayReferenceNumber
            );
          } catch (error) {
            return new NextResponse(
              JSON.stringify({
                message: "Failed to update user daily sales report! " + error,
              }),
              { status: 400, headers: { "Content-Type": "application/json" } }
            );
          }
        })
      );

    // Ensure updateUsersDailySalesReport is an array of IUserDailySalesReport
    if (Array.isArray(updateUsersDailySalesReport)) {
      updateUsersDailySalesReport.forEach((userReport) => {
        // Check if userPayments is defined before iterating
        if (userReport.userPayments) {
          userReport.userPayments.forEach((payment: IPayment) => {
            // Find if the payment method and branch combination already exists in the dailySalesReportObj.userPayments array
            const existingPayment = dailySalesReportObj.businessPayments.find(
              (p: IPayment) =>
                p.paymentMethodType === payment.paymentMethodType &&
                p.methodBranch === payment.methodBranch
            );

            if (existingPayment) {
              // If it exists, add the current payment's methodSalesTotal to the existing one
              existingPayment.methodSalesTotal += payment.methodSalesTotal;
            } else {
              // If it doesn't exist, create a new entry in the dailySalesReportObj.businessPayments array
              dailySalesReportObj.businessPayments.push({
                paymentMethodType: payment.paymentMethodType,
                methodBranch: payment.methodBranch,
                methodSalesTotal: payment.methodSalesTotal,
              });
            }
          });
        }

        dailySalesReportObj.businessTotalSales +=
          userReport.userTotalSales ?? 0;
        dailySalesReportObj.businessTotalNetPaid +=
          userReport.userTotalNetPaid ?? 0;
        dailySalesReportObj.businessTotaltips += userReport.userTotalTips ?? 0;
        dailySalesReportObj.businessTotalCost += userReport.userTotalCost ?? 0;
        dailySalesReportObj.businessTotalCustomersServed +=
          userReport.userCustomersServed ?? 0;

        const updateGoodsArray = (array: any[], good: any) => {
          const existingGood = array.find(
            (item: any) => item.good === good._id
          );

          if (existingGood) {
            // If the item already exists, update the quantity, totalPrice, and totalCostPrice
            existingGood.quantity += good.quantity ?? 1;
            existingGood.totalPrice += good.totalPrice ?? 0;
            existingGood.totalCostPrice += good.totalCostPrice ?? 0;
          } else {
            // If it doesn't exist, create a new entry
            array.push({
              good: good.good,
              quantity: good.quantity ?? 1,
              totalPrice: good.totalPrice ?? 0,
              totalCostPrice: good.totalCostPrice ?? 0,
            });
          }
        };

        // Populate and reduce all the goods sold
        if (
          userReport.userGoodsSoldArray &&
          userReport.userGoodsSoldArray.length > 0
        ) {
          userReport.userGoodsSoldArray.forEach((businessGood: any) => {
            updateGoodsArray(businessGoodsReport.goodsSold, businessGood);
          });
        }

        // Populate and reduce all the goods void
        if (
          userReport.userGoodsVoidArray &&
          userReport.userGoodsVoidArray.length > 0
        ) {
          userReport.userGoodsVoidArray.forEach((businessGood: any) => {
            updateGoodsArray(businessGoodsReport.goodsVoid, businessGood);
          });
        }

        // Populate and reduce all the goods invited
        if (
          userReport.userGoodsInviteArray &&
          userReport.userGoodsInviteArray.length > 0
        ) {
          userReport.userGoodsInviteArray.forEach((businessGood: any) => {
            updateGoodsArray(businessGoodsReport.goodsInvited, businessGood);
          });
        }
      });
    }

    // calculate business total profit
    dailySalesReportObj.businessTotalProfit =
      dailySalesReportObj.businessTotalNetPaid -
      dailySalesReportObj.businessTotalCost;

    // calculate business average customers expended
    dailySalesReportObj.businessAverageCustomersExpended =
      dailySalesReportObj.businessTotalNetPaid /
      dailySalesReportObj.businessTotalCustomersServed;

    dailySalesReportObj.businessGoodsSoldArray = businessGoodsReport.goodsSold;
    dailySalesReportObj.businessGoodsVoidArray = businessGoodsReport.goodsVoid;
    dailySalesReportObj.businessGoodsInvitedArray =
      businessGoodsReport.goodsInvited;

    dailySalesReportObj.businessTotalVoidPrice =
      dailySalesReportObj.businessGoodsVoidArray.reduce(
        (acc, curr) => acc + curr.totalPrice,
        0
      );

    dailySalesReportObj.businessTotalInvitedPrice =
      dailySalesReportObj.businessGoodsInvitedArray.reduce(
        (acc, curr) => acc + curr.totalPrice,
        0
      );

    let comissionPercentage = 0;

    switch (dailySalesReport.business.subscription) {
      case "Free":
        comissionPercentage = 0;
        break;
      case "Basic":
        comissionPercentage = 0.05;
        break;
      case "Premium":
        comissionPercentage = 0.08;
        break;
      case "Enterprise":
        comissionPercentage = 0.1;
        break;
      default:
        comissionPercentage = 0;
        break;
    }

    // calculate the comission of the POS system app
    dailySalesReportObj.posSystemAppComission =
      dailySalesReportObj.businessTotalSales * comissionPercentage;

    // update the document in the database
    await DailySalesReport.findOneAndUpdate(
      { _id: dailySalesReportId },
      dailySalesReportObj,
      { new: true }
    );

    return new NextResponse(
      JSON.stringify({ message: "Daily sales report updated" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return handleApiError("Failed to update daily sales report! ", error);
  }
};
