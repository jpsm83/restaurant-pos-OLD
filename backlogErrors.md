business - DONE
users - DONE
salesLocation
printers - DONE / create printers with users and sales location
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

 {
    "username": "user1",
    "email": "user1email@user1.com",
    "password": "user1Password",
    "idType": "National ID",
    "idNumber": "user1IdNumber",
    "allUserRoles": ["Manager", "Bartender"],
    "personalDetails": {
        "firstName": "user1FirstName",
        "lastName": "user1LastName",
        "email": "user1Email@user1Email.com",
        "nationality": "user1Nationality",
        "gender": "Man",
        "birthDate": "2014-10-10T14:48:00.000Z",
        "phoneNumber": "user1PhoneNumber"
    },
    "taxNumber": "user1TaxNumber",
    "joinDate": "2024-06-10T14:48:00.000Z",
    "business": "66e169a709901431386c97cbb",
    "contractHoursWeek": 40
  }
