import { Types } from "mongoose";

export interface ISalesLocationAllowedToPrintOrder {
    printFromSalesLocationReferenceIds: Types.ObjectId[];
    excludeUserIds?: Types.ObjectId[];
    mainCategory: string;
    subCategories?: string[];
}

export interface IPrinter {
    printerAlias: string;
    description?: string;
    printerStatus?: string;
    ipAddress: string;
    port: number;
    businessId: Types.ObjectId;
    backupPrinterId?: Types.ObjectId;
    usersAllowedToPrintDataIds?: Types.ObjectId[];
    salesLocationAllowedToPrintOrder?: ISalesLocationAllowedToPrintOrder[];
}
