import connectDB from "@/lib/db";
import { NextResponse } from "next/server";

// imported models
import Printer from "@/lib/models/printer";
import { IPrinter } from "@/app/interface/IPrinter";
import { validPrintFor } from "./utils/validPrintFor";
import { checkPrinterConnection } from "./utils/checkPrinterConnection";

// @desc    Get all printers
// @route   GET /printers
// @access  Private
export const GET = async () => {
  try {
    // connect before first call to DB
    await connectDB();

    const printers = await Printer.find()
      .populate("printFor.user", "username")
      .lean();

    return !printers.length
      ? new NextResponse(JSON.stringify({ message: "No printers found!" }), {
          status: 404,
        })
      : new NextResponse(JSON.stringify(printers), { status: 200 });
  } catch (error: any) {
    return new NextResponse("Error: " + error, { status: 500 });
  }
};

// @desc    Create new printer
// @desc    POST /business
// @access  Private
export const POST = async (req: Request) => {
  try {
    const {
      printerName,
      ipAddress,
      port,
      business,
      printFor,
      location,
      description,
    } = req.body as unknown as IPrinter;

    // check required fields
    if (!printerName || !ipAddress || !port || !business) {
      return new NextResponse(
        JSON.stringify({
          message:
            "printerName, ipAddress, port and business are required fields!",
        }),
        { status: 400 }
      );
    }

    // connect before first call to DB
    await connectDB();

    //check duplicate printer
    const duplicatePrinter = await Printer.findOne({
      business,
      $or: [{ printerName }, { ipAddress }],
    });
    if (duplicatePrinter) {
      return new NextResponse(
        JSON.stringify({ message: `Printer already exists!` }),
        { status: 400 }
      );
    }

    // create printer object with required fields
    const printerObj: IPrinter = {
      printerName,
      ipAddress,
      port,
      business,
      location: location || undefined,
      description: description || undefined,
      connected: false,
      printFor: {},
    };

    // check printer connection
    const isConnected = await checkPrinterConnection(ipAddress, port);
    printerObj.connected = isConnected !== true ? false : true;

    // validate printFor object
    const validPrintForResult = validPrintFor(printFor, printerObj);
    if (validPrintForResult !== true) {
      return new NextResponse(
        JSON.stringify({ message: validPrintForResult }),
        { status: 400 }
      );
    }

    // create a new printer
    const printer = await Printer.create(printerObj);

    // confirm printer was created
    return printer
      ? new NextResponse(
          JSON.stringify({
            message: `Printer ${printerName} created successfully`,
          }),
          { status: 201 }
        )
      : new NextResponse(
          JSON.stringify({ message: "Failed to create printer" }),
          { status: 400 }
        );
  } catch (error: any) {
    return new NextResponse("Error: " + error, { status: 500 });
  }
};
