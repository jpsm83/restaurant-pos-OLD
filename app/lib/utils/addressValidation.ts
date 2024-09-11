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
  const missingField = requiredFields.find(
    (field) =>
      !address.hasOwnProperty(field) ||
      address[field] === undefined ||
      address[field] === "" ||
      address[field] === null
  );

  if (missingField) return `${missingField} on address is required!`;

  return true;
};
