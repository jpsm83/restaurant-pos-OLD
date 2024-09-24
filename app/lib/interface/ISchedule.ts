import { Types } from "mongoose";

export interface IEmployee {
    _id: Types.ObjectId;
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
    employeesSchedules: IEmployee[];
    totalEmployeesScheduled: number;
    totalDayEmployeesCost: number;
    businessId: Types.ObjectId;
    comments?: string;
}
