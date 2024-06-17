const asyncHandler = require("express-async-handler");

const {
  createDailySalesReport,
  addUserToDailySalesReport,
} = require("./dailySalesReportsController");

// import models
const Business = require("../models/Business");
const Table = require("../models/Table");
const Order = require("../models/Order");
const DailySalesReport = require("../models/DailySalesReport");

// @desc    Get all tables
// @route   GET /tables
// @access  Private
const getTables = asyncHandler(async (req, res) => {
  const tables = await Table.find()
    .populate("openedBy", "username currentShiftRole")
    .populate("responsibleBy", "username currentShiftRole")
    .populate("closedBy", "username currentShiftRole")
    .populate({
      path: "orders",
      select:
        "billingStatus orderStatus orderPrice orderNetPrice paymentMethod allergens promotionApplyed discountPercentage createdAt",
      populate: {
        path: "businessGoods",
        select: "name category subCategory allergens sellingPrice",
      },
    })
    .lean();

  return !tables?.length
    ? res.status(404).json({ message: "No tables found!" })
    : res.json(tables);
});

// @desc    Get tables by ID
// @route   GET /tables/:id
// @access  Private
const getTableById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const tables = await Table.findById(id)
    .populate("openedBy", "username currentShiftRole")
    .populate("responsibleBy", "username currentShiftRole")
    .populate("closedBy", "username currentShiftRole")
    .populate({
      path: "orders",
      select:
        "billingStatus orderStatus orderPrice orderNetPrice paymentMethod allergens promotionApplyed discountPercentage createdAt",
      populate: {
        path: "businessGoods",
        select: "name category subCategory allergens sellingPrice",
      },
    })
    .lean();

  return !tables
    ? res.status(404).json({ message: "Table not found!" })
    : res.json(tables);
});

// @desc   Get tables by bussiness ID
// @route  GET /tables/business/:id
// @access Private
const getTablesByBusinessId = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const tables = await Table.find({ business: id })
    .populate("openedBy", "username currentShiftRole")
    .populate("responsibleBy", "username currentShiftRole")
    .populate("closedBy", "username currentShiftRole")
    .populate({
      path: "orders",
      select:
        "billingStatus orderStatus orderPrice orderNetPrice paymentMethod allergens promotionApplyed discountPercentage createdAt",
      populate: {
        path: "businessGoods",
        select: "name category subCategory allergens sellingPrice",
      },
    })
    .lean();

  return !tables.lengt
    ? res.status(404).json({ message: "No tables found!" })
    : res.json(tables);
});

// @desc   Get tables by user ID
// @route  GET /tables/user/:id
// @access Private
const getTablesByUserId = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const tables = await Table.find({ responsibleBy: id })
    .populate("openedBy", "username currentShiftRole")
    .populate("closedBy", "username currentShiftRole")
    .populate({
      path: "orders",
      select:
        "billingStatus orderStatus orderPrice orderNetPrice paymentMethod allergens promotionApplyed discountPercentage createdAt",
      populate: {
        path: "businessGoods",
        select: "name category subCategory allergens sellingPrice",
      },
    })
    .lean();

  return !tables.length
    ? res.status(404).json({ message: "No tables found!" })
    : res.json(tables);
});

const assignDayReferenceNumber = async (business) => {
  /* VERY IMPORTANT:
  to keep the responsibilities of each controller separate to maintain a clean and organized codebase as part of SINGLE RESPONSABILITY PRINCIPLE, which is a core concept in object-oriented programming and design. Table controller is responsable to create a daily report in case it doesnt exist, so we need to import the createDailySalesReport function to create a daily report if it doesnt exist. */
  const newDayReferenceNumber = await createDailySalesReport(business);

  return newDayReferenceNumber.dayReferenceNumber;
};

// first create a empty table, then update it with the orders
// @desc    Create new tables
// @route   TABLET /tables
// @access  Private
const createTable = asyncHandler(async (req, res) => {
  const {
    dayReferenceNumber,
    tableReference,
    guests,
    status,
    openedBy,
    responsibleBy,
    business,
    clientName,
  } = req.body;

  // check required fields
  if (
    !tableReference ||
    !guests ||
    !status ||
    !openedBy ||
    !responsibleBy ||
    !business
  ) {
    return res.status(400).json({
      message:
        "TableReference, guest, status, openedBy, responsibleBy and business are required!",
    });
  }

  // create a tables object with required fields
  const tableObj = {
    guests,
    status,
    openedBy,
    responsibleBy,
    business,
    clientName: clientName || undefined,
  };

  // check if tableReference exists in the business
  const validateTableReference = await Business.findOne({
    _id: business,
    businessTables: { $in: [tableReference] },
  });

  // check if tableReference exists in the business (pre set tables that can be used)
  if (!validateTableReference) {
    return res
      .status(400)
      .json({ message: "TableReference does not exist in this business!" });
  } else {
    tableObj.tableReference = tableReference;
  }

  // check if there is a daily report for the day already created
  const currentDateNoTime = new Date();
  currentDateNoTime.setHours(0, 0, 0, 0);
  const currentDateUnix = currentDateNoTime.getTime();

  const dailySalesReport = await DailySalesReport.findOne({
    dayReferenceNumber: currentDateUnix,
    business,
  })
    .select("dayReferenceNumber")
    .lean();

  tableObj.dayReferenceNumber = dailySalesReport
    ? dailySalesReport.dayReferenceNumber
    : await assignDayReferenceNumber(business);

  // check if tables already exists and it is not closed
  const duplicateTable = await Table.findOne({
    dayReferenceNumber: tableObj.dayReferenceNumber,
    business,
    tableReference,
    status: { $ne: "Closed" },
  })
    .select("_id")
    .lean();

  if (duplicateTable) {
    return res.status(409).json({
      message: `Table ${tableReference} already exists and it is not closed!`,
    });
  }

  // check if user exists in the dailySalesReport
  const userDailySalesReport = await DailySalesReport.findOne({
    dayReferenceNumber: tableObj.dayReferenceNumber,
    business,
    "userDailySalesReportArray.user": openedBy,
  }).lean();

 // if user does not exist in the dailySalesReport, create it
  if (!userDailySalesReport) {
    await addUserToDailySalesReport(openedBy, tableObj.dayReferenceNumber, tableObj.business)
  }

  // create the table
  const table = await Table.create(tableObj);

  // confirm table was created
  return table
    ? res.status(201).json({
        message: `Table ${tableReference} created successfully!`,
      })
    : res.status(500).json({ message: "Table creation failed!" });
});

