const asyncHandler = require("express-async-handler");

// import models
const Order = require("../models/Order");
const Table = require("../models/Table");

// @desc    Get all orders
// @route   GET /orders
// @access  Private
const getOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find()
    .populate("table", "tableReferenceNumber dayReferenceNumber")
    .populate("user", "username allUserRoles currentShiftRole")
    .populate(
      "businessGoods",
      "name category subCategory productionTime sellingPrice allergens"
    )
    .lean();

  return !orders.length
    ? res.status(404).json({ message: "No orders found!" })
    : res.json(orders);
});

// @desc    Get order by ID
// @route   GET /orders/:id
// @access  Private
const getOrderById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const order = await Order.findById(id)
    .populate("table", "tableReferenceNumber dayReferenceNumber")
    .populate("user", "username allUserRoles currentShiftRole")
    .populate(
      "businessGoods",
      "name category subCategory productionTime sellingPrice allergens"
    )
    .lean();

  return !order
    ? res.status(404).json({ message: "Order not found!" })
    : res.json(order);
});

// @desc    Get orders table ID
// @route   GET /orders/table/:tableId
// @access  Private
const getOrdersByTableId = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const orders = await Order.find({ table: id })
    .populate("table", "tableReferenceNumber dayReferenceNumber")
    .populate("user", "username allUserRoles currentShiftRole")
    .populate(
      "businessGoods",
      "name category subCategory productionTime sellingPrice allergens"
    )
    .lean();

  return !orders.length
    ? res.status(404).json({ message: "No orders found!" })
    : res.json(orders);
});

// example of a payment method object
// paymentMethod = [
//   {
//     method: "Card",
//     card: "Visa",
//     paymentMethodAmount: 40,
//   },
//   {
//     method: "Cash",
//     paymentMethodAmount: 60,
//   },
// ];

const validatePaymentMethodArray = (paymentMethod) => {
  if (!Array.isArray(paymentMethod)) {
    return "Invalid paymentMethod array!";
  }

  for (let payment of paymentMethod) {
    if (!payment.method || !payment.paymentMethodAmount) {
      return "Payment has no method or paymentMethodAmount!";
    }
    switch (payment.method) {
      case "Card":
        if (!payment.card) {
          return "Card payment method provided without card details";
        }
        break;
      case "Crypto":
        if (!payment.crypto) {
          return "Crypto payment method provided without crypto details";
        }
        break;
      case "Other":
        if (!payment.other) {
          return "Other payment method provided without other details";
        }
        break;
      case "Cash":
        // No additional validation needed for cash payments
        break;
      default:
        return "Invalid payment method";
    }
  }
  return paymentMethod;
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
const createOrder = asyncHandler(async (req, res) => {
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
  } = req.body;

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
    return res.status(400).json({
      message:
        "DayReferenceNumber, orderStatus, orderPrice, orderNetPrice, user, table, businessGoods and business are required fields!",
    });
  }

  // ***********************************************
  // ORDERS CAN BE DUPLICATED WITH DIFFERENT IDs ***
  // ***********************************************

  // create an order object with required fields
  const orderObj = {
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
      return res.status(400).json({
        message:
          "You cannot apply discount to an order that has a promotion already!",
      });
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
    return res.status(201).json({ message: "Order created successfully!" });
  } else {
    return res.status(400).json({ message: "Order creation failed!" });
  }
});

