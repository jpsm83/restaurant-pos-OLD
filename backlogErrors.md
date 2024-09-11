- update all POST and PATCH with the siyntax of PURCHASE routes, it is more efficienty, less DB calls

- for the future, everything name with "table" supose to be rename because we dont create tables, we creata "salesLocation" - ex ITable / model table / createTable

- find out all notifications scenario and update notification routes

*****************************************************************************
- tableReference from the preview table "table", now been rename
table is salesLocation
tableReference is salesLocationReference
on business model, salesLocation is not an array of strings as used to be
now is an array of objects
this will cause errors if code is not update
*****************************************************************************
