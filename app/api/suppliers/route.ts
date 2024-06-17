const asyncHandler = require("express-async-handler");
const Supplier = require("../models/Supplier");
const SupplierGood = require("../models/SupplierGood");

// @desc    Get all suppliers
// @route   GET /supplier
// @access  Private
const getSuppliers = asyncHandler(async (req, res) => {
  const suppliers = await Supplier.find()
    .populate("supplierGoods", "name category currentlyInUse")
    .lean();

  return !suppliers.length
    ? res.status(404).json({ message: "No suppliers found!" })
    : res.json(suppliers);
});

// @desc    Get supplier by ID
// @route   GET /supplier/:id
// @access  Private
const getSupplierById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const supplier = await Supplier.findById(id)
    .populate("supplierGoods", "name category currentlyInUse")
    .lean();

  return !supplier
    ? res.status(404).json({ message: "No suppliers found!" })
    : res.json(supplier);
});

// @desc   Get supplier by business ID
// @route  GET /supplier/business/:id
// @access Private
const getSupplierByBusinessId = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const suppliers = await Supplier.find({ business: id })
    .populate("supplierGoods", "name category currentlyInUse")
    .lean();

  return !suppliers.length
    ? res.status(404).json({ message: "No suppliers found!" })
    : res.json(suppliers);
});

const addressValidation = (address) => {
  // const address = {
  //   country: "Spain",
  //   state: "Barcelona",
  //   city: "Barcelona",
  //   street: "Carrer Mallorca",
  //   buildingNumber: 587,
  //   postCode: "08026"
  // }

  // check address is an object
  if (typeof address !== "object") return "Address has to be an object";

  // required fields
  const requiredFields = [
    "country",
    "state",
    "city",
    "street",
    "buildingNumber",
    "postCode",
  ];

  // check required fields
  const validAddress = requiredFields.every((field) => {
    return address.hasOwnProperty(field) && address[field] !== undefined;
  });

  return validAddress ? true : "Invalid address object fields";
};

// @desc    Create new supplier
// @route   POST /supplier
// @access  Private
// create a new supplier without supplier goods
// supplier goods can be added later on update
const createNewSupplier = asyncHandler(async (req, res) => {
  const {
    tradeName,
    legalName,
    email,
    phoneNumber,
    taxNumber,
    currentlyInUse,
    business,
    address,
    contactPerson,
  } = req.body;

  // check required fields
  if (
    !tradeName ||
    !legalName ||
    !email ||
    !phoneNumber ||
    !taxNumber ||
    currentlyInUse === undefined ||
    !business
  ) {
    return res.status(400).json({
      message:
        "TradeName, legalName, email, phoneNumber, taxNumber, currentlyInUse and business are required!",
    });
  }

  // check for duplicate legalName, email or taxNumber
  const duplicateSupplier = await Supplier.findOne({
    business: business,
    $or: [{ legalName }, { email }, { taxNumber }],
  });

  if (duplicateSupplier) {
    return res.status(409).json({
      message: `Supplier ${legalName}, ${email} or ${taxNumber} already exists!`,
    });
  }

  // create supplier object with required fields
  const supplierObj = {
    tradeName,
    legalName,
    email,
    phoneNumber,
    taxNumber,
    currentlyInUse,
    business,
    contactPerson: contactPerson || undefined,
  };

  // validate address fields
  const validAddress = addressValidation(address);
  if (validAddress !== true) {
    supplierObj.address = address;
  } else {
    return res.status(400).json({ message: validAddress });
  }

  // create new supplier
  const newSupplier = await Supplier.create(supplierObj);

  // confirm supplier was created
  return newSupplier
    ? res.status(201).json({
        message: `Supplier ${legalName} created successfully!`,
      })
    : res.status(500).json({ message: "Supplier creation failed!" });
});

// @desc    Update supplier
// @route   PATCH /supplier/:id
// @access  Private
const updateSupplier = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    tradeName,
    legalName,
    email,
    phoneNumber,
    taxNumber,
    currentlyInUse,
    address,
    contactPerson,
    supplierGoods,
  } = req.body;

  // check if supplier exists
  const supplier = await Supplier.findById(id).lean();
  if (!supplier) {
    return res.status(404).json({ message: "Supplier not found!" });
  }

  // check for duplicate legalName, email or taxNumber
  const duplicateSupplier = await Supplier.findOne({
    _id: { $ne: id },
    business: supplier.business,
    $or: [{ legalName }, { email }, { taxNumber }],
  });

  if (duplicateSupplier) {
    return res.status(409).json({
      message: `Business ${legalName}, ${email} or ${taxNumber} already exists in the business!`,
    });
  }

  // prepare update object
  const updateObj = {
    tradeName: tradeName || supplier.tradeName,
    legalName: legalName || supplier.legalName,
    email: email || supplier.email,
    phoneNumber: phoneNumber || supplier.phoneNumber,
    taxNumber: taxNumber || supplier.taxNumber,
    currentlyInUse: currentlyInUse || supplier.currentlyInUse,
    contactPerson: contactPerson || supplier.contactPerson,
    // supplierGoods is an array of supplier goods ids coming fron the front
    supplierGoods: supplierGoods || supplier.supplierGoods,
  };

  // validate address fields
  if (address) {
    const validAddress = addressValidation(address);
    if (validAddress !== true) {
      updateObj.address = address;
    } else {
      return res.status(400).json({ message: validAddress });
    }
  }

  // Save the updated supplier
  const updatedSupplier = await supplier.findByIdAndUpdate(
    { _id: id },
    updateObj,
    { new: true, usefindAndModify: false }
  ).lean();

  return updatedSupplier
    ? res.status(200).json({
        message: `Supplier ${updatedSupplier.legalName} updated successfully!`,
      })
    : res.status(500).json({ message: "Failed to update supplier!" });
});

// delete a supplier shouldnt be allowed for data integrity, historical purposes and analytics
// the only case where a supplier should be deleted is if the business itself is deleted
// but in case you want to delete a supplier you can use the following code
// be aware that this will remove the supplier from the database and all the supplier goods reference will be lost
// @desc    Delete supplier
// @route   DELETE /supplier/:id
// @access  Private
const deleteSupplier = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const supplier = await Supplier.findById(id).lean();
  if (!supplier) {
    return res.status(404).json({ message: "Supplier not found!" });
  }

  // remove the supplier reference from all supplier goods
  await SupplierGood.updateMany({ supplier: id }, { $unset: { supplier: "" } });

  // delete the supplier
  await Supplier.deleteOne({ _id: id });

  res.json({
    message: `Supplier with tax number ${supplier.taxNumber} deleted successfully!`,
  });
});

// export controller functions
module.exports = {
  getSuppliers,
  getSupplierById,
  getSupplierByBusinessId,
  createNewSupplier,
  updateSupplier,
  deleteSupplier,
};
