import { Types } from "mongoose";

export interface ISalesLocation {
  _id?: Types.ObjectId;
  dailyReferenceNumber?: number;
  salesLocationReferenceId: Types.ObjectId;
  guests: number;
  status: string;
  openedById: Types.ObjectId;
  responsibleById: Types.ObjectId;
  businessId: Types.ObjectId;
  clientName?: string;
  ordersIds?: Types.ObjectId[];
  closedById?: Types.ObjectId;
}
