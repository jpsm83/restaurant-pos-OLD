- business DELETE, supplierGood and businessGood causing error
- supplier DELETE, supplierGood causing error
- printer all GETs, they are not populating the user from printFor.user
- promotion all GETs, they are not populating the businessGood from businessGoodsToApply array
- notification UTILS, removeUserFromNotification.ts has to be tested somehow
- schedule all GETs, they are not populating the employees - that is because employees doesnt exists yet or is an empty array
- table all GETs, populate doesnt work
- dailySalesReport all GETs, populate doesnt work on user
- dailySalesReport helper function closeDailySalesReport MUST be review - error - "Failed to update daily sales report! TypeError: Reduce of empty array with no initial value" / "Failed to update daily sales report! TypeError: sale.forEach is not a function"
- supplierGoods all GETs, populate supplier tradename error
- supplierGoods, create a helper function in case of delete supplier good, all the business goods have to update their ingredients and calculate the cost price
- businessGoods DELETE, must wait to get ORDERS to full test
- orders all GETs, all get with populate user doesnt work
- after first orders, chance table status to occupied if it is not so


- supplierGoods DELETE - must await data from businessGoods for a full testing
- dailySalesReport helper function updateUserDailySalesReportGeneric been tested and it is working BUT, NEED all the controllers tested and with data to be real tested




what to do in case supplier get delete
    what happens with the supplier goods
    what happens with the business goods that use supplier goods