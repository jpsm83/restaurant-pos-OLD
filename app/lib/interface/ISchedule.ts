import { Types } from "mongoose";

export interface IEmployee {
    employee: Types.ObjectId;
    role: string;
    timeRange: {
        startTime: Date;
        endTime: Date;
    };
    shiftHours: Number;
    weekHoursLeft: Number;
    employeeCost: number;
    vacation: boolean;
    vacationDaysLeft: number;
}

export interface ISchedule {
    date: Date;
    employees: IEmployee[];
    totalEmployeesScheduled: number;
    totalDayEmployeesCost: number;
    business: Types.ObjectId;
    comments?: string;
}
