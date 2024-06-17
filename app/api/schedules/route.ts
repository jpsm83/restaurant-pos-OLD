const asyncHandler = require("express-async-handler");

// imported models
const Schedule = require("../models/Schedule");
const User = require("../models/User");

// @desc    Get all schedules
// @route   GET /schedules
// @access  Public
const getSchedules = asyncHandler(async (req, res) => {
  const schedules = await Schedule.find()
    .populate("employees.employee", "username allUserRoles")
    .lean();

  return !schedules.length
    ? res.status(404).json({ message: "No schedules found" })
    : res.json(schedules);
});

// @desc    Get schedule by ID
// @route   GET /schedules/:id
// @access  Public
const getScheduleById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const schedule = await Schedule.findById(id)
    .populate("employees.employee", "username allUserRoles")
    .lean();

  return !schedule.length
    ? res.status(404).json({ message: "No schedule found" })
    : res.json(schedule);
});

// @desc    Get all schedules by user ID
// @route   GET /schedules/user/:id
// @access  Public
const getSchedulesByUserId = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const schedules = await Schedule.find({ "employees.employee": id })
    .populate("employees.employee", "username allUserRoles")
    .lean();

  return !schedules.length
    ? res.status(404).json({ message: "No schedules found" })
    : res.json(schedules);
});

// @desc    Get all schedules by business ID
// @route   GET /schedules/business/:id
// @access  Public
const getSchedulesByBusinessId = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const schedules = await Schedule.find({ business: id })
    .populate("employees.employee", "username allUserRoles")
    .lean();

  return !schedules.length
    ? res.status(404).json({ message: "No schedules found" })
    : res.json(schedules);
});

const employeesValidation = (employees) => {
  //    employees: [
  //        {
  //            employee: "661908d66ba61fd8588ed008",
  //            role: "Manager",
  //            timeRange: {
  //              startTime: "08:15",
  //              endTime: "16:15",
  //            shiftHours: 8,
  //            weekHoursLeft: 32,
  //            employeeCost: 100,
  //            vacation: false,
  //            vacationDaysLeft: 22,
  //        },
  //        {
  //            employee: "661908d66ba61fd8588ed008",
  //            role: "Manager",
  //            timeRange: {
  //              startTime: "08:15",
  //              endTime: "16:15",
  //            shiftHours: 8,
  //            weekHoursLeft: 32,
  //            employeeCost: 100,
  //            vacation: false,
  //            vacationDaysLeft: 22,
  //        }
  //    ],

  // check if the schedule is an array
  if (!Array.isArray(employees) || employees.length === 0) {
    return "Invalid employees array";
  }

  const requiredEmployeeFields = [
    "employee",
    "role",
    "timeRange",
    "shiftHours",
    "weekHoursLeft",
    "employeeCost",
    "vacation",
    "vacationDaysLeft",
  ];

  for (const employee of employees) {
    for (const field in requiredEmployeeFields) {
      if (!employee[field] || employee[field] === undefined) {
        return `Invalid employee object: ${field} is missing or of wrong type`;
      }
    }

    if (
      typeof employee.timeRange !== "object" ||
      employee.timeRange === undefined
    ) {
      return "Invalid employee object: timeRange is not an object";
    }

    const requiredTimeRangeFields = ["startTime", "endTime"];

    for (const field in requiredTimeRangeFields) {
      if (
        !employee.timeRange[field] ||
        employee.timeRange[field] === undefined
      ) {
        return `Invalid timeRange object: ${field} is missing or of wrong type`;
      }
    }
  }
  return true;
};

// @desc    Create a new schedule
// @route   POST /schedules
// @access  Private
const createSchedule = asyncHandler(async (req, res) => {
  const { date, employees, totalDayEmployeesCost, business, comments } =
    req.body;

  // check required fields
  if (!date || !employees || !totalDayEmployeesCost || !business) {
    return res.status(400).json({
      message:
        "Date, employees, totalDayEmployeesCost and business are required fields",
    });
  }

  // check if schedule already exists
  const duplicateSchedule = await Schedule.findOne({ date, business }).lean();
  if (duplicateSchedule) {
    return res.status(409).json({
      message: `Schedule for ${date} already exists for business ${business}`,
    });
  }

  // create schedule object
  const scheduleObj = {
    date,
    totalEmployeesScheduled: employees.length,
    totalDayEmployeesCost,
    business,
    comments: comments || undefined,
  };

  // validate employee object
  const validEmployees = employeesValidation(employees);
  if (validEmployees === true) {
    scheduleObj.employees = employees;
  } else {
    return res.status(400).json({ message: validEmployees });
  }

  // create new schedule
  const newSchedule = await Schedule.create(scheduleObj);

  return newSchedule
    ? res.status(201).json({ message: `Schedule ${newSchedule._id} created` })
    : res.status(400).json({ message: "Schedule could not be created" });
});

// @desc    Update a schedule
// @route   PATCH /schedules/:id
// @access  Private
const updateSchedule = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    employees,
    totalEmployeesScheduled,
    totalDayEmployeesCost,
    comments,
  } = req.body;

  // check if the schedule exists
  const schedule = await Schedule.findById(id).lean();
  if (!schedule) {
    return res.status(404).json({ message: "Schedule not found" });
  }

  // prepare update object
  const updateObj = {
    totalEmployeesScheduled:
      employees.length || schedule.totalEmployeesScheduled,
    totalDayEmployeesCost:
      totalDayEmployeesCost || schedule.totalDayEmployeesCost,
    comments: comments || schedule.comments,
  };

  // validate employees object
  if (employees) {
    const validEmployees = employeesValidation(employees);
    if (validEmployees === true) {
      updateObj.employees = employees;
    } else {
      return res.status(400).json({ message: validEmployees });
    }
  }

  // update schedule or delete it if no employees are scheduled
  if (!employees || employees.length === 0) {
    await Schedule.deleteOne({ _id: id });
    return res.status(200).json({
      message: `Schedule ${schedule.date} deleted because it has no employees!`,
    });
  } else {
    const updatedSchedule = await Schedule.findByIdAndUpdate(
      { _id: id },
      updateObj,
      { new: true, usefindAndModify: false }
    ).lean();
    return updatedSchedule
      ? res.status(200).json({ message: `Schedule ${updatedSchedule.date} updated` })
      : res
          .status(400)
          .json({ message: `Schedule ${updatedSchedule.date} could not be updated` });
  }
});

// @desc    Delete a schedule
// @route   DELETE /schedules/:id
// @access  Private
const deleteSchedule = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // delete schedule and check if it existed
  const result = await Schedule.deleteOne({ _id: id });

  if (result.deletedCount === 0) {
    return res.status(404).json({ message: "Schedule not found" });
  }

  res.status(200).json({ message: `Schedule ${id} deleted!` });
});

module.exports = {
  getSchedules,
  getScheduleById,
  getSchedulesByUserId,
  getSchedulesByBusinessId,
  createSchedule,
  updateSchedule,
  deleteSchedule,
};
