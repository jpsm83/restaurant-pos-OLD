import { Types } from "mongoose";

export interface INotification {
  _id?: Types.ObjectId;
  notificationType: string;
  message: string;
  employeeRecipientsId: Types.ObjectId[];
  businessId: Types.ObjectId;
  employeeSenderId?: Types.ObjectId;
}
