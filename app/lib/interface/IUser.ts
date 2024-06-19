import { Types } from "mongoose";
import { IAddress } from "./IAddress";

export interface IPersonalDetails {
  [key: string]: string | undefined | Date;
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
  vacationDaysPerYear: number;
  business: Types.ObjectId;
  currentShiftRole?: string;
  address?: IAddress;
  photo?: string;
  contractHoursWeek?: number;
  grossMonthlySalary?: number;
  netMonthlySalary?: number;
  terminatedDate?: Date;
  //   notifications?: { notification: Types.ObjectId; readFlag: boolean }[];
  comments?: string;
}
