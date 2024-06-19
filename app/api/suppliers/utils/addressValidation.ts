import { IAddress } from "@/app/interface/IAddress";
import { NextResponse } from "next/server";

export const addressValidation = (address: IAddress | undefined) => {
  // const address = {
  //   country: "Spain",
  //   state: "Barcelona",
  //   city: "Barcelona",
  //   street: "Carrer Mallorca",
  //   buildingNumber: 587,
  //   postCode: "08026"
  // }

  // check address is an object
  if (typeof address !== "object" || address === undefined)
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
