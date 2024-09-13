import { Types } from "mongoose";

export interface IPrintFor {
    userId?: Types.ObjectId[];
    mainCategories?: string[];
    subCategories?: string[];
}

export interface IPrinter {
    printerName: string;
    connected: boolean;
    ipAddress: string;
    port: number;
    businessId: Types.ObjectId;
    printFor: IPrintFor;
    location?: string;
    description?: string;
}
