import connectDb from "@/app/lib/utils/connectDb";
import { NextResponse } from "next/server";

// import utils
import { handleApiError } from "@/app/lib/utils/handleApiError";
import { updateDynamicCountSupplierGood } from "../inventories/utils/updateDynamicCountSupplierGood";

// import interfaces
import { IOrder } from "@/app/lib/interface/IOrder";
import { ITable } from "@/app/lib/interface/ITable";

// import models
import Order from "@/app/lib/models/order";
import Table from "@/app/lib/models/table";
import User from "@/app/lib/models/user";
import BusinessGood from "@/app/lib/models/businessGood";

// @desc    Get all orders
// @route   GET /orders
// @access  Private
export const GET = async () => {
  try {
    // connect before first call to DB
    await connectDb();

    const orders = await Order.find()
      .populate({ path: "table", select: "tableReference", model: Table })
      .populate({
        path: "user",
        select: "username allUserRoles currentShiftRole",
        model: User,
      })
      .populate({
        path: "businessGoods",
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

// *** IMPORTANT *** PROMOTIONS PRICE SHOULD BE CALCUATED ON THE FRONT END

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

// FIRST ROUND OF ORDERS
// ORDER_1 PRICE_100 PROMO_2x1
// ORDER_2   PRICE_0 PROMO_2x1
// ORDER_3 PRICE_100 PROMO_2x1
// ====================================
// SECOND ROUND OF ORDERS
// ORDER_4 PRICE_0 PROMO_2x1

// ORDERS ARE CREATED INDIVIDUALLY UNLESS IT HAS ADDONS
// THAT WAY WE CAN APPLY PROMOTIONS TO INDIVIDUAL ORDERS, MANAGE PAYMENTS AND TRACK THE STATUS OF EACH ORDER EASILY

// orders are created individually, but are sent togueder to the kitchen or bar
// those group of orders have the same orderCode

// @desc    Create new order
// @route   POST /orders
// @access  Private
export const POST = async (req: Request) => {
  try {
    // paymentMethod cannot be created here, only updated - MAKE IT SIMPLE
    const {
      dayReferenceNumber,
      orderPrice,
      orderNetPrice,
      orderCostPrice,
      user,
      userRole,
      table,
      businessGoods, // can be an array of business goods (3 IDs) "burger with extra cheese and add bacon"
      businessGoodsCategory,
      business,
      allergens,
      promotionApplyed,
      discountPercentage,
      comments,
    } = (await req.json()) as IOrder;

    // promotionApplyed is automatically set by the front_end upon creation
    // orderNetPrice is calculated on the front_end following the promotion rules
    // IT MUST BE DONE ON THE FRONT SO THE CLIENT CAN SEE THE DISCOUNT REAL TIME

    // check required fields
    if (
      !dayReferenceNumber ||
      !orderPrice ||
      !orderNetPrice ||
      !orderCostPrice ||
      !user ||
      !userRole ||
      !table ||
      !businessGoods ||
      !businessGoodsCategory ||
      !business
    ) {
      return new NextResponse(
        JSON.stringify({
          message:
            "DayReferenceNumber, orderPrice, orderNetPrice, user, userRole, table, businessGoods, businessGoodsCategory and business are required fields!",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // check if table exists and its open
    const tableExists: ITable | null = await Table.findById(table)
      .select("status")
      .lean();
    if (!tableExists || tableExists.status === "Closed") {
      return new NextResponse(
        JSON.stringify({ message: "Table not found or closed!" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // ***********************************************
    // ORDERS CAN BE DUPLICATED WITH DIFFERENT IDs ***
    // ***********************************************

    const weekDays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const day = (new Date().getDate()).toString();
    const month = (new Date().getMonth() + 1).toString(); // getMonth() returns 0-11, so add 1
    const dayOfWeek = weekDays[new Date().getDay()];
    const randomNum = (Math.floor(Math.random() * 9000) + 1000).toString();
    const orderCode = (day.length === 1 ? "0" + day : day) + (month.length === 1 ? "0" + month : month) + dayOfWeek.slice(0,3) + randomNum;

    // create an order object with required fields
    const newOrder = {
      dayReferenceNumber: dayReferenceNumber,
      // order status is automatically set by the front end
      // FLOW - in case if customer pays at the time of the order
      //    - CREATE the order with billing status "Open"
      //    - GET the order by its ID
      //    - UPDATE the order with the payment method and billing status "Paid"
      //    - UPDATE the table status to "Closed" (if all orders are paid)
      //    - *** IMPORTANT ***
      //         - Because it has been payed, doesn't mean orderStatus is "Done"
      //         - BARISTA, BARTENDER, CASHIER orders are automatically set to "Done" if all business goods are beverages because they make it on spot, if food, set to "Sent" because kitchen has to make it
      //         - ALL THE REST OF STAFF orders are automatically set to "Sent" NOT "Done" because they have to wait for the order to be done by somebody else
      orderPrice,
      orderNetPrice,
      orderCostPrice,
      orderStatus: "Sent",
      orderCode: orderCode,
      user,
      table,
      businessGoods,
      business,
      // add non-required fields
      allergens: allergens || undefined,
      promotionApplyed: promotionApplyed || undefined,
      discountPercentage: discountPercentage || undefined,
      comments: comments || undefined,
    };

    // set orderStatus based on userRole
    if (
      (userRole === "Barista" ||
        userRole === "Bartender" ||
        userRole === "Cashier") &&
      businessGoodsCategory === "Beverage"
    ) {
      newOrder.orderStatus = "Done";
    }

    // if promotion applyed, discountPercentage cannot be applyed
    if (promotionApplyed && discountPercentage) {
      return new NextResponse(
        JSON.stringify({
          message:
            "You cannot apply discount to an order that has a promotion already!",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // connect before first call to DB
    await connectDb();

    // create a new order
    const order = await Order.create(newOrder);

    // confirm order was created
    if (order) {
      // update the dynamic count of supplier goods
      // "add" or "remove" from the count
      const updateDynamicCountSupplierGoodResult = await updateDynamicCountSupplierGood(newOrder.businessGoods, "add");

      if(updateDynamicCountSupplierGoodResult !== true) {
        return new NextResponse(
          JSON.stringify({ message: "updateDynamicCountSupplierGood! " + updateDynamicCountSupplierGoodResult }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      };

      // After order is created, add order ID to table
      await Table.findByIdAndUpdate(
        { _id: table },
        { $push: { orders: order._id } },
        { new: true },
      );
    }

    return new NextResponse(
      JSON.stringify({ message: "Order created successfully!" }),
      { status: 201, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return handleApiError("Create order failed!", error);
  }
};
