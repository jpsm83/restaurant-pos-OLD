import connectDB from "@/app/lib/db";

import Business from "@/app/lib/models/business";
import BusinessGood from "@/app/lib/models/businessGood";
import SupplierGood from "@/app/lib/models/supplierGood";
import Supplier from "@/app/lib/models/supplier";
import User from "@/app/lib/models/user";

const documentModelExists = async (
  businessId: FormDataEntryValue | null,
  businessGoodId: FormDataEntryValue | null,
  supplierGoodId: FormDataEntryValue | null,
  supplierId: FormDataEntryValue | null,
  userId: FormDataEntryValue | null
) => {
  // Create a mapping between model names and actual models
  const modelMap: { [key: string]: any } = {
    Business,
    BusinessGood,
    SupplierGood,
    Supplier,
    User,
  };

  let documentModel = {
    restaurantSubfolder: "",
    name: "Business",
    id: businessId,
  };

  if (businessGoodId) {
    documentModel.restaurantSubfolder = "businessGoods";
    documentModel.name = "BusinessGood";
    documentModel.id = businessGoodId;
  }

  if (supplierGoodId) {
    documentModel.restaurantSubfolder = "supplierGoods";
    documentModel.name = "SupplierGood";
    documentModel.id = supplierGoodId;
  }

  if (supplierId) {
    documentModel.restaurantSubfolder = "suppliers";
    documentModel.name = "Supplier";
    documentModel.id = supplierId;
  }

  if (userId) {
    documentModel.restaurantSubfolder = "users";
    documentModel.name = "User";
    documentModel.id = userId;
  }

  // Retrieve the actual model based on the string input
  const model = modelMap[documentModel.name];

  // connect before first call to DB
  await connectDB();

  // check if the document with id exists
  const documentExists = await model.findById(documentModel.id).lean();

  if (documentExists) {
    return documentModel;
  } else {
    return `${documentModel.name} with id ${documentModel.id} does not exists!`;
  }
};

export default documentModelExists;
