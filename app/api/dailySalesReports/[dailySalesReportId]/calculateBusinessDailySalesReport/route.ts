import connectDb from "@/app/lib/utils/connectDb";
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

// @desc    Create new notifications
// @route   POST /dailySalesReports/:dailySalesReportId/calculateBusinessDailySalesReport
// @access  Private
export const POST = async (req: Request, context: { params: { dailySalesReportId: Types.ObjectId } }) => {
  // this function will call the updateUserDailySalesReportGeneric function to update the user daily sales report
  // them it will update the whole business daily sales report
  // this is called by mananger or admin
  try {
    const { userId } = (await req.json()) as {
      userId: Types.ObjectId;
    };

    const dailySalesReportId = context.params.dailySalesReportId;

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
    await connectDb();

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
        "_id dailyReferenceNumber usersDailySalesReport.user usersDailySalesReport.hasOpenTables business"
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
      businessPaymentMethods: [] as IPayment[],
      dailyTotalSalesBeforeAdjustments: 0,
      dailyNetPaidAmount: 0,
      dailyTipsReceived: 0,
      dailyCostOfGoodsSold: 0,
      dailyProfit: 0,
      dailyCustomersServed: 0,
      dailyAverageCustomerExpenditure: 0,
      dailySoldGoods: [] as IBusinessGood[],
      dailyVoidedGoods: [] as IBusinessGood[],
      dailyInvitedGoods: [] as IBusinessGood[],
      dailyTotalVoidValue: 0,
      dailyTotalInvitedValue: 0,
      dailyPosSystemCommission: 0,
    };

    // Update each user's daily sales report
    const updateUsersDailySalesReport: IUserDailySalesReport[] =
      await Promise.all(
        dailySalesReport.usersDailySalesReport.map(async (user: any) => {
          try {
            // Get the user daily sales report object
            return await updateUserDailySalesReportGeneric(
              user.user,
              dailySalesReport.dailyReferenceNumber
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
        // Check if userPaymentMethods is defined before iterating
        if (userReport.userPaymentMethods) {
          userReport.userPaymentMethods.forEach((payment: IPayment) => {
            // Find if the payment method and branch combination already exists in the dailySalesReportObj.userPaymentMethods array
            const existingPayment = dailySalesReportObj.businessPaymentMethods.find(
              (p: IPayment) =>
                p.paymentMethodType === payment.paymentMethodType &&
                p.methodBranch === payment.methodBranch
            );

            if (existingPayment) {
              // If it exists, add the current payment's methodSalesTotal to the existing one
              existingPayment.methodSalesTotal += payment.methodSalesTotal;
            } else {
              // If it doesn't exist, create a new entry in the dailySalesReportObj.businessPaymentMethods array
              dailySalesReportObj.businessPaymentMethods.push({
                paymentMethodType: payment.paymentMethodType,
                methodBranch: payment.methodBranch,
                methodSalesTotal: payment.methodSalesTotal,
              });
            }
          });
        }

        dailySalesReportObj.dailyTotalSalesBeforeAdjustments +=
          userReport.totalSalesBeforeAdjustments ?? 0;
        dailySalesReportObj.dailyNetPaidAmount +=
          userReport.totalNetPaidAmount ?? 0;
        dailySalesReportObj.dailyTipsReceived += userReport.totalTipsReceived ?? 0;
        dailySalesReportObj.dailyCostOfGoodsSold += userReport.totalCostOfGoodsSold ?? 0;
        dailySalesReportObj.dailyCustomersServed +=
          userReport.totalCustomersServed ?? 0;

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
          userReport.soldGoods &&
          userReport.soldGoods.length > 0
        ) {
          userReport.soldGoods.forEach((businessGood: any) => {
            updateGoodsArray(businessGoodsReport.goodsSold, businessGood);
          });
        }

        // Populate and reduce all the goods void
        if (
          userReport.voidedGoods &&
          userReport.voidedGoods.length > 0
        ) {
          userReport.voidedGoods.forEach((businessGood: any) => {
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
    dailySalesReportObj.dailyProfit =
      dailySalesReportObj.dailyNetPaidAmount -
      dailySalesReportObj.dailyCostOfGoodsSold;

    // calculate business average customers expended
    dailySalesReportObj.dailyAverageCustomerExpenditure =
      dailySalesReportObj.dailyNetPaidAmount /
      dailySalesReportObj.dailyCustomersServed;

    dailySalesReportObj.dailySoldGoods = businessGoodsReport.goodsSold;
    dailySalesReportObj.dailyVoidedGoods = businessGoodsReport.goodsVoid;
    dailySalesReportObj.dailyInvitedGoods =
      businessGoodsReport.goodsInvited;

    dailySalesReportObj.dailyTotalVoidValue =
      dailySalesReportObj.dailyVoidedGoods.reduce(
        (acc, curr) => acc + curr.totalPrice,
        0
      );

    dailySalesReportObj.dailyTotalInvitedValue =
      dailySalesReportObj.dailyInvitedGoods.reduce(
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
    dailySalesReportObj.dailyPosSystemCommission =
      dailySalesReportObj.dailyTotalSalesBeforeAdjustments * comissionPercentage;

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
