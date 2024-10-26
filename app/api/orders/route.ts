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
import Employee from "@/app/lib/models/employee";
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
import Customer from "@/app/lib/models/customer";
import { create } from "domain";
import { createOrders } from "./utils/createOrders";

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
        path: "employeeId",
        select: "employeeName allEmployeeRoles currentShiftRole",
        model: Employee,
      })
      .populate({
        path: "customerId",
        select: "employeeName allEmployeeRoles currentShiftRole",
        model: Customer,
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
  // *********** IMPORTANT ***********
  // this route is used only by the employee to create orders
  // the customer will create the order through the salesInstance route
  // *********************************

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
  //       discountPercentage
  //    }
  //]

  // paymentMethod cannot be created here, only updated - MAKE IT SIMPLE
  const {
    ordersArr,
    employeeId,
    salesInstanceId,
    businessId,
    dailyReferenceNumber,
  } = (await req.json()) as {
    ordersArr: Partial<IOrder>[];
    employeeId: Types.ObjectId;
    salesInstanceId: Types.ObjectId;
    businessId: Types.ObjectId;
    dailyReferenceNumber: string;
  };

  // check required fields
  if (
    !ordersArr ||
    !salesInstanceId ||
    !businessId ||
    !employeeId ||
    !dailyReferenceNumber
  ) {
    return new NextResponse(
      JSON.stringify({
        message:
          "OrdersArr, dailyReferenceNumber, employeeId, salesInstanceId and businessId are required fields!",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  let objectIds: any[] = ordersArr.flatMap((order) => order.businessGoodsIds);
  objectIds.push(businessId, salesInstanceId, employeeId);

  // validate ids
  if (isObjectIdValid(objectIds) !== true) {
    return new NextResponse(
      JSON.stringify({
        message:
          "BusinessGoodsIds, employeeId, businessId or salesInstanceId not valid!",
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

  try {
    const createdOrders = await createOrders(
      dailyReferenceNumber,
      ordersArr,
      employeeId,
      undefined,
      salesInstanceId,
      businessId
    );

    if (typeof createdOrders === "string") {
      return new NextResponse(JSON.stringify({ message: createdOrders }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
  } catch (error) {
    return handleApiError("Create order failed!", error);
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
