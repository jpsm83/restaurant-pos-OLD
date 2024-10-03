import { Types } from "mongoose";

export interface IEmployeeSchedule {
    _id: Types.ObjectId;
    userId: Types.ObjectId;
    role: string;
    timeRange: {
        startTime: Date;
        endTime: Date;
    };
    vacation: boolean;
    shiftHours: number;
    employeeCost: number;
}

export interface ISchedule {
    _id: Types.ObjectId;
    date: Date;
    weekNumber: number;
    employeesSchedules: IEmployeeSchedule[];
    totalEmployeesScheduled: number;
    totalDayEmployeesCost: number;
    businessId: Types.ObjectId;
    comments?: string;
}
