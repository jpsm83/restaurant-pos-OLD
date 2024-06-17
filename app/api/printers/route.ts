const asyncHandler = require("express-async-handler");
const net = require("net");

// imported models
const Printer = require("../models/Printer");

// @desc    Get all printers
// @route   GET /printers
// @access  Private
const getPrinters = asyncHandler(async (req, res) => {
  const printers = await Printer.find()
    .populate("printFor.user", "username")
    .lean();

  return !printers.length
    ? res.status(404).json({ message: "No printers found!" })
    : res.json(printers);
});

// @desc    Get printer by ID
// @route   GET /printers/:id
// @access  Private
const getPrinterById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const printer = await Printer.findById(id)
    .populate("printFor.user", "username")
    .lean();

  return !printer
    ? res.status(404).json({ message: "Printer not found!" })
    : res.json(printer);
});

// @desc    Get printers by business ID
// @route   GET /printers/business/:id
// @access  Private
const getPrintersByBusinessId = asyncHandler(async (req, res) => {
  const { id } = req.params;
  // fetch printers with the given business ID
  const printers = await Printer.find({ business: id })
    .populate("printFor.user", "username")
    .lean();

  return !printers.length
    ? res.status(404).json({ message: "No printers found!" })
    : res.json(printers);
});

const checkPrinterConnection = (ipAddress, port) => {
  return new Promise((resolve, reject) => {
    const client = new net.Socket();
    client.setTimeout(1000); // Timeout after 1 second

    client.connect(port, ipAddress, function () {
      client.destroy(); // Destroy socket after successful connection
      resolve(true);
    });

    client.on("error", function (err) {
      reject(err);
    });

    client.on("timeout", function () {
      reject(new Error("Connection to printer timed out"));
    });
  });
};

// validate printFor object
const validPrintFor = (printFor, obj) => {
  if (printFor && typeof printFor !== "object") {
    let printForObj = {
      user:
        Array.isArray(printFor.user) && printFor.user.length > 0
          ? printFor.user
          : undefined,
      category:
        Array.isArray(printFor.category) && printFor.category.length > 0
          ? printFor.category
          : undefined,
      subCategory:
        Array.isArray(printFor.subCategory) && printFor.subCategory.length > 0
          ? printFor.subCategory
          : undefined,
    };
    obj.printFor = printForObj;
    return true;
  } else {
    return "PrintFor object is not valid!";
  }
};

// @desc    Create new printer
// @route   TABLEST /printers
// @access  Private
const createPrinter = asyncHandler(async (req, res) => {
  const {
    printerName,
    ipAddress,
    port,
    business,
    printFor,
    location,
    description,
  } = req.body;

  // check required fields
  if (!printerName || !ipAddress || !port || !business) {
    return res.status(400).json({
      message: "printerName, ipAddress, port and business are required fields!",
    });
  }

  //check duplicate printer
  const duplicatePrinter = await Printer.findOne({
    business,
    $or: [{ printerName }, { ipAddress }],
  });
  if (duplicatePrinter) {
    return res.status(400).json({
      message: `Printer already exists!`,
    });
  }

  // create printer object with required fields
  const printerObj = {
    printerName,
    ipAddress,
    port,
    business,
    location: location || undefined,
    description: description || undefined,
  };

  // check printer connection
  const isConnected = await checkPrinterConnection(ipAddress, port);
  printerObj.connected = isConnected !== true ? false : true;

  // validate printFor object
  const validPrintForResult = validPrintFor(printFor, printerObj);
  if (validPrintForResult !== true) {
    return res.status(400).json({
      message: validPrintForResult,
    });
  }

  // create a new printer
  const printer = await Printer.create(printerObj);

  // confirm printer was created
  return printer
    ? res
        .status(201)
        .json({ message: `Printer ${printerName} created successfully` })
    : res.status(400).json({ message: "Failed to create printer" });
});

// @desc    Update printer by ID
// @route   PUT /printers/:id
// @access  Private
const updatePrinter = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { printerName, ipAddress, port, printFor, location, description } =
    req.body;

  // fetch the printer with the given ID
  const printer = await Printer.findById(id).lean();
  if (!printer) {
    return res.status(404).json({ message: "Printer not found!" });
  }

  // check duplicate printer
  const duplicatePrinter = await Printer.findOne({
    _id: { $ne: id },
    business: printer.business,
    $or: [{ printerName }, { ipAddress }],
  });
  if (duplicatePrinter) {
    return res.status(400).json({
      message: `Printer already exists!`,
    });
  }

  // create printer object with required fields
  const updateObj = {
    printerName,
    ipAddress,
    port,
    location: location || undefined,
    description: description || undefined,
  };

  // check printer connection
  const isConnected = await checkPrinterConnection(ipAddress, port);
  updateObj.connected = isConnected !== true ? false : true;

  // validate printFor object
  const validPrintForResult = validPrintFor(printFor, updateObj);
  if (validPrintForResult !== true) {
    return res.status(400).json({
      message: validPrintForResult,
    });
  }

  // update the printer
  const updatedPrinter = await printer.findByIdAndUpdate(
    { _id: id },
    updateObj,
    { new: true, usefindAndModify: false }
  ).lean();

  return updatedPrinter
    ? res.json({
        message: `Printer ${updatedPrinter.printerName} updated successfully`,
      })
    : res.status(400).json({ message: "Failed to update printer" });
});

// @desc    Delete printer by ID
// @route   DELETE /printers/:id
// @access  Private
const deletePrinter = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // delete printer and check if it existed
  const result = await Printer.deleteOne({ _id: id });

  if (result.deletedCount === 0) {
    return res.status(404).json({ message: "Printer not found" });
  }

  res.status(200).json({ message: `Printer ${id} deleted!` });
});

// export controller functions
module.exports = {
  getPrinters,
  getPrinterById,
  getPrintersByBusinessId,
  createPrinter,
  updatePrinter,
  deletePrinter,
};
