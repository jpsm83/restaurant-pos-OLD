const asyncHandler = require("express-async-handler");
const bcrypt = require("bcrypt");

// imported models
const User = require("../models/User");
const Table = require("../models/Table");
const Order = require("../models/Order");
const Schedule = require("../models/Schedule");

// import functions
const { removeUserFromNotification } = require("./notificationsController");

// @desc    Get all users
// @route   GET /users
// @access  Private
const getUsers = asyncHandler(async (req, res) => {
  const users = await User.find().select("-password").lean();

  return !users?.length
    ? res.status(404).json({ message: "No users found!" })
    : res.json(users);
});

// @desc    Get user by ID
// @route   GET /users/:id
// @access  Private
const getUserById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = await User.findById(id).select("-password").lean();

  return !user
    ? res.status(404).json({ message: "User not found!" })
    : res.json(user);
});

// @desc   Get user by bussiness ID
// @route  GET /users/business/:id
// @access Private
const getUsersByBusinessId = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const users = await User.find({ business: id }).select("-password").lean();

  return !users.length
    ? res.status(404).json({ message: "No users found!" })
    : res.json(users);
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

const personalDetailsValidation = (personalDetails) => {
  // const personalDetails = {
  //   country: "Spain",
  //   state: "Barcelona",
  //   city: "Barcelona",
  //   street: "Carrer Mallorca",
  //   buildingNumber: 587,
  //   postCode: "08026"
  // }

  // check personalDetails is an object
  if (typeof personalDetails !== "object")
    return "Personal details has to be an object";

  // required fields
  const requiredFields = [
    "firstName",
    "lastName",
    "email",
    "nationality",
    "gender",
    "birthDate",
    "phoneNumber",
  ];

  // check required fields
  const validPersonalDetails = requiredFields.every((field) => {
    return (
      personalDetails.hasOwnProperty(field) &&
      personalDetails[field] !== undefined
    );
  });

  return validPersonalDetails ? true : "Invalid personal details object fields";
};

// @desc    Create new user
// @route   POST /users
// @access  Private
const createNewUser = asyncHandler(async (req, res) => {
  const {
    username,
    password,
    idType,
    idNumber,
    allUserRoles,
    personalDetails,
    taxNumber,
    joinDate,
    active,
    onDuty,
    vacationDaysPerYear,
    business,
    address,
    photo,
    contractHoursWeek,
    grossMonthlySalary,
    netMonthlySalary,
    comments,
  } = req.body;

  // check required fields
  if (
    !username ||
    !password ||
    !idType ||
    !idNumber ||
    !allUserRoles ||
    !personalDetails ||
    !taxNumber ||
    !joinDate ||
    active === undefined ||
    onDuty === undefined ||
    !vacationDaysPerYear ||
    !business
  ) {
    return res.status(400).json({
      message:
        "Username, password, idType, idNumber, allUserRoles, personalDetails, taxNumber, joinDate, active, onDuty, vacationDaysPerYear and business are required!",
    });
  }

  // check for duplicates username, email, taxNumber and idNumber with same business ID
  const duplicateUser = await User.findOne({
    business,
    $or: [{ username }, { email }, { taxNumber }, { idNumber }],
  }).lean();

  if (duplicateUser) {
    if (duplicateUser.active === true) {
      return res.status(409).json({
        message:
          "Username, email, taxNumber or idNumber already exists in an active user!",
      });
    } else {
      return res.status(409).json({
        message:
          "Username, email, taxNumber or idNumber already exists in an unactive user!",
      });
    }
  }

  // create user object with required fields
  const userObj = {
    username,
    password: await bcrypt.hash(password, 10),
    idType,
    idNumber,
    allUserRoles,
    taxNumber,
    joinDate,
    active,
    onDuty,
    vacationDaysPerYear,
    business,
    photo: photo || "../public/images/avatar.png",
    contractHoursWeek: contractHoursWeek || undefined,
    grossMonthlySalary: grossMonthlySalary || undefined,
    netMonthlySalary: netMonthlySalary || undefined,
    comments: comments || undefined,
  };

  // check address validation
  if (address) {
    const checkAddressValidation = addressValidation(address);
    if (checkAddressValidation !== true) {
      return res.status(400).json({ message: checkAddressValidation });
    } else {
      userObj.address = address;
    }
  }

  // check personalDetails validation
  const checkPersonalDetailsValidation =
    personalDetailsValidation(personalDetails);
  if (checkPersonalDetailsValidation !== true) {
    return res.status(400).json({ message: checkPersonalDetailsValidation });
  } else {
    userObj.personalDetails = personalDetails;
  }

  // create user
  const user = await User.create(userObj);

  // confirm user was created
  return user
    ? res
        .status(201)
        .json({ message: `New user ${userObj.username} created successfully!` })
    : res.status(400).json({ message: "Failed to create User!" });
});

