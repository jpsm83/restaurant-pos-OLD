import { IPrintFor, IPrinter } from "@/app/lib/interface/IPrinter";

// validate printFor object
export const validPrintFor = (printFor: IPrintFor, obj: IPrinter) => {
    // Check if printFor is an object
    if (printFor && typeof printFor === "object") {
      let printForObj: Partial<IPrintFor> = {
        user:
          Array.isArray(printFor.user) && printFor.user.length > 0
            ? printFor.user
            : undefined,
        category:
          Array.isArray(printFor.category) && printFor.category.length > 0
            ? printFor.category
            : undefined,
        subCategory:
          Array.isArray(printFor.subCategory) && printFor.subCategory.length > 0
            ? printFor.subCategory
            : undefined,
      };
  
      // Assign the validated object to obj.printFor
      obj.printFor = printForObj;
      return true;
    } else {
      return "PrintFor object is not valid!";
    }
  };
  