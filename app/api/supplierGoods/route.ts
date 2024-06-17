const asyncHandler = require("express-async-handler");

// import models
const SupplierGood = require("../models/SupplierGood");
const BusinessGood = require("../models/BusinessGood");
const Inventory = require("../models/Inventory");

// @desc    Get all supplier goods
// @route   GET /supplierGoods
// @access  Private
const getSupplierGoods = asyncHandler(async (req, res) => {
  const supplierGoods = await SupplierGood.find()
    .populate("supplier", "tradeName")
    .lean();

  return !supplierGoods.length
    ? res.status(404).json({ message: "No supplier goods found!" })
    : res.json(supplierGoods);
});

// @desc    Get supplier good by ID
// @route   GET /supplierGoods/:id
// @access  Private
const getSupplierGoodById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const supplierGood = await SupplierGood.findById(id)
    .populate("supplier", "tradeName")
    .lean();

  return !supplierGood
    ? res.status(404).json({ message: "Supplier good not found!" })
    : res.json(supplierGood);
});

// @desc    Get supplier goods by supplier ID
// @route   GET /supplierGoods/supplier/:id
// @access  Private
const getSupplierGoodsBySupplierId = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const supplierGoods = await SupplierGood.find({ supplier: id }).lean();

  return !supplierGoods.length
    ? res.status(404).json({ message: "No supplier goods found!" })
    : res.json(supplierGoods);
});

// update dynamicCountFromLastInventory base on inventory.currentCountQuantity
// every time the inventory is counted, the new currentCountQuantity will be the new dynamicCountFromLastInventory
const updateDynamicCountFromLastInventory = async (
  supplierGoodId,
  currentCountQuantity
) => {
  const updatedSupplierGood = await SupplierGood.findByIdAndUpdate(
    supplierGoodId,
    { dynamicCountFromLastInventory: currentCountQuantity },
    { new: true, useFindAndModify: false }
  ).lean();

  if (!updatedSupplierGood) {
    return "Supplier good not found!";
  }

  return "Supplier good dynamicCountFromLastInventory updated successfully!";
};

// @desc    Create new supplier good
// @route   POST /supplierGoods
// @access  Private
const createNewSupplierGood = asyncHandler(async (req, res) => {
  const {
    name,
    keyword,
    category,
    subcategory,
    currentlyInUse,
    supplier,
    business,
    description,
    allergens,
    budgetImpact,
    image,
    saleUnit,
    wholeSalePrice,
    measurementUnit,
    totalQuantityPerUnit,
    parLevel,
    minimumQuantityRequired,
    inventorySchedule,
    dynamicCountFromLastInventory,
  } = req.body;

  // check required fields
  if (
    !name ||
    !keyword ||
    !category ||
    !subcategory ||
    currentlyInUse === undefined ||
    !supplier ||
    !business
  ) {
    return res.status(400).json({
      message:
        "Name, keyword, category, subcategory, currentlyInUse, supplier and business are required!",
    });
  }

  // check if the supplier good already exists
  const duplicateSupplierGood = await SupplierGood.findOne({
    business,
    name,
  });
  if (duplicateSupplierGood) {
    return res
      .status(400)
      .json({ message: `${name} already exists on supplier goods!` });
  }

  // Create a supplier good object with required fields
  const supplierGoodObj = {
    name,
    keyword,
    category,
    subcategory,
    currentlyInUse,
    supplier,
    business,
    description: description || undefined,
    allergens: allergens || undefined,
    budgetImpact: budgetImpact || undefined,
    image: image || undefined,
    saleUnit: saleUnit || undefined,
    wholeSalePrice: wholeSalePrice || undefined,
    measurementUnit: measurementUnit || undefined,
    totalQuantityPerUnit: totalQuantityPerUnit || undefined,
    pricePerUnit:
      wholeSalePrice && totalQuantityPerUnit
        ? wholeSalePrice / totalQuantityPerUnit
        : undefined,
    parLevel: parLevel || undefined,
    minimumQuantityRequired: minimumQuantityRequired || undefined,
    inventorySchedule: inventorySchedule || undefined,
    // upon creation, the dynamicCountFromLastInventory is the current quantity purchased from the supplier
    // its required if business is to start using the inventory module
    // IMPORTANT *** THAT NUMBER IS THE START POINT FOR THE INVENTORY COUNT
    dynamicCountFromLastInventory: dynamicCountFromLastInventory || undefined,
  };

  // create a new supplier good
  const supplierGood = await SupplierGood.create(supplierGoodObj);

  // confirm supplier good was created
  return supplierGood
    ? res
        .status(201)
        .json({ message: `Supplier good ${name} created successfully!` })
    : res.status(500).json({ message: "Failed to create supplier good!" });
});

