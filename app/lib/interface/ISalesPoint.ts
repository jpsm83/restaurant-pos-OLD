import { Types } from "mongoose";

export interface ISalesPoint {
  salesPointReferenceName: string;
  salesPointType?: string;
  selfOrdering: boolean;
  qrCode?: string;
  qrEnabled?: boolean;
  qrLastScanned?: Date;
  businessId: Types.ObjectId;
}
