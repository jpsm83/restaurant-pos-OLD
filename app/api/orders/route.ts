import { NextResponse } from "next/server";
import mongoose, { Types } from "mongoose";

// imported utils
import connectDb from "@/app/lib/utils/connectDb";
import { handleApiError } from "@/app/lib/utils/handleApiError";
import { updateDynamicCountSupplierGood } from "../inventories/utils/updateDynamicCountSupplierGood";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";
import { ordersArrValidation } from "./utils/validateOrdersArr";

// imported interfaces
import { IOrder } from "@/app/lib/interface/IOrder";
import { ISalesInstance } from "@/app/lib/interface/ISalesInstance";
import { IDailySalesReport } from "@/app/lib/interface/IDailySalesReport";

// imported models
import Order from "@/app/lib/models/order";
import SalesInstance from "@/app/lib/models/salesInstance";
import User from "@/app/lib/models/user";
import BusinessGood from "@/app/lib/models/businessGood";
import SalesPoint from "@/app/lib/models/salesPoint";
import DailySalesReport from "@/app/lib/models/dailySalesReport";

// importes test utils
import { closeOrders } from "./utils/closeOrders";
import { cancelOrders } from "./utils/cancelOrders";
import { addDiscountToOrders } from "./utils/addDiscountToOrders";
import { changeOrdersBillingStatus } from "./utils/changeOrdersBillingStatus";
import { changeOrdersStatus } from "./utils/changeOrdersStatus";
import { transferOrdersBetweenSalesInstances } from "./utils/transferOrdersBetweenSalesInstances";

