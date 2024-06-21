import { IEmployee } from "@/app/lib/interface/ISchedule";

export const employeesValidation = (employees: IEmployee[]) => {
  //    employees: [
  //        {
  //            employee: "661908d66ba61fd8588ed008",
  //            role: "Manager",
  //            timeRange: {
  //              startTime: "2024-06-20T10:05:13.920Z",
  //              endTime: "2024-06-20T10:05:13.920Z",
  //        },
  //        {
  //            employee: "661908d66ba61fd8588ed008",
  //            role: "Manager",
  //            timeRange: {
  //              startTime: "2024-06-20T10:05:13.920Z",
  //              endTime: "2024-06-20T10:05:13.920Z",
  //        }
  //    ],

  // check if the schedule is an array
  if (!Array.isArray(employees) || employees.length === 0) {
    return "Invalid employees array";
  }

  const requiredEmployeeFields: (keyof IEmployee)[] = [
    "employee",
    "role",
    "timeRange",
  ];

  for (const employee of employees) {
    for (const field of requiredEmployeeFields) {
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

    const requiredTimeRangeFields: (keyof IEmployee["timeRange"])[] = [
      "startTime",
      "endTime",
    ];

    for (const field of requiredTimeRangeFields) {
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
