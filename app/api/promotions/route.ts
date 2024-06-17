const asyncHandler = require("express-async-handler");

// imported models
const Promotion = require("../models/Promotion");

// when bill is printed, check if orders have a promotion base on their order time
// if they have a promotion, apply it to the order updating its price and promotionApplied field

// @desc    Get all promotion
// @route   GET /promotion
// @access  Private
const getPromotions = asyncHandler(async (req, res) => {
  const promotion = await Promotion.find()
    .populate("businessGoodsToApply", "name sellingPrice")
    .lean();

  return !promotion.length
    ? res.status(404).json({ message: "No promotion  found!" })
    : res.json(promotion);
});

// @desc    Get promotion by ID
// @route   GET /promotion/:id
// @access  Private
const getPromotionById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const promotion = await Promotion.findById(id)
    .populate("businessGoodsToApply", "name sellingPrice")
    .lean();

  return !promotion
    ? res.status(404).json({ message: "Promotion  not found!" })
    : res.json(promotion);
});

// @desc    Get promotion by business ID
// @route   GET /promotion/business/:id
// @access  Private
const getPromotionsByBusinessId = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const promotion = await Promotion.find({ business: id })
    .populate("businessGoodsToApply", "name sellingPrice")
    .lean();

  return !promotion.length
    ? res.status(404).json({ message: "No promotion  found!" })
    : res.json(promotion);
});

// @desc    Get promotion by business ID and range of time
// @route   GET /promotion/business/:id/:startDate/:endDate/:startTime/:endTime
// @access  Private
// query this function on time of order to get the promotion that applies to the order
const getPromotionsByBusinessIdAndTime = asyncHandler(async (req, res) => {
  const { id, startDate, endDate, startTime, endTime } = req.params;
  const promotion = await Promotion.find({
    business: id,
    "dateRange.startDate": { $lte: startDate },
    "dateRange.endDate": { $gte: endDate },
    "timeRange.startTime": { $lte: startTime },
    "timeRange.endTime": { $gte: endTime },
  })
    .populate("businessGoodsToApply", "name sellingPrice")
    .lean();

  return !promotion.length
    ? res.status(404).json({ message: "No promotion  found!" })
    : res.json(promotion);
});

// validate dateRange and timeRange
const validateDateAndTime = (dateRange, timeRange, obj) => {
  if (
    dateRange.hasownProperty("startDate") &&
    dateRange.hasownProperty("endDate") &&
    timeRange.hasownProperty("startTime") &&
    timeRange.hasownProperty("endTime")
  ) {
    obj.dateRange = dateRange;
    obj.timeRange = timeRange;
    return true;
  } else {
    return "Invalid dateRange or timeRange!";
  }
};

const validateDaysOfTheWeek = (weekDays, obj) => {
  const daysOfTheWeek = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];

  // validate weekDays
  if (weekDays.length > 0) {
    const allValid = weekDays.every((day) => daysOfTheWeek.includes(day));

    if (!allValid) {
      return res.status(400).json({
        message: `Invalid day(s) in the weekDays array.`,
      });
    }
    obj.weekDays = weekDays;
    return true;
  } else {
    return "Invalid weekDays!";
  }
};

// @desc    Create new promotion
// @route   POST /promotion
// @access  Private
const createPromotion = asyncHandler(async (req, res) => {
  const {
    promotionName,
    dateRange,
    timeRange,
    weekDays,
    promotionType,
    activePromotion,
    business,
    fixedPrice,
    discountPercent,
    twoForOne,
    threeForTwo,
    secondHalfPrice,
    fullComplimentary,
    businessGoodsToApply,
    description,
  } = req.body;

  // check required fields
  if (
    !promotionName ||
    !dateRange ||
    !timeRange ||
    !weekDays ||
    !promotionType ||
    activePromotion === undefined ||
    !business
  ) {
    return res.status(400).json({
      message:
        "PromotionName, dateRange, timeRange, weekDays, promotionType, activePromotion and business are required fields!",
    });
  }

  // check for duplicate promotion
  const duplicatePromotion = await Promotion.findOne({
    business,
    promotionName,
  }).lean();
  if (duplicatePromotion) {
    return res
      .status(400)
      .json({ message: `Promotion ${promotionName} already exists!` });
  }

  // create promotion object
  const promotionObj = {
    promotionName,
    promotionType,
    activePromotion,
    business,
    fixedPrice: fixedPrice || undefined,
    discountPercent: discountPercent || undefined,
    twoForOne: twoForOne || undefined,
    threeForTwo: threeForTwo || undefined,
    secondHalfPrice: secondHalfPrice || undefined,
    fullComplimentary: fullComplimentary || undefined,
    businessGoodsToApply: businessGoodsToApply || undefined,
    description: description || undefined,
  };

  // validate dateRange and timeRange
  const validateDateAndTimeResult = validateDateAndTime(
    dateRange,
    timeRange,
    promotionObj
  );
  if (validateDateAndTimeResult !== true) {
    return res.status(400).json({ message: validateDateAndTimeResult });
  }

  // validate weekDays
  const validateDaysOfTheWeekResult = validateDaysOfTheWeek(
    weekDays,
    promotionObj
  );
  if (validateDaysOfTheWeekResult !== true) {
    return res.status(400).json({ message: validateDaysOfTheWeekResult });
  }

  // create a new promotion
  const promotion = await Promotion.create(promotionObj);

  // confirm promotion was created
  return promotion
    ? res
        .status(201)
        .json({ message: `Promotion ${promotionName} created successfully!` })
    : res.status(400).json({ message: "Failed to create promotion!" });
});