// @desc    Update tables
// @route   PATCH /tables/:id
// @access  Private
const updateTable = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    tableReference,
    guests,
    status,
    responsibleBy,
    clientName,
    tableTotalPrice,
    tableTotalNetPaid,
    tableTotalTips,
    orders,
    closedBy,
  } = req.body;

  // check if table exists
  const table = await Table.findById(id).lean();
  if (!table) {
    return res.status(404).json({ message: "Table not found!" });
  }

  // prepare the tableObj to update
  let updateObj = {
    guests: guests || table.guests,
    status: status || table.status,
    responsibleBy: responsibleBy || table.responsibleBy,
    clientName: clientName || table.clientName,
    tableTotalPrice: tableTotalPrice || table.tableTotalPrice,
    tableTotalNetPaid: tableTotalNetPaid || table.tableTotalNetPaid,
    tableTotalTips: tableTotalTips || table.tableTotalTips,
    closedBy: closedBy || table.closedBy,
  };

  // check if tableReference exists in the business
  if (tableReference) {
    const validateTableReference = await Business.findOne({
      _id: business,
      businessTables: { $in: [tableReference] },
    });

    if (!validateTableReference) {
      return res
        .status(400)
        .json({ message: "TableReference does not exist in this business!" });
    } else {
      updateObj.tableReference = tableReference;
    }

    // check for duplicates open table at the same day
    const duplicateTable = await Table.findOne({
      _id: { $ne: id },
      dayReferenceNumber: table.dayReferenceNumber,
      business: table.business,
      tableReference,
      status: { $ne: "Closed" },
    }).lean();
    if (duplicateTable) {
      return res.status(409).json({
        message: `Table ${tableReference} already exists and it is not closed!`,
      });
    }
  }
  // The order controller would handle the creation of orders and updating the relevant table's order array. The table controller would then only be responsible for reading and managing table data, not order data. This separation of concerns makes the code easier to maintain and understand.

  // if table is transferred to another user, update the dailySalesReport
  if (responsibleBy && responsibleBy !== table.openedBy) {
    // check if user exists in the dailySalesReport
    const userDailySalesReport = await DailySalesReport.findOne({
      dayReferenceNumber: table.dayReferenceNumber,
      business: table.business,
      "userDailySalesReportArray.user": responsibleBy,
    }).lean();
  
   // if user does not exist in the dailySalesReport, create it
    if (!userDailySalesReport) {
      await addUserToDailySalesReport(responsibleBy, table.dayReferenceNumber, table.business)
    }
  }

  // if no open orders and closeBy exists, close the table
  if (table.orders && table.orders.length > 0) {
    const openOrders = await Order.find({
      table: table.id,
      billingStatus: "Open",
    }).lean();
    if (openOrders.length === 0) {
      if (closedBy) {
        updateObj.status = "Closed";
        updateObj.closedAt = new Date();
        updateObj.closedBy = closedBy;
        tableHasClosed = true;
      } else {
        return res
          .status(400)
          .json({ message: "Closed by is required to close a Table!" });
      }
    }
  }

  // if table is occupied and no orders, delete the table
  if (table.status === "Occupied" && !orders) {
    await table.deleteOne();
    return res
      .status(200)
      .json({ message: "Occupied table with no orders been deleted!" });
  }

  // save the updated table
  const updatedTable = await Table.findOneAndUpdate({ _id: id }, updateObj, {
    new: true,
    useFindAndModify: false,
  });

  return updatedTable
    ? res.status(200).json({
        message: `Table ${updatedTable.tableReference} updated successfully!`,
      })
    : res.status(500).json({ message: "Table update failed!" });
});

// delete a table shouldnt be allowed for data integrity, historical purposes and analytics
// the only case where a table should be deleted is if the business itself is deleted
// or if the table was created by mistake and it has no orders
// @desc    Delete table
// @route   DELETE /table/:id
// @access  Private
const deleteTable = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const table = await Table.findById(id).lean();

  if (!table) {
    return res.status(404).json({ message: "Table not found!" });
  }

  // do not allow delete if table has open orders
  if (table.orders && table.orders.length > 0) {
    const orders = await Order.find({ _id: { $in: table.orders } }).lean();
    const hasOpenOrders = orders.some(
      (order) => order.billingStatus === "Open"
    );

    if (hasOpenOrders) {
      return res
        .status(400)
        .json({ message: "Cannot delete TABLE with open orders!" });
    }
  }

  // delete the table
  await Table.deleteOne({ _id: id });

  res.json({
    message: `Table ${table.tableReference} deleted successfully!`,
  });
});

// export controller functions
module.exports = {
  getTables,
  getTableById,
  getTablesByBusinessId,
  getTablesByUserId,
  createTable,
  updateTable,
  deleteTable,
};
