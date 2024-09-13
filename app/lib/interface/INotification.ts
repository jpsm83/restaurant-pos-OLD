import { Types } from "mongoose";

export interface INotification {
  _id?: Types.ObjectId;
  notificationType: string;
  message: string;
  userRecipientsId: Types.ObjectId[];
  businessId: Types.ObjectId;
  userSenderId?: Types.ObjectId;
}
