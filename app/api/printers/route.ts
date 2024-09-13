import connectDb from "@/app/lib/utils/connectDb";
import { NextResponse } from "next/server";

// imported interfaces
import { IPrinter } from "@/app/lib/interface/IPrinter";

// imported utils
import { printForValidation } from "./utils/printForValidation";
import { checkPrinterConnection } from "./utils/checkPrinterConnection";
import { handleApiError } from "@/app/lib/utils/handleApiError";

// import user model
import User from "@/app/lib/models/user";
import Printer from "@/app/lib/models/printer";

// @desc    Get all printers
// @route   GET /printers
// @access  Private
export const GET = async (req: Request,) => {
  try {
    // connect before first call to DB
    await connectDb();

    const printers = await Printer.find()
      .populate({ path: "printFor.usersId", select: "username", model: User })
      .lean(); // Converts Mongoose document to plain JavaScript object

    if (!printers.length) {
      return new NextResponse(
        JSON.stringify({ message: "No printers found!" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Return the populated printers data
    return new NextResponse(JSON.stringify(printers), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    return handleApiError("Get all printers failed!", error);
  }
};

// @desc    Create new printer
// @desc    POST /businessId
// @access  Private
export const POST = async (req: Request) => {
  try {
    const {
      printerName,
      ipAddress,
      port,
      businessId,
      printFor,
      location,
      description,
    } = (await req.json()) as IPrinter;

    // check required fields
    if (!printerName || !ipAddress || !port || !businessId) {
      return new NextResponse(
        JSON.stringify({
          message:
            "printerName, ipAddress, port and businessId are required fields!",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

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
    await connectDb();

    //check duplicate printer
    const duplicatePrinter = await Printer.findOne({
      businessId,
      $or: [{ printerName }, { ipAddress }],
    });

    if (duplicatePrinter) {
      return new NextResponse(
        JSON.stringify({
          message: `Printer already exists with same name or ip address!`,
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // check printer connection
    const isConnected = (await checkPrinterConnection(
      ipAddress,
      port
    )) as boolean;

    // create printer object with required fields
    const newPrinter: IPrinter = {
      printerName,
      ipAddress,
      port,
      businessId,
      location: location || undefined,
      description: description || undefined,
      connected: isConnected,
      printFor: printFor || undefined,
    };

    // create a new printer
    await Printer.create(newPrinter);

    // confirm printer was created
    return new NextResponse(
      JSON.stringify({
        message: `Printer ${printerName} created successfully`,
      }),
      {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return handleApiError("Create printer failed!", error);
  }
};
