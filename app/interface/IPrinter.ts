import { Types } from "mongoose";

export interface IPrintFor {
    user?: string[];
    category?: string[];
    subCategory?: string[];
}

export interface IPrinter {
    printerName: string;
    connected: boolean;
    ipAddress: string;
    port: number;
    business: Types.ObjectId;
    printFor: IPrintFor;
    location?: string;
    description?: string;
}
