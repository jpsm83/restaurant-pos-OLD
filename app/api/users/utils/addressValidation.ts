import { IAddress } from "@/app/interface/IAddress";
import { NextResponse } from "next/server";

// helper function to validate address object
export const addressValidation = (address: IAddress) => {
  // check address is an object
  if (typeof address !== "object" || address === null)
    return new NextResponse(
      JSON.stringify({ message: "Address must be an object" }),
      { status: 400 }
    );

  // required fields
  const requiredFields = [
    "country",
    "state",
    "city",
    "street",
    "buildingNumber",
    "postCode",
  ];

  // check required fields
  requiredFields.every((field) => {
    return address.hasOwnProperty(field) && address[field] !== undefined;
  });

  return true;
};
