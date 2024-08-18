import connectDB from "@/app/lib/db";
import { Types } from "mongoose";
import { NextResponse } from "next/server";

// imported interfaces
import { IPrinter } from "@/app/lib/interface/IPrinter";

// imported utils
import { checkPrinterConnection } from "../utils/checkPrinterConnection";
import { handleApiError } from "@/app/lib/utils/handleApiError";
import { printForValidation } from "../utils/printForValidation";

// imported models
import Printer from "@/app/lib/models/printer";
import User from "@/app/lib/models/user";

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
    if (!printerId || !Types.ObjectId.isValid(printerId)) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid printerId!" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
    // connect before first call to DB
    await connectDB();

    const printer = await Printer.findById(printerId)
      .populate({ path: "printFor.users", select: "username", model: User })
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
    // check if printerId is valid
    if (!printerId || !Types.ObjectId.isValid(printerId)) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid printerId!" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const { printerName, ipAddress, port, printFor, location, description } =
      (await req.json()) as IPrinter;

    // check printFor validation
    if (printFor) {
      const validPrintFor = printForValidation(printFor);
      if (validPrintFor !== true) {
        return new NextResponse(JSON.stringify({ message: validPrintFor }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // connect before first call to DB
    await connectDB();

    // fetch the printer with the given ID
    const printer: IPrinter | null = await Printer.findById(printerId).lean();
    if (!printer) {
      return new NextResponse(
        JSON.stringify({ message: "Printer not found!" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // check duplicate printer
    const duplicatePrinter = await Printer.findOne({
      _id: { $ne: printerId },
      business: printer.business,
      $or: [{ printerName }, { ipAddress }],
    });
    if (duplicatePrinter) {
      return new NextResponse(
        JSON.stringify({ message: `Printer already exists!` }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // check printer connection
    const isConnected = (await checkPrinterConnection(
      ipAddress || printer.ipAddress,
      port || printer.port
    )) as boolean;

    // create printer object with required fields
    const updatedPrinter = {
      printerName: printerName || printer.printerName,
      connected: isConnected,
      ipAddress: ipAddress || printer.ipAddress,
      port: port || printer.port,
      location: location || undefined,
      description: description || undefined,
      printFor: printFor || printer.printFor,
    };

    // update the printer
    await Printer.findByIdAndUpdate(printerId, updatedPrinter, {
      new: true,
    });

    return new NextResponse(
      JSON.stringify({
        message: `Printer ${updatedPrinter.printerName} updated successfully`,
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
    if (!printerId || !Types.ObjectId.isValid(printerId)) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid printerId!" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // connect before first call to DB
    await connectDB();

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
