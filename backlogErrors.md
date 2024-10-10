business - review again

salesPoint - read for testing
  
users - DONE
dailySalesReports - DONE

salesInstance - DONE - review again - used to be salesLocation

printers - review again
schedules - DONE
suppliers - DONE
supplierGoods - DONE
businessGoods - DONE
promotions - DONE

*** BEFORE START ORDERS
- separate businessSalesLocation from the business, simple responsability principle, separate route/model, review all realtion code
  
orders

purchaeses
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