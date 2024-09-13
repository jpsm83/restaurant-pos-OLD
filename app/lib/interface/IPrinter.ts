import { Types } from "mongoose";

export interface IPrinter {
    printerName: string;
    description?: string;
    connected: boolean;
    ipAddress: string;
    port: number;
    businessId: Types.ObjectId;
    backupPrinter?: Types.ObjectId;
}
