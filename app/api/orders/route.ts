import connectDB from "@/lib/db";
import { NextResponse } from "next/server";
import { IOrder } from "@/app/interface/IOrder";

// import models
import Order from "@/lib/models/order";
import Table from "@/lib/models/table";

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
      ? new NextResponse(JSON.stringify({ message: "No orders found!" }), {
          status: 404,
        })
      : new NextResponse(JSON.stringify(orders), { status: 200 });
  } catch (error: any) {
    return new NextResponse("Error: " + error, { status: 500 });
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

// @desc    Create new order
// @route   POST /orders
// @access  Private
// paymentMethod cannot be created here, only updated - MAKE IT SIMPLE
export const POST = async (req: Request) => {
  try {
    // connect before first call to DB
    await connectDB();

    const {
      dayReferenceNumber,
      orderStatus,
      orderPrice,
      orderNetPrice,
      orderCostPrice,
      user,
      table,
      businessGoods,
      business,
      allergens,
      promotionApplyed,
      discountPercentage,
      comments,
    } = req.body as unknown as IOrder;

    // promotionApplyed is automatically set by the front end upon creation
    // net price is calculated on the front end following the promotion rules
    // IT MUST BE DONE ON THE FRONT SO THE CLIENT CAN SEE THE DISCOUNT

    // check required fields
    if (
      !dayReferenceNumber ||
      !orderStatus ||
      !orderPrice ||
      !orderNetPrice ||
      !orderCostPrice ||
      !user ||
      !table ||
      !businessGoods ||
      !business
    ) {
      return new NextResponse(
        JSON.stringify({
          message:
            "DayReferenceNumber, orderStatus, orderPrice, orderNetPrice, user, table, businessGoods and business are required fields!",
        }),
        { status: 400 }
      );
    }

    // ***********************************************
    // ORDERS CAN BE DUPLICATED WITH DIFFERENT IDs ***
    // ***********************************************

    // create an order object with required fields
    const orderObj: IOrder = {
      dayReferenceNumber: dayReferenceNumber,
      // order status is automatically set by the front end
      // because we already got the current user role
      // flow in case if customer pays at the time of the order
      //    - CREATE the order with billing status "Open"
      //    - GET the order by its ID
      //    - UPDATE the order with the payment method and billing status "Paid"
      //    - UPDATE the table status to "Closed" (if all orders are paid)
      //    - *** IMPORTANT ***
      //         - Because it has been payed, doesn't mean orderStatus is "Done"
      //         - BARISTA, BARTENDER, CASHIER orders are automatically set to "Done" if all business goods are beverages because they make it on spot, if food, set to "Sent" because kitchen has to make it
      //         - ALL THE REST OF STAFF orders are automatically set to "Sent" NOT "Done" because they have to wait for the order to be ready
      orderStatus,
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
      comments: comments || undefined,
    };

    // if promotion applyed, discountPercentage cannot be applyed
    if (promotionApplyed) {
      if (discountPercentage) {
        return new NextResponse(
          JSON.stringify({
            message:
              "You cannot apply discount to an order that has a promotion already!",
          }),
          { status: 400 }
        );
      } else {
        orderObj.discountPercentage = discountPercentage || undefined;
      }
    }

    // create a new order
    const order = await Order.create(orderObj);

    // confirm order was created
    if (order) {
      // LOGIC TO BE DONE *************
      // every time an order is created, we MUST update the supplier goods
      // check all the ingredients of the business goods
      // each ingredient is a supplier good
      // deduct the quantity used from the supplierGood.dynamicCountFromLastInventory
      // if insted of ingredients we have setMenu
      //get all business goods from the setMenu
      // every business good has ingredients
      // deduct the quantity used from the supplierGood.dynamicCountFromLastInventory

      // REVIEW ON ALL FUNCTIONS IN THIS CONTROLLER
      // After order is created, add order ID to table
      await Table.findByIdAndUpdate(
        { _id: table },
        { $push: { orders: order._id } },
        { new: true, useFindAndModify: false }
      ).lean();
      return new NextResponse(
        JSON.stringify({ message: "Order created successfully!" }),
        { status: 201 }
      );
    } else {
      return new NextResponse(
        JSON.stringify({ message: "Order creation failed!" }),
        { status: 400 }
      );
    }
  } catch (error: any) {
    return new NextResponse("Error: " + error, { status: 500 });
  }
};
