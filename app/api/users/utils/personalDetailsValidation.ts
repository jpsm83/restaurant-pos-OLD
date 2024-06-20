import { IPersonalDetails } from "@/app/lib/interface/IUser";

export const personalDetailsValidation = (
  personalDetails: IPersonalDetails
) => {
  // check personalDetails is an object
  if (typeof personalDetails !== "object" || personalDetails === null)
    return "Personal details must be an object";

  // required fields
  const requiredFields = [
    "firstName",
    "lastName",
    "nationality",
    "gender",
    "birthDate",
    "phoneNumber",
  ];

  // check required fields
  const missingField = requiredFields.find(
    (field) =>
      !personalDetails.hasOwnProperty(field) ||
      personalDetails[field] === undefined ||
      personalDetails[field] === "" ||
      personalDetails[field] === null
  );

  if (missingField) return `${missingField} on user personal detail is required!`;

  return true;
};