// @desc    Update supplier good by ID
// @route   PUT /supplierGoods/:id
// @access  Private
const updateSupplierGood = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    name,
    keyword,
    category,
    subcategory,
    currentlyInUse,
    supplier,
    description,
    allergens,
    budgetImpact,
    image,
    saleUnit,
    wholeSalePrice,
    measurementUnit,
    parLevel,
    minimumQuantityRequired,
    totalQuantityPerUnit,
    dynamicCountFromLastInventory,
  } = req.body;

  // check if the supplier good exists
  const supplierGood = await SupplierGood.findById(id).lean();
  if (!supplierGood) {
    return res.status(404).json({ message: "Supplier good not found!" });
  }

  // check for duplicates supplier good name
  const duplicateSupplierGood = await SupplierGood.findOne({
    _id: { $ne: id },
    business: supplierGood.business,
    name,
    supplier,
  });

  if (duplicateSupplierGood) {
    return res.status(409).json({
      message: `Supplier good ${name} already exists on this supplier!`,
    });
  }

  // prepare update object
  const updateObj = {
    name: name || supplierGood.name,
    keyword: keyword || supplierGood.keyword,
    category: category || supplierGood.category,
    subcategory: subcategory || supplierGood.subcategory,
    currentlyInUse: currentlyInUse || supplierGood.currentlyInUse,
    supplier: supplier || supplierGood.supplier,
    description: description || supplierGood.description,
    allergens: allergens || supplierGood.allergens,
    budgetImpact: budgetImpact || supplierGood.budgetImpact,
    image: image || supplierGood.image,
    saleUnit: saleUnit || supplierGood.saleUnit,
    wholeSalePrice: wholeSalePrice || supplierGood.wholeSalePrice,
    measurementUnit: measurementUnit || supplierGood.measurementUnit,
    totalQuantityPerUnit:
      totalQuantityPerUnit || supplierGood.totalQuantityPerUnit,
    pricePerUnit:
      wholeSalePrice && totalQuantityPerUnit
        ? wholeSalePrice / totalQuantityPerUnit
        : undefined,
    parLevel: parLevel || supplierGood.parLevel,
    minimumQuantityRequired: minimumQuantityRequired || supplierGood.minimumQuantityRequired,
    inventorySchedule: inventorySchedule || supplierGood.inventorySchedule,
    // IMPORTANT *** dynamicCountFromLastInventory is the start point of the inventory count
    // UPDATE BY ITSELF
    // Should be add upon creation of the supplier good if the business is wants to use the inventory module
    // Can be updated to a new value if the business didnt use the inventory module but decided to start using it
    // Not supose to be updated manualy unless is one of the cases above
    // UPDATED BY ORDER CONTROLLER
    // Its value will decrease base on the supplier good that orders are made from
    // it wont affect the inventory count till the inventory is counted
    // UPDATED BY INVENTORY CONTROLLER
    // Every time the inventory is counted, new value of supplierGood.dynamicCountFromLastInventory will be equatl to the current inventory.currentCountQuantity
    dynamicCountFromLastInventory:
      dynamicCountFromLastInventory ||
      supplierGood.dynamicCountFromLastInventory,
  };

  // updated supplier good
  const updatedSupplierGood = await supplierGood
    .findByIdAndUpdate({ _id: id }, updateObj, {
      new: true,
      usefindAndModify: false,
    })
    .lean();

  return updatedSupplierGood
    ? res.json({
        message: `Supplier good ${updatedSupplierGood.name} updated successfully!`,
      })
    : res.status(500).json({ message: "Failed to update supplier good!" });
});

// delete a supplier goods shouldnt be allowed for data integrity, historical purposes and analytics
// the only case where a supplier goods should be deleted is if the business itself is deleted
// but in case you want to delete a supplier good you can use the following code
// be aware that this will remove the supplier good from the database and all the business goods reference will be lost
// @desc    Delete supplier good by ID
// @route   DELETE /supplierGoods/:id
// @access  Private
const deleteSupplierGood = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const supplierGood = await SupplierGood.findById(id).lean();

  if (!supplierGood) {
    return res.status(404).json({ message: "Supplier good not found!" });
  }

  // check if the supplier good is used in any business goods
  const businessGoodsUsingSupplierGood = await BusinessGood.find({
    ingredients: { $elemMatch: { ingredient: id } },
  })
    .select("name")
    .lean();

  if (businessGoodsUsingSupplierGood.length) {
    return res.status(409).json({
      message: `Supplier good ${
        supplierGood.name
      } is used in the following business goods: ${businessGoodsUsingSupplierGood
        .map((good) => good.name)
        .join(
          ", "
        )}. Please remove it from the business goods before deleting it!`,
    });
  }

  // remove the supplier good property from all inventory goods
  await Inventory.updateMany(
    { "inventoryGoods.supplierGood": id },
    { $unset: { "inventoryGoods.$.supplierGood": "" } }
  );

  // delete the supplier good
  await SupplierGood.deleteOne({ _id: id });

  res.json({
    message: `Supplier good ${supplierGood.name} deleted successfully!`,
  });
});

// export controller functions
module.exports = {
  getSupplierGoods,
  getSupplierGoodById,
  getSupplierGoodsBySupplierId,
  updateDynamicCountFromLastInventory,
  createNewSupplierGood,
  updateSupplierGood,
  deleteSupplierGood,
};
