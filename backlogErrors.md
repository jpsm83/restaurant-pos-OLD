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



- supplierGoods DELETE - must await data from businessGoods for a full testing
- dailySalesReport helper function updateUserDailySalesReportGeneric been tested and it is working BUT, NEED all the controllers tested and with data to be real tested