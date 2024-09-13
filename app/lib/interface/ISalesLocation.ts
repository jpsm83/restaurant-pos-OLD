import { Types } from "mongoose";

export interface ISalesLocation {
  _id?: Types.ObjectId;
  billingStatus: string;
  dailyReferenceNumber?: number;
  salesLocationReference: string;
  guests: number;
  status: string;
  openedById: Types.ObjectId;
  responsibleById: Types.ObjectId;
  businessId: Types.ObjectId;
  clientName?: string;
  ordersIds?: Types.ObjectId[];
  closedById?: Types.ObjectId;
}
