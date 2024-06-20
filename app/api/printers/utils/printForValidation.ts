import { IPrintFor } from "@/app/lib/interface/IPrinter";

// validate printFor object
export const printForValidation = (printFor: IPrintFor) => {
  // check address is an object
  if (typeof printFor !== "object" || printFor === null)
    return "Address must be an object!";

  // acceptable fields
  const acceptableFields = [
    "users",
    "categories",
    "subCategories",
  ];

  // check for unacceptable fields
  const unacceptableField = Object.keys(printFor).find(
    (key) => !acceptableFields.includes(key)
  );

  if (unacceptableField) return `${unacceptableField} is not an acceptable field!`;

  // check required fields
  const missingField = acceptableFields.find(
    (field) =>
      !printFor.hasOwnProperty(field) ||
      !Array.isArray(printFor[field])
  );

  if (missingField) return `${missingField} on printFor is required and have to be an array!`;

  return true;
};