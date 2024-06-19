import { Types } from "mongoose";

export interface ITable {
  dayReferenceNumber?: number;
  tableReference: string;
  guests: number;
  status: string;
  openedBy: Types.ObjectId;
  responsibleBy: Types.ObjectId;
  business: Types.ObjectId;
  clientName?: string;
  tableTotalPrice?: number;
  tableTotalNetPaid?: number;
  tableTotalTips?: number;
  orders?: Types.ObjectId[];
  closedBy?: Types.ObjectId;
}