// user DO NOT UPDATE notifications, only readFlag
// @desc    Update user
// @route   PATCH /users/:id
// @access  Private
const updateUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    username,
    password,
    idType,
    idNumber,
    allUserRoles,
    personalDetails,
    taxNumber,
    joinDate,
    active,
    onDuty,
    vacationDaysPerYear,
    currentShiftRole,
    address,
    photo,
    contractHoursWeek,
    grossMonthlySalary,
    netMonthlySalary,
    terminatedDate,
    comments,
  } = req.body;

  // check if user exists
  const user = await User.findById(id);
  if (!user) {
    return res.status(404).json({ message: "User not found!" });
  }

  // check for duplicates username, email, taxNumber and idNumber with same business ID
  const duplicateUser = await User.findOne({
    _id: { $ne: id },
    business: user.business,
    $or: [{ username }, { email }, { taxNumber }, { idNumber }],
  }).lean();
  if (duplicateUser) {
    if (duplicateUser.active === true) {
      return res.status(409).json({
        message:
          "Username, email, taxNumber or idNumber already exists in an active user!",
      });
    } else {
      return res.status(409).json({
        message:
          "Username, email, taxNumber or idNumber already exists in an unactive user!",
      });
    }
  }

  // prepare update object
  const updateObj = {
    username: username || user.username,
    password: password ? await bcrypt.hash(password, 10) : user.password,
    idType: idType || user.idType,
    idNumber: idNumber || user.idNumber,
    allUserRoles: allUserRoles || user.allUserRoles,
    taxNumber: taxNumber || user.taxNumber,
    joinDate: joinDate || user.joinDate,
    active: active !== undefined ? active : user.active,
    onDuty: onDuty !== undefined ? onDuty : user.onDuty,
    vacationDaysPerYear: vacationDaysPerYear || user.vacationDaysPerYear,
    currentShiftRole: currentShiftRole || user.currentShiftRole,
    photo: photo || user.photo,
    contractHoursWeek: contractHoursWeek || user.contractHoursWeek,
    grossMonthlySalary: grossMonthlySalary || user.grossMonthlySalary,
    netMonthlySalary: netMonthlySalary || user.netMonthlySalary,
    terminatedDate: terminatedDate || user.terminatedDate,
    comments: comments || user.comments,
  };

  // check address validation
  if (address) {
    const checkAddressValidation = addressValidation(address);
    if (checkAddressValidation !== true) {
      return res.status(400).json({ message: checkAddressValidation });
    } else {
      updateObj.address = address;
    }
  }

  // check personalDetails validation
  const checkPersonalDetailsValidation =
    personalDetailsValidation(personalDetails);
  if (checkPersonalDetailsValidation !== true) {
    return res.status(400).json({ message: checkPersonalDetailsValidation });
  } else {
    updateObj.personalDetails = personalDetails;
  }

  // update the user
  const updateUser = await user
    .findByIdAndUpdate({ _id: id }, updateObj, {
      new: true,
      usefindAndModify: false,
    })
    .lean();

  return updateUser
    ? res
        .status(200)
        .json({ message: `User ${updateUser.username} updated successfully!` })
    : res.status(400).json({ message: "Failed to update User!" });
});

// @desc    Update readFlag for a notification
// @route   PATCH /users/:id/notifications/:notificationId
// @access  Private
const updateReadFlag = asyncHandler(async (req, res) => {
  const { id, notificationId } = req.params;

  // check if user exists
  const user = await User.findById(id);
  if (!user) {
    return res.status(404).json({ message: "User not found!" });
  }

  // update the readFlag for the user notification
  const updatedUserNotification = await User.findByIdAndUpdate(
    {
      _id: id,
      "notifications.notification": notificationId,
    },
    { $set: { "notifications.$.readFlag": true } },
    { new: true, usefindAndModify: false }
  ).lean();

  return updatedUserNotification
    ? res.status(200).json({
        message: `Notification ${notificationId} updated successfully!`,
      })
    : res.status(400).json({ message: "Failed to update Notification!" });
});

// @desc    Delete user from notifications
// @route   DELETE /users/:id/notifications/:notificationId
// @access  Private
const deleteUserFromNotification = asyncHandler(async (req, res) => {
  const { id, notificationId } = req.params;

  // check if user exists
  const user = await User.findById(id).lean();
  if (!user) {
    return res.status(404).json({ message: "User not found!" });
  }

  // check if notification exists
  const notification = await Notification.findById(notificationId).lean();
  if (!notification) {
    return res.status(404).json({ message: "Notification not found!" });
  }

  // remove the notification from the user
  // this function is in the notificationsController
  // keep each controller with its own functions
  // priciple of separation of concerns
  const removeUserFromNotificationResult = await removeUserFromNotification(
    id,
    notificationId
  );

  if (removeUserFromNotificationResult !== true) {
    return res.status(400).json({ message: removeUserFromNotificationResult });
  } else {
    return res
      .status(200)
      .json({
        message: `User id ${id} removed from notification successfully!`,
      });
  }
});

// delete an user shouldnt be allowed for data integrity, historical purposes and analytics
// the only case where an user should be deleted is if the business itself is deleted
// @desc    Delete user
// @route   DELETE /users/:id
// @access  Private
const deleteUser = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Start all operations in parallel
  await Promise.all([
    // remove the user from all orders
    Order.updateMany({ user: id }, { $pull: { user: id } }, { new: true }),

    // remove the user from all tables
    Table.updateMany(
      { openedBy: id },
      { $pull: { openedBy: id } },
      { new: true }
    ),
    Table.updateMany(
      { $or: [{ responsableBy: id }, { closedBy: id }] },
      { $pull: { responsableBy: id, closedBy: id } },
      { multi: true }
    ),

    // remove the user from all schedules
    Schedule.updateMany(
      { "employees.employee": id },
      { $pull: { employees: { employee: id } } },
      { multi: true }
    ),

    // remove the user from all daily reports
    DailySalesReport.updateMany(
      { "usersDailySalesReport.user": id },
      { $pull: { usersDailySalesReport: { user: id } } },
      { multi: true }
    ),

    // Remove the user from all notifications
    Notification.updateMany({ recipient: id }, { $pull: { recipient: id } }),

    // Delete the user
    User.deleteOne({ _id: id }),
  ]);

  res.json({
    message: `User id ${id} deleted successfully!`,
  });
});

// export controller functions
module.exports = {
  getUsers,
  getUserById,
  getUsersByBusinessId,
  createNewUser,
  updateUser,
  updateReadFlag,
  deleteUserFromNotification,
  deleteUser,
};
