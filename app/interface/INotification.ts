import { Types } from "mongoose";

export interface INotification {
  _id?: Types.ObjectId;
  dayReferenceNumber: number;
  notificationType: string;
  message: string;
  recipient: Types.ObjectId[];
  business: Types.ObjectId;
  sender?: Types.ObjectId;
}
