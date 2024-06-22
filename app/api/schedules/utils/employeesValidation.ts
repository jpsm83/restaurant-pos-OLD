import { IEmployee } from "@/app/lib/interface/ISchedule";

export const employeesValidation = (employee: IEmployee) => {
  // check if the schedule is an array
  if (typeof employee !== "object" || employee === undefined) {
    return "Invalid employee object";
  }

  const requiredEmployeeFields: (keyof IEmployee)[] = [
    "userId",
    "role",
    "timeRange",
  ];

  // check if the required fields are present
  for (const field of requiredEmployeeFields) {
    if (!employee[field]) {
      return `Missing required field: ${field}`;
    }
  }

  // check if timeRange has the required fields
  if (
    !employee.timeRange.startTime ||
    !employee.timeRange.endTime ||
    typeof employee.timeRange !== "object"
  ) {
    return "Invalid timeRange object";
  }

  return true;
};
