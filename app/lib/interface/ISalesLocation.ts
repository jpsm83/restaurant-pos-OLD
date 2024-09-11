import { Types } from "mongoose";

export interface ISalesLocation {
  billingStatus: string;
  _id?: Types.ObjectId;
  dailyReferenceNumber?: number;
  salesLocationReference: string;
  guests: number;
  status: string;
  openedBy: Types.ObjectId;
  responsibleBy: Types.ObjectId;
  business: Types.ObjectId;
  clientName?: string;
  orders?: Types.ObjectId[];
  closedBy?: Types.ObjectId;
}
