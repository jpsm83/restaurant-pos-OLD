import { Types } from "mongoose";

export interface IEmployee {
    userId: Types.ObjectId;
    role: string;
    timeRange: {
        startTime: Date;
        endTime: Date;
    };
    shiftHours: number;
    weekHoursLeft: number;
    employeeCost: number;
    vacation: boolean;
    vacationDaysLeft: number;
}

export interface ISchedule {
    _id: Types.ObjectId;
    date: Date;
    weekNumber: number;
    employees: IEmployee[];
    totalEmployeesScheduled: number;
    totalDayEmployeesCost: number;
    business: Types.ObjectId;
    comments?: string;
}
