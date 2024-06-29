import connectDB from "@/app/lib/db";
import { NextResponse } from "next/server";
import { IOrder } from "@/app/lib/interface/IOrder";

// import models
import Order from "@/app/lib/models/order";
import Table from "@/app/lib/models/table";
import { handleApiError } from "@/app/utils/handleApiError";
import { updateDynamicCountSupplierGood } from "./utils/updateDynamicCountSupplierGood";
import { cancelOrderAndUpdateDynamicCount } from "./utils/cancelOrderAndUpdateDynamicCount";

// @desc    Get all orders
// @route   GET /orders
// @access  Private
export const GET = async () => {
  try {
    // connect before first call to DB
    await connectDB();

    const orders = await Order.find()
      .populate("table", "tableReferenceNumber dayReferenceNumber")
      .populate("user", "username allUserRoles currentShiftRole")
      .populate(
        "businessGoods",
        "name category subCategory productionTime sellingPrice allergens"
      )
      .lean();

    return !orders.length
      ? new NextResponse("No orders found!", {
          status: 404,
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
// ex: 2x1 COCKTAILS AND 50% OFF COCKTAILS CANNOT BE APPLIED AT THE SAME TIME

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

// @desc    Create new order
// @route   POST /orders
// @access  Private
export const POST = async (req: Request) => {
  try {
    // connect before first call to DB
    await connectDB();

    // paymentMethod cannot be created here, only updated - MAKE IT SIMPLE
    const {
      dayReferenceNumber,
      orderPrice,
      orderNetPrice,
      orderCostPrice,
      user,
      table,
      businessGoods, // can be an aray of business goods (3 IDs) "burger with extra cheese and add bacon"
      business,
      allergens,
      promotionApplyed,
      discountPercentage,
      comments,
    } = (await req.json()) as IOrder;

    // promotionApplyed is automatically set by the front end upon creation
    // net price is calculated on the front end following the promotion rules
    // IT MUST BE DONE ON THE FRONT SO THE CLIENT CAN SEE THE DISCOUNT REAL TIME

    // check required fields
    if (
      !dayReferenceNumber ||
      !orderPrice ||
      !orderNetPrice ||
      !orderCostPrice ||
      !user ||
      !table ||
      !businessGoods ||
      !business
    ) {
      return new NextResponse(
        "DayReferenceNumber, orderPrice, orderNetPrice, user, table, businessGoods and business are required fields!",
        { status: 400 }
      );
    }

    // ***********************************************
    // ORDERS CAN BE DUPLICATED WITH DIFFERENT IDs ***
    // ***********************************************

    // create an order object with required fields
    const newOrder: IOrder = {
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

    // if promotion applyed, discountPercentage cannot be applyed
    if (promotionApplyed && discountPercentage) {
      return new NextResponse(
        "You cannot apply discount to an order that has a promotion already!",
        { status: 400 }
      );
    }

    // create a new order
    const order = await Order.create(newOrder);

    // confirm order was created
    if (order) {
      // update the dynamic count of supplier goods
      await updateDynamicCountSupplierGood(newOrder.businessGoods, "add");

      // After order is created, add order ID to table
      await Table.findByIdAndUpdate(
        { _id: table },
        { $push: { orders: order._id } },
        { new: true }
      );
      return new NextResponse("Order created successfully!", { status: 201 });
    }
  } catch (error) {
    return handleApiError("Create order failed!", error);
  }
};

// // @desc    Create new order
// // @route   POST /orders
// // @access  Private
// export const POST = async (req: Request) => {
//   try {
//     const orderId = "66800d40ec4e6345a3102aee";

//     // @ts-ignore
//     const result = cancelOrderAndUpdateDynamicCount(orderId);

//     return new NextResponse(result, {
//       status: 200
//     });
//   } catch (error) {
//     return handleApiError("Cancel order failed!", error);
//   }
// };
