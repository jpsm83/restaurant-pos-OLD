import { Types } from "mongoose";

export interface IEmployee {
    employee: Types.ObjectId;
    role: string;
    timeRange: {
        startTime: string;
        endTime: string;
    };
    shiftHours: number;
    weekHoursLeft: number;
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
