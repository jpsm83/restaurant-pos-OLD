import { Types } from "mongoose";

export interface IPrintFor {
    [key: string]: string[] | Types.ObjectId[] | undefined;
    user?: Types.ObjectId[];
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