// @desc    Update order by ID
// @route   PATCH /orders/:id
// @access  Private
// UPDATE PAYMENT METHOD FOR INDIVIDUAL ORDERS
const updateOrder = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    billingStatus,
    orderStatus,
    orderPrice,
    orderNetPrice,
    table,
    paymentMethod,
    discountPercentage,
    comments,
  } = req.body;

  // check if order exists
  const order = await Order.findById(id);
  if (!order) {
    return res.status(404).json({ message: "Order not found!" });
  }

  // prepare the update object
  let updateObj = {
    billingStatus: billingStatus || order.billingStatus,
    orderStatus: orderStatus || order.orderStatus,
    orderPrice: orderPrice || order.orderPrice,
    orderNetPrice: orderNetPrice || order.orderNetPrice,
    table: table || order.table,
  };

  // check if table is not duplicated
  if (table !== order.table) {
    // Update the table document by adding the order id to it
    await Table.findOneAndUpdate(
      { _id: table },
      { $push: { orders: order._id } },
      { new: true, useFindAndModify: false }
    );
    // Remove the order id from the old table
    await Table.findOneAndUpdate(
      { _id: order.table },
      { $pull: { orders: order._id } },
      { new: true, useFindAndModify: false }
    );
  }

  // if billing status is "Void" or "Invitation", comments are required
  switch (billingStatus) {
    case "Void":
    case "Invitation":
      if (!comments) {
        return res.status(400).json({
          message:
            "Comments are required for Void, Cancelled, and Invitation billing status!",
        });
      }
      updateObj.orderNetPrice = 0;
      break;
    case "Cancelled":
      if (order.orderStatus === "Done") {
        return res
          .status(400)
          .json({ message: "Done orders cannot be Cancelled!" });
      }
      // CANCELLED orders are deleted because they have no effect on the business IF they havent been done
      // not done, no loss, no gain
      const orderDeleted = await order.deleteOne();
      // remove the order id from the table
      await Table.findByIdAndUpdate(
        { _id: orderDeleted.table },
        { $pull: { orders: order._id } },
        { new: true, useFindAndModify: false }
      ).lean();
      return res.json({
        message: `Order ${orderDeleted.id} cancelled and deleted successfully!`,
      });
    default:
      break;
  }

  // do not add discount if promotion applyed
  // if discount percentage is provided, the total price will be calculated on the front end
  // because the discount have to be seen by the user
  if (discountPercentage) {
    if (order.promotionApplyed) {
      return res.status(400).json({
        message:
          "You cannot add discount to an order that has a promotion already!",
      });
    }
    if (!comments) {
      return res.status(400).json({
        message: "Comments are required if promotion applied!",
      });
    }
    if (discountPercentage > 100 || discountPercentage < 0) {
      return res
        .status(400)
        .json({ message: "Discount value has to be between 0 and 100!" });
    }
    updateObj.discountPercentage = discountPercentage;
  }

  // if payment method is provided, check if object is valid them update the payment method
  // paymentMethod is coming from the front as an object with method, card, crypto, or other
  if (paymentMethod) {
    let validPaymentMethods = validatePaymentMethodArray(paymentMethod);
    if (typeof validPaymentMethods === "array") {
      let totalOrderPaid = 0;

      for (let payment of validPaymentMethods) {
        totalOrderPaid += payment.paymentMethodAmount;
      }

      if (totalOrderPaid < order.orderNetPrice) {
        return res.status(400).json({
          message:
            "Total amount paid is lower than the total price of the order!",
        });
      }

      if (totalOrderPaid > order.orderNetPrice) {
        updateObj.orderTips = totalOrderPaid - order.orderNetPrice;
      }

      updateObj.billingStatus = "Paid";
      updateObj.orderStatus = "Done";
    } else {
      return res.status(400).json({ message: validPaymentMethods });
    }
  }
  updateObj.paymentMethod = paymentMethod;

  // updateObj the order
  const updatedOrder = await Order.findOneAndUpdate({ _id: id }, updateObj, {
    new: true,
    useFindAndModify: false,
  });

  return updatedOrder
    ? res.json({
        message: `Order id ${updatedOrder.id} updated successfully!`,
      })
    : res.status(500).json({ message: "Order update failed!" });
});

