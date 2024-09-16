import { Types } from "mongoose";
import { IAddress } from "./IAddress";

export interface IPersonalDetails {
  firstName: string;
  lastName: string;
  nationality: string;
  gender: string;
  birthDate: Date;
  phoneNumber: string;
}

export interface IUser {
  username: string;
  email: string;
  password: string;
  idType: string;
  idNumber: string;
  allUserRoles: string[];
  personalDetails: IPersonalDetails;
  taxNumber: string;
  joinDate: Date;
  active: boolean;
  onDuty: boolean;
  vacationDaysPerYear?: number;
  vacationDaysLeft: number;
  businessId: Types.ObjectId;
  currentShiftRole?: string;
  address?: IAddress;
  imageUrl?: string;
  contractHoursWeek?: number;
  salary?: {
    payFrequency: string;
    grossSalary: number;
    netSalary: number;
  };
  terminatedDate?: Date;
  notifications?: { notificationId: Types.ObjectId; readFlag: boolean }[];
  comments?: string;
}
