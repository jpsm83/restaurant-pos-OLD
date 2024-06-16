import { IAddress } from "@/app/interface/IBusiness";

// helper function to validate address object
export const addressValidation = (address: IAddress) => {
    // check address is an object
    if (typeof address !== "object" || address === null) {
      return "Address must be a non-null object";
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
    const missingFields = requiredFields.filter(
      (field) => !(field in address) || address[field] === undefined
    );
  
    return missingFields.length > 0 ? "Invalid address object fields" : true;
  };