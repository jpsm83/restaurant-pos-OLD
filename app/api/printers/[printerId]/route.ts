import connectDb from "@/app/lib/utils/connectDb";
import { Types } from "mongoose";
import { NextResponse } from "next/server";

// imported interfaces
import { IPrinter } from "@/app/lib/interface/IPrinter";

// imported utils
import { checkPrinterConnection } from "../utils/checkPrinterConnection";
import { handleApiError } from "@/app/lib/utils/handleApiError";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";

// imported models
import Printer from "@/app/lib/models/printer";
import User from "@/app/lib/models/user";
import Business from "@/app/lib/models/business";

// @desc    Get printer by ID
// @route   GET /printers/:printerId
// @access  Private
export const GET = async (
  req: Request,
  context: { params: { printerId: Types.ObjectId } }
) => {
  try {
    const printerId = context.params.printerId;
    // check if printerId is valid
    if (isObjectIdValid([printerId]) !== true) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid printerId!" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
    // connect before first call to DB
    await connectDb();

    const printer = await Printer.findById(printerId)
      .populate({
        path: "usersAllowedToPrintDataIds",
        select: "username",
        model: User,
      })
      .populate({
        path: "salesLocationAllowedToPrintOrder.printFromSalesLocationReferenceIds",
        select: "salesLocation",
        model: Business,
      })
      .lean();

    return !printer
      ? new NextResponse(JSON.stringify({ message: "Printer not found!" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        })
      : new NextResponse(JSON.stringify(printer), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        });
  } catch (error) {
    return handleApiError("Get printer by its id failed!", error);
  }
};

// @desc    Update printer by ID
// @route   PATCH /printers/:printerId
// @access  Private
export const PATCH = async (
  req: Request,
  context: { params: { printerId: Types.ObjectId } }
) => {
  try {
    const printerId = context.params.printerId;

    const {
      printerAlias,
      ipAddress,
      port,
      description,
      usersAllowedToPrintDataIds,
      backupPrinterId,
    } = (await req.json()) as IPrinter;

    // check if printerId is valid
    if (isObjectIdValid([printerId]) !== true) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid printerId!" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // validate backupPrinterId if it exists
    if (backupPrinterId) {
      if (isObjectIdValid([backupPrinterId]) !== true) {
        return new NextResponse(
          JSON.stringify({ message: "Invalid backupPrinterId!" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    // validate usersAllowedToPrintDataIds if it exists
    if (usersAllowedToPrintDataIds) {
      if (
        !Array.isArray(usersAllowedToPrintDataIds) ||
        isObjectIdValid(usersAllowedToPrintDataIds) !== true
      ) {
        return new NextResponse(
          JSON.stringify({
            message:
              "UsersAllowedToPrintDataIds have to be an array of valid Ids!",
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // connect before first call to DB
    await connectDb();

    // fetch the printer with the given ID
    const printer: IPrinter | null = await Printer.findById(printerId)
      .select("businessId")
      .lean();
    if (!printer) {
      return new NextResponse(
        JSON.stringify({ message: "Printer not found!" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // check duplicate printer
    const duplicatePrinter = await Printer.findOne({
      _id: { $ne: printerId },
      businessId: printer.businessId,
      $or: [{ printerAlias }, { ipAddress }],
    });

    if (duplicatePrinter) {
      return new NextResponse(
        JSON.stringify({ message: `Printer already exists!` }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // printerStatus is auto check on the backend
    const isOnline = (await checkPrinterConnection(ipAddress, port)) as boolean;

    // create updated printer object
    const updatePrinterObj: Partial<IPrinter> = {
      printerStatus: isOnline ? "Online" : "Offline",
    };

    // populate updated fields
    if (printerAlias) updatePrinterObj.printerAlias = printerAlias;
    if (description) updatePrinterObj.description = description;
    if (ipAddress) updatePrinterObj.ipAddress = ipAddress;
    if (port) updatePrinterObj.port = port;
    if (backupPrinterId) updatePrinterObj.backupPrinterId = backupPrinterId;
    if (usersAllowedToPrintDataIds) updatePrinterObj.usersAllowedToPrintDataIds = usersAllowedToPrintDataIds;

    // update the printer
    const updatedPrinter = await Printer.findByIdAndUpdate(
      printerId,
      { $set: updatePrinterObj },
      {
        new: true,
        lean: true,
      }
    );

    if (!updatedPrinter) {
      return new NextResponse(
        JSON.stringify({ message: "Printer not found!" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    return new NextResponse(
      JSON.stringify({
        message: `Printer ${updatePrinterObj.printerAlias} updated successfully`,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return handleApiError("Update printer failed!", error);
  }
};

// @desc    Delete printer by ID
// @route   DELETE /printers/:printerId
// @access  Private
export const DELETE = async (
  req: Request,
  context: { params: { printerId: Types.ObjectId } }
) => {
  try {
    const printerId = context.params.printerId;

    // check if printerId is valid
    if (isObjectIdValid([printerId]) !== true) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid printerId!" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // connect before first call to DB
    await connectDb();

    // delete printer and check if it existed
    const result = await Printer.deleteOne({ _id: printerId });

    if (result.deletedCount === 0) {
      return new NextResponse(
        JSON.stringify({ message: "Printer not found!" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    return new NextResponse(
      JSON.stringify({ message: `Printer ${printerId} deleted!` }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return handleApiError("Delete printer failed!", error);
  }
};
