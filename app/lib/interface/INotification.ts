import { Types } from "mongoose";

export interface INotification {
  _id?: Types.ObjectId;
  notificationType: string;
  message: string;
  recipients: Types.ObjectId[];
  business: Types.ObjectId;
  sender?: Types.ObjectId;
}
