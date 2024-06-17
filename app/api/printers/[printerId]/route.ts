import connectDB from "@/lib/db";
import { Types } from "mongoose";
import { NextResponse } from "next/server";

// imported models
import Printer from "@/lib/models/printer";
import { IPrinter } from "@/app/interface/IPrinter";
import { checkPrinterConnection } from "../utils/checkPrinterConnection";
import { validPrintFor } from "../utils/validPrintFor";

// @desc    Get printer by ID
// @route   GET /printers/:printerId
// @access  Private
export const GET = async (context: { params: any }) => {
  try {
    const printerId = context.params.printerId;
    // check if printerId is valid
    if (!printerId || !Types.ObjectId.isValid(printerId)) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid printerId" }),
        {
          status: 400,
        }
      );
    }
    // connect before first call to DB
    await connectDB();

    const printer = await Printer.findById(printerId)
      .populate("printFor.user", "username")
      .lean();

    return !printer
      ? new NextResponse(JSON.stringify({ message: "Printer not found!" }), {
          status: 404,
        })
      : new NextResponse(JSON.stringify(printer), { status: 200 });
  } catch (error: any) {
    return new NextResponse("Error: " + error, { status: 500 });
  }
};

// @desc    Update printer by ID
// @route   PATCH /printers/:printerId
// @access  Private
export const PATCH = async (req: Request, context: { params: any }) => {
  try {
    const printerId = context.params.printerId;
    // check if printerId is valid
    if (!printerId || !Types.ObjectId.isValid(printerId)) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid printerId" }),
        {
          status: 400,
        }
      );
    }

    const { printerName, ipAddress, port, printFor, location, description } =
      req.body as unknown as IPrinter;

    // connect before first call to DB
    await connectDB();

    // fetch the printer with the given ID
    const printer: IPrinter | null = await Printer.findById(printerId).lean();
    if (!printer) {
      return new NextResponse(
        JSON.stringify({ message: "Printer not found!" }),
        { status: 404 }
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
        { status: 400 }
      );
    }

    // create printer object with required fields
    const updateObj: IPrinter = {
      printerName,
      ipAddress,
      port,
      location: location || undefined,
      description: description || undefined,
      connected: printer.connected,
      business: printer.business,
      printFor: printer.printFor,
    };

    // check printer connection
    const isConnected = await checkPrinterConnection(ipAddress, port);
    updateObj.connected = isConnected !== true ? false : true;

    // validate printFor object
    const validPrintForResult = validPrintFor(printFor, updateObj);
    if (validPrintForResult !== true) {
      return new NextResponse(
        JSON.stringify({ message: validPrintForResult }),
        { status: 400 }
      );
    }

    // update the printer
    const updatedPrinter = await Printer.findByIdAndUpdate(
      { _id: printerId },
      updateObj,
      { new: true, usefindAndModify: false }
    ).lean();

    return updatedPrinter
      ? new NextResponse(
          JSON.stringify({
            message: `Printer ${printerName} updated successfully`,
          }),
          { status: 200 }
        )
      : new NextResponse(
          JSON.stringify({ message: "Failed to update printer" }),
          { status: 400 }
        );
  } catch (error: any) {
    return new NextResponse("Error: " + error, { status: 500 });
  }
};

// @desc    Delete printer by ID
// @route   DELETE /printers/:printerId
// @access  Private
export const DELETE = async (context: { params: any }) => {
  try {
    const printerId = context.params.printerId;
    // check if printerId is valid
    if (!printerId || !Types.ObjectId.isValid(printerId)) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid printerId" }),
        {
          status: 400,
        }
      );
    }

    // connect before first call to DB
    await connectDB();

    // delete printer and check if it existed
    const result = await Printer.deleteOne({ _id: printerId });

    if (result.deletedCount === 0) {
      return new NextResponse(
        JSON.stringify({ message: "Printer not found" }),
        { status: 404 }
      );
    }
    return new NextResponse(
      JSON.stringify({ message: `Printer ${printerId} deleted!` }),
      { status: 200 }
    );
  } catch (error: any) {
    return new NextResponse("Error: " + error, { status: 500 });
  }
};
