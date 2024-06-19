import { IPersonalDetails } from "@/app/lib/interface/IUser";
import { NextResponse } from "next/server";

export const personalDetailsValidation = (
  personalDetails: IPersonalDetails
) => {
  // check personalDetails is an object
  if (typeof personalDetails !== "object" || personalDetails === null)
    return new NextResponse(
      JSON.stringify({ message: "Personal details must be an object" }),
      { status: 400 }
    );

  // required fields
  const requiredFields = [
    "firstName",
    "lastName",
    "email",
    "nationality",
    "gender",
    "birthDate",
    "phoneNumber",
  ];

  // check required fields
  requiredFields.every((field) => {
    return (
      personalDetails.hasOwnProperty(field) &&
      personalDetails[field] !== undefined
    );
  });

  return true;
};