// @desc    Update multiple orders by orders ID array
// @route   PATCH /orders/bulk
// @access  Private
// UPDATE PAYMENT METHOD FOR ALL ORDERS AT ONCE - WHOLE TABLE PAYMENT
// this is just for payment method update
const updateMultipleOrdersPayment = asyncHandler(async (req, res) => {
  const { ordersIds, paymentMethod, ordersTotalNetPrice } = req.body;

  if (paymentMethod && Array.isArray(paymentMethod)) {
    let validPaymentMethods = validatePaymentMethodArray(paymentMethod);
    if (typeof validPaymentMethods !== "array") {
      let totalNetPricePayed = validPaymentMethods.reduce(
        (acc, payment) => payment.paymentMethodAmount + acc,
        0
      );

      if (totalNetPricePayed >= ordersTotalNetPrice) {
        let totalTips = totalNetPricePayed - ordersTotalNetPrice;
        let updatedOrders = [];
        // update each order with the payment method
        for (let orderId of ordersIds) {
          // check if order exists
          const order = await Order.findById(orderId);
          if (!order) {
            return res.status(404).json({ message: "Order not found!" });
          }

          // create the update object
          let update = {};

          // create the payment method object
          let orderPaymentMethod = [];

          // check if the order is open
          if (order.billingStatus === "Open") {
            let remainingOrderPrice = order.orderNetPrice;

            // loop through all valid payment methods
            for (let i = 0; i < validPaymentMethods.length; i++) {
              // if the payment method can cover the remaining order price
              if (
                validPaymentMethods[i].paymentMethodAmount >=
                remainingOrderPrice
              ) {
                let newPaymentMethodObj = createPaymentMethodObject(
                  validPaymentMethods[i],
                  remainingOrderPrice
                );
                orderPaymentMethod.push(newPaymentMethodObj);
                validPaymentMethods[i].paymentMethodAmount -=
                  remainingOrderPrice;
                remainingOrderPrice = 0;
                break;
              } else {
                // if the payment method can't cover the remaining order price
                if (validPaymentMethods[i].paymentMethodAmount > 0) {
                  let newPaymentMethodObj = createPaymentMethodObject(
                    validPaymentMethods[i],
                    validPaymentMethods[i].paymentMethodAmount
                  );
                  orderPaymentMethod.push(newPaymentMethodObj);
                  remainingOrderPrice -=
                    validPaymentMethods[i].paymentMethodAmount;
                  validPaymentMethods[i].paymentMethodAmount = 0;
                }
              }
            }

            if (remainingOrderPrice === 0) {
              update.paymentMethod = orderPaymentMethod;
              update.billingStatus = "Paid";
              update.orderStatus = "Done";
            }
          }

          // if last order and total tips is higher than 0, add the remaining money as tips
          if (totalTips > 0 && orderId === ordersIds[ordersIds.length - 1]) {
            update.orderTips = totalTips;
          }

          // update the order
          const updatedOrder = await updateMultipleOrders(orderId, update);

          if (updatedOrder) {
            updatedOrders.push(updatedOrder);
          } else {
            return res.status(500).json({ message: "Order update failed!" });
          }
        }
        // After all orders are updated, send the response
        return res.json({
          message: "Orders updated successfully!",
        });
      } else {
        return res.status(400).json({
          message:
            "Total amount paid is lower than the total price of the orders!",
        });
      }
    } else {
      return res.status(400).json({ message: validPaymentMethods });
    }
  } else {
    return res.status(400).json({ message: "Invalid paymentMethod array!" });
  }
});

function createPaymentMethodObject(paymentMethod, orderNetPrice) {
  let newPaymentMethodObj = {};
  newPaymentMethodObj.method = paymentMethod.method;
  switch (paymentMethod.method) {
    case "Card":
      newPaymentMethodObj.card = paymentMethod.card;
      break;
    case "Crypto":
      newPaymentMethodObj.crypto = paymentMethod.crypto;
      break;
    case "Other":
      newPaymentMethodObj.other = paymentMethod.other;
      break;
    case "Cash":
      break;
    default:
      throw new Error("Invalid payment method");
  }
  newPaymentMethodObj.paymentMethodAmount = orderNetPrice;
  return newPaymentMethodObj;
}

async function updateMultipleOrders(orderId, update) {
  return await Order.findOneAndUpdate({ _id: orderId }, update, {
    new: true,
    useFindAndModify: false,
  });
}

// delete a order shouldnt be allowed for data integrity and historical purposes
// the only case where a order should be deleted is if the business itself is deleted
// or if the order was created by mistake and has billing status "Cancelled"
// @desc    Delete order by ID
// @route   DELETE /orders/:id
// @access  Private
const deleteOrder = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const order = await Order.findById(id);

  if (!order) {
    return res.status(404).json({ message: "Order not found!" });
  }

  // delete the order id reference from table
  await Table.updateMany({ _id: order.table }, { $pull: { orders: id } });

  // delete the order
  await Order.deleteOne({ _id: id });
  res.json({ message: "Order deleted successfully!" });
});

// export controller functions
module.exports = {
  getOrders,
  getOrderById,
  getOrdersByTableId,
  createOrder,
  updateMultipleOrdersPayment,
  updateOrder,
  deleteOrder,
};