// @desc    Get all orders
// @route   GET /orders
// @access  Private
export const GET = async () => {
  try {
    // connect before first call to DB
    await connectDb();

    const orders = await Order.find()
      .populate({
        path: "salesInstanceId",
        select: "salesPointId",
        populate: {
          path: "salesPointId",
          select: "salesPointName",
          model: SalesPoint,
        },
        model: SalesInstance,
      })
      .populate({
        path: "userId",
        select: "username allUserRoles currentShiftRole",
        model: User,
      })
      .populate({
        path: "businessGoodsIds",
        select:
          "name mainCategory subCategory productionTime sellingPrice allergens",
        model: BusinessGood,
      })
      .lean();

    return !orders.length
      ? new NextResponse(JSON.stringify({ message: "No orders found!" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        })
      : new NextResponse(JSON.stringify(orders), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
  } catch (error) {
    return handleApiError("Get all orders failed!", error);
  }
};

// *** IMPORTANT *** PROMOTIONS PRICE SHOULD BE CALCUATED ON THE FRONT END SO PRICE CAN BE SEEN REAL TIME

// INDIVIDUAL BUSINESS GOODS CANNOT HAVE MORE THAN ONE PROMOTION AT THE SAME TIME
// ex: (2x1 COCKTAILS) OR (50% OFF COCKTAILS) CANNOT BE APPLIED AT THE SAME TIME

// AT TIME OF ORDER CREATION IS WHERE WE CHECK IF ANY PROMOTION APPLY FROM THAT TIME ON
// IN THE FRONT CHECK IF THE ORDERS CAN BE APPLIED TO THE CURRENT PROMOTION
// IF IT DOES, APPLY THE CALCULATION AND SAVE THE PROMOTION NAME AND UPDATED NET PRICE
// ALL ORDERS WITH PROMOTION SHOULD HAVE THE PROMOTION NAME (FOR EASY INDENTIFICATION)
// IF PROMOTION APPLY TO THE ORDER, UPDATE ITS PRICE WITH THE PROMOTION RULES

// FOR SECOND ROUND OF ORDERS
// CHECK IF THE PROMOTION STILL APPLY
// GATHER ALL ORDERS THAT APPLY TO THE SAME PROMOTION, ORDERS ALREADY CREATED AND NEW ONES
// THE ABOVE LINE IS ALSO CHECKED ON THE FRONT END
// UPDATE THE PRICE OF THE ORDERS BEEN CREATED FOLLOWING THE PROMOTION RULES

// ===================================
// === FIRST ROUND OF ORDERS =========
// === ORDER_1 PRICE_100 PROMO_2x1 ===
// === ORDER_2   PRICE_0 PROMO_2x1 ===
// === ORDER_3 PRICE_100 PROMO_2x1 ===
// ===================================
// === SECOND ROUND OF ORDERS ========
// === ORDER_4 ccPRICE_0 PROMO_2x1 ===
// ===================================

// ORDERS ARE CREATED INDIVIDUALLY UNLESS IT HAS ADDONS
// THAT WAY WE CAN APPLY PROMOTIONS TO INDIVIDUAL ORDERS, MANAGE PAYMENTS AND TRACK THE STATUS OF EACH ORDER EASILY

// @desc    Create new order
// @route   POST /orders
// @access  Private
export const POST = async (req: Request) => {
  // - FLOW - in case if customer pays at the time of the order
  // - CREATE the order with billing status "Open"
  // - GET the order by its ID
  // - UPDATE the order with the payment method and billing status "Paid"
  // - UPDATE the salesInstanceId status to "Closed" (if all orders are paid)
  // - *** IMPORTANT ***
  // - Because it has been payed, doesn't mean orderStatus is "Done"

  // *** ordersArr is an array of objects with the order details ***
  // [
  //    {
  //       orderGrossPrice,
  //       orderNetPrice, - calculated on the front_end following the promotion rules
  //       orderCostPrice,
  //       businessGoodsIds, - can be an array of businessId goods (3 IDs) "burger with extra cheese and add bacon"
  //       allergens,
  //       promotionApplyed, - automatically set by the front_end upon creation
  //       comments
  //    }
  //]

  // paymentMethod cannot be created here, only updated - MAKE IT SIMPLE
  const { ordersArr, userId, salesInstanceId, businessId } =
    (await req.json()) as {
      ordersArr: Partial<IOrder>[];
      userId: Types.ObjectId;
      salesInstanceId: Types.ObjectId;
      businessId: Types.ObjectId;
    };

  // check required fields
  if (!ordersArr || !userId || !salesInstanceId || !businessId) {
    return new NextResponse(
      JSON.stringify({
        message:
          "OrdersArr, userId, salesInstanceId and businessId are required fields!",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // validate ids
  if (isObjectIdValid([userId, businessId, salesInstanceId]) !== true) {
    return new NextResponse(
      JSON.stringify({
        message:
          "BusinessGoodsIds, userId, businessId or salesInstanceId not valid!",
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // validate ordersArr
  const ordersArrValidationResult = ordersArrValidation(ordersArr);
  if (ordersArrValidationResult !== true) {
    return new NextResponse(
      JSON.stringify({ message: ordersArrValidationResult }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // connect before first call to DB
  await connectDb();

  // Start a session to handle transactions
  // with session if any error occurs, the transaction will be aborted
  // session is created outside of the try block to be able to abort it in the catch/finally block
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Check if salesInstanceId exists and is open
    const salesInstance: ISalesInstance | null = await SalesInstance.findById(
      salesInstanceId
    )
      .select("status")
      .lean();

    if (!salesInstance || salesInstance.status === "Closed") {
      await session.abortTransaction();
      return new NextResponse(
        JSON.stringify({ message: "SalesInstance not found or closed!" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // get the dailySalesReport reference number
    const dailySalesReport: IDailySalesReport | null =
      await DailySalesReport.findOne({
        isDailyReportOpen: true,
        businessId,
      })
        .select("dailyReferenceNumber")
        .lean();

    if (!dailySalesReport) {
      await session.abortTransaction();
      return new NextResponse(
        JSON.stringify({ message: "DailySalesReport not found!" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // ***********************************************
    // ORDERS CAN BE DUPLICATED WITH DIFFERENT IDs ***
    // ***********************************************

    // orderStatus will always be "Sent" at the time of creation unless user set it to something else manually at the front end
    // all orders sent will have their own screen where employees can change the status of the order (kitchen, bar, merchandise, etc.)

    // Prepare orders for bulk insertion
    const ordersToInsert = ordersArr.map((order) => ({
      dailyReferenceNumber: dailySalesReport.dailyReferenceNumber,
      billingStatus: "Open",
      orderStatus: "Sent",
      userId,
      salesInstanceId,
      businessId,
      orderGrossPrice: order.orderGrossPrice,
      orderNetPrice: order.orderNetPrice,
      orderCostPrice: order.orderCostPrice,
      businessGoodsIds: order.businessGoodsIds,
      allergens: order.allergens || undefined,
      promotionApplyed: order.promotionApplyed || undefined,
      discountPercentage: order.discountPercentage || undefined,
    }));

    // Bulk insert the orders
    const ordersCreated = await Order.insertMany(ordersToInsert, { session });

    if (!ordersCreated || ordersCreated.length === 0) {
      await session.abortTransaction();
      return new NextResponse(
        JSON.stringify({ message: "Orders not created!" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const ordersIdsCreated = ordersCreated.map((order) => order._id);
    const businessGoodsIds = ordersCreated.flatMap(
      (order) => order.businessGoodsIds
    );

    // update the dynamic count of the supplier goods ingredients
    // dynamicSystemCount have to decrease because the ingredients are being used
    let updateDynamicCountSupplierGoodResult: any =
      await updateDynamicCountSupplierGood(businessGoodsIds, "remove");

    if (updateDynamicCountSupplierGoodResult !== true) {
      await session.abortTransaction();
      return new NextResponse(
        JSON.stringify({
          message:
            "updateDynamicCountSupplierGood failed! Error: " +
            updateDynamicCountSupplierGoodResult,
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // set the order code for user tracking purposes
    // it will be add on the salesInstance.salesGroup array related with this group of orders
    const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const day = String(new Date().getDate()).padStart(2, "0");
    const month = String(new Date().getMonth() + 1).padStart(2, "0");
    const dayOfWeek = weekDays[new Date().getDay()];
    const randomNum = String(Math.floor(Math.random() * 9000) + 1000);

    const orderCode = `${day}${month}${dayOfWeek}${randomNum}`;

    // After order is created, add order ID to salesInstanceId
    await SalesInstance.findByIdAndUpdate(
      { _id: salesInstanceId },
      {
        $push: {
          salesGroup: {
            orderCode: orderCode,
            ordersIds: ordersIdsCreated,
            createdAt: new Date(),
          },
        },
      },
      { new: true, session }
    );

    // Commit the transaction if both operations succeed
    await session.commitTransaction();

    return new NextResponse(
      JSON.stringify({ message: "Orders created successfully!" }),
      { status: 201, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    await session.abortTransaction();
    return handleApiError("Create order failed!", error);
  } finally {
    session.endSession();
  }
};

// export const POST = async (req: Request) => {
//   try {
//     // connect before first call to DB
//     await connectDb();

//     const fromSalesInstanceId = "670bf0ba6d2e71fb1856bb81";
//     const guests = 4;
//     const clientName = "testing";

//     const toSalesInstanceId = "670ccbcac966c93a0bd46f16";
//     const newSalesPointId = "6707a83888a5002362018ccc";

//     const ordersArr = ["670a72fe455b93fc7f9ad7ad", "670a72fe455b93fc7f9ad7ae"];
//     // const ordersArr = ["670a72fe455b93fc7f9ad777", "670a72fe455b93fc7f9ad777"];

//     const paymentMethod = [
//       {
//         paymentMethodType: "Card",
//         methodBranch: "Visa",
//         methodSalesTotal: 20,
//       },
//       {
//         paymentMethodType: "Card",
//         methodBranch: "Mastercard",
//         methodSalesTotal: 100,
//       },
//       {
//         paymentMethodType: "Cash",
//         methodBranch: "Cash",
//         methodSalesTotal: 90,
//       },
//       {
//         paymentMethodType: "Crypto",
//         methodBranch: "Bitcoin",
//         methodSalesTotal: 80,
//       },
//       {
//         paymentMethodType: "Other",
//         methodBranch: "Voucher",
//         methodSalesTotal: 150,
//       },
//     ];

//     // // @ts-ignore
//     // const result = await addDiscountToOrders(ordersArr, 10, "10% Discount for all");

//     // // @ts-ignore
//     // const result = await cancelOrders(["670a72fe455b93fc7f9ad7ad"]);

//     // // @ts-ignore
//     // const result = await changeOrdersBillingStatus(ordersArr, "Invitation");

//     // // @ts-ignore
//     // const result = await changeOrdersStatus(ordersArr, "Done");

//     // // @ts-ignore
//     // const result = await closeOrders(ordersArr, paymentMethod);

//     // // @ts-ignore
//     // const result = await transferOrdersBetweenSalesInstances(ordersArr, fromSalesInstanceId, toSalesInstanceId, undefined, guests, clientName);

//     return new NextResponse(JSON.stringify(result), {
//       status: 200,
//       headers: { "Content-Type": "application/json" },
//     });
//   } catch (error) {
//     return handleApiError("Function failed!", error);
//   }
// };
