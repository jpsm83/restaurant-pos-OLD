business - DONE
salesPoint - DONE
users - DONE
dailySalesReports - DONE
salesInstance - DONE
printers - DONE
schedules - DONE
suppliers - DONE
supplierGoods - DONE
businessGoods - DONE
promotions - DONE
  
orders - get all/post done and tested
-transferOrderBetweenSalesInstances are not correct, i might loose the original orderCode when transfering
- refact the whole routing, every action (cancel, update, transfer) supose to be done in a bulk of order. inside the orders.salesInstance[salesInstanceId]

purchases
inventories
notifications
cloudinaryActions

- find out all notifications scenario and update notification routes

*****************************************************************************
- tableReference from the preview table "table", now been rename
table is salesLocation
tableReference is salesLocationReference
on business model, salesLocation is not an array of strings as used to be
now is an array of objects
this will cause errors if code is not update
*****************************************************************************

- daily saler report have to be tested once we got all the models tested and with data
- transform cloudinaryActions route to be a function to be used in all the creations that could have images
- -check if all findByIdAndUpdate is done with $set
- when a salesInstance is created with qrCode, update the qrLastScanned of the salesPoint
- test updateDynamicCountSupplierGood when inventory is refactored / it has no errors but need to check on the whole app