// @desc    Update promotion by ID
// @route   PUT /promotion/:id
// @access  Private
const updatePromotion = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    promotionName,
    dateRange,
    timeRange,
    weekDays,
    promotionType,
    activePromotion,
    fixedPrice,
    discountPercent,
    twoForOne,
    threeForTwo,
    secondHalfPrice,
    fullComplimentary,
    businessGoodsToApply,
    description,
  } = req.body;

  // check required fields
  if (
    !promotionName ||
    !dateRange ||
    !timeRange ||
    !weekDays ||
    !promotionType ||
    activePromotion === undefined
  ) {
    return res.status(400).json({
      message:
        "PromotionName, dateRange, timeRange, weekDays, promotionType and activePromotion are required fields!",
    });
  }

  // check if the promotion exists
  const promotion = await Promotion.findById(id).lean();
  if (!promotion) {
    return res.status(404).json({ message: "Promotion not found!" });
  }

  // check duplicate promotion
  const duplicatePromotion = await Promotion.findOne({
    _id: { $ne: id },
    business: promotion.business,
    promotionName,
  }).lean();
  if (duplicatePromotion) {
    return res
      .status(400)
      .json({ message: `Promotion ${promotionName} already exists!` });
  }

  // prepare update object
  const updateObj = {
    promotionName: promotionName || promotion.promotionName,
    promotionType: promotionType || promotion.promotionType,
    activePromotion: activePromotion || promotion.activePromotion,
    fixedPrice: fixedPrice || promotion.fixedPrice,
    discountPercent: discountPercent || promotion.discountPercent,
    twoForOne: twoForOne || promotion.twoForOne,
    threeForTwo: threeForTwo || promotion.threeForTwo,
    secondHalfPrice: secondHalfPrice || promotion.secondHalfPrice,
    fullComplimentary: fullComplimentary || promotion.fullComplimentary,
    businessGoodsToApply:
      businessGoodsToApply || promotion.businessGoodsToApply,
    description: description || promotion.description,
  };

  // validate dateRange and timeRange
  const validateDateAndTimeResult = validateDateAndTime(
    dateRange,
    timeRange,
    updateObj
  );
  if (validateDateAndTimeResult !== true) {
    return res.status(400).json({ message: validateDateAndTimeResult });
  }

  // validate weekDays
  const validateDaysOfTheWeekResult = validateDaysOfTheWeek(
    weekDays,
    updateObj
  );
  if (validateDaysOfTheWeekResult !== true) {
    return res.status(400).json({ message: validateDaysOfTheWeekResult });
  }

  // save the updated promotion
  const updatedPromotion = await promotion.findByIdAndUpdate(
    { _id: id },
    updateObj,
    {
      new: true,
      usefindAndModify: false,
    }
  ).lean();

  return updatedPromotion
    ? res
        .status(200)
        .json({ message: `Promotion ${updatedPromotion.promotionName} updated successfully!` })
    : res.status(400).json({ message: "Failed to update promotion!" });
});

// @desc    Delete promotion by ID
// @route   DELETE /promotion/:id
// @access  Private
const deletePromotion = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // delete promotion and check if it existed
  const result = await Promotion.deleteOne({ _id: id });

  if (result.deletedCount === 0) {
    return res.status(404).json({ message: "Promotion not found" });
  }

  res.status(200).json({ message: `Promotion ${id} deleted!` });
});

// export the functions
module.exports = {
  getPromotions,
  getPromotionById,
  getPromotionsByBusinessId,
  getPromotionsByBusinessIdAndTime,
  createPromotion,
  updatePromotion,
  deletePromotion,
};
