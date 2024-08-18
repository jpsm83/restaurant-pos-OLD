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