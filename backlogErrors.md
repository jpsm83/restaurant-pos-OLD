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
orders - DONE
purchases - DONE

inventories
- updateCountFromSupplierGood have to be tested and numbers check
- need to review utils
- rest is done and checked
- updateDynamicCountSupplierGood been teste OK

notifications - find out all notifications scenario and update notification routes
monthlyBusinessReport
cloudinaryActions

- daily saler report have to be tested once we got all the models tested and with data
- transform cloudinaryActions route to be a function to be used in all the creations that could have images
- -check if all findByIdAndUpdate is done with $set
- when a salesInstance is created with qrCode, update the qrLastScanned of the salesPoint
- add collor themes for the types of businessGoods (or photo)
- if a supplier good no in use get to be use, it have to be add to the inventory