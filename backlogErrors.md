- refact all the code and change all the references names adding "Id" to its end in all models and logic / follow the order
business - DONE
users - reference routes to be tested, all the rest tested OK
salesLocation
printers
schedules
suppliers
supplierGoods
businessGoods
promotions
orders
purchaeses
inventories
dailySalesReports
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
