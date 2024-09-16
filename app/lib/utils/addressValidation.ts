import { IAddress } from "@/app/lib/interface/IAddress";

// helper function to validate address object
export const addressValidation = (address: IAddress) => {
  // check address is an object
  if (typeof address !== "object" || address === null)
    return "Address must be an object!";

  const validKeys = [
    "country",
    "state",
    "city",
    "street",
    "buildingNumber",
    "postCode",
    "region",
    "additionalDetails",
    "coordinates",
  ];

  // Check for any invalid keys
  for (const key of Object.keys(address)) {
    if (!validKeys.includes(key)) {
      return `Invalid key: ${key}`;
    }
  }

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
  for (const key of Object.keys(address)) {
    const value = address[key as keyof IAddress];

    if (value === undefined || value === null || value === "") {
      return `${key} must have a value!`;
    }
  }

  return true;
};
