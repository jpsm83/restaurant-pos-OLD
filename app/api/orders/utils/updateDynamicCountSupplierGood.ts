import connectDB from "@/app/lib/db";
import { IBusinessGood } from "@/app/lib/interface/IBusinessGood";
import { ISupplierGood } from "@/app/lib/interface/ISupplierGood";
import BusinessGood from "@/app/lib/models/businessGood";
import Inventory from "@/app/lib/models/inventory";
import SupplierGood from "@/app/lib/models/supplierGood";
import convert, { Unit } from "convert-units";
import { Types } from "mongoose";

// every time an order is created or cancel, we MUST update the supplier goods
// check all the ingredients of the business goods array of the order
// each ingredient is a supplier good
// add or remove the quantity used from the inventoy.inventoryGoods.[the supplier good that applied].dynamicCountFromLastInventory
// if insted of ingredients we have setMenu
// get all business goods from the setMenu and repeat the cicle
export const updateDynamicCountSupplierGood = async (
  businessGoodsIds: Types.ObjectId[],
  addOrRemove: string
) => {
  try {
    // connect before first call to DB
    await connectDB();

    const businessGoodsIngredients = await BusinessGood.find({
      _id: { $in: businessGoodsIds },
    })
      .select(
        "ingredients.supplierGood ingredients.measurementUnit ingredients.requiredQuantity setMenu"
      )
      .populate(
        "setMenu",
        "ingredients.supplierGood ingredients.measurementUnit ingredients.requiredQuantity"
      )
      .lean();

    // [
    //     "ingredientId": "60f1b3b3b3b3b3b3b3b3b3b3",
    //     "requiredQuantity": 2,
    //     "measurementUnit": "unit"
    // ]

    let allIngredientsUser: {
      ingredientId: Types.ObjectId;
      requiredQuantity: number;
      measurementUnit: string;
    }[] = [];

    businessGoodsIngredients.forEach((businessGood) => {
      if (businessGood.ingredients) {
        businessGood.ingredients.forEach((ing: any) => {
          allIngredientsUser.push({
            ingredientId: ing.ingredient, // Assuming the ID field is named ingredientId
            requiredQuantity: ing.requiredQuantity,
            measurementUnit: ing.measurementUnit,
          });
        });
      } else if (businessGood.setMenu) {
        businessGood.setMenu.forEach((setMenuItem: any) => {
          // @ts-ignore
          setMenuItem.ingredients.forEach((ing) => {
            allIngredientsUser.push({
              ingredientId: ing.ingredient, // Adjust according to the actual field name for ingredient ID
              requiredQuantity: ing.requiredQuantity,
              measurementUnit: ing.measurementUnit,
            });
          });
        });
      }
    });

    // @ts-ignore
    for (let ing of allIngredientsUser) {
      const supplierGood: ISupplierGood | null = await SupplierGood.findById(
        ing.ingredientId
      )
        .select("measurementUnit")
        .lean();

      const supplierGoodInventory: any = await Inventory.findOne(
        {
          setFinalCount: false,
          "inventoryGoods.supplierGood": ing.ingredientId,
        },
        { "inventoryGoods.$": 1 } // Select only the matched item from the array
      ).lean();

      const supplierGoodInventoryObj = supplierGoodInventory?.inventoryGoods[0];

      if (supplierGood?.measurementUnit === ing.measurementUnit) {
        await Inventory.updateOne(
          {
            _id: supplierGoodInventory._id,
            "inventoryGoods._id": supplierGoodInventoryObj._id,
          },
          {
            $inc: {
              dynamicCountFromLastInventory:
                addOrRemove === "add"
                  ? -ing.requiredQuantity
                  : ing.requiredQuantity,
            },
          },
          { new: true }
        );
      } else {
        const convertedQuantity = convert(ing.requiredQuantity)
          .from(ing.measurementUnit as Unit)
          .to(supplierGood?.measurementUnit as Unit);
        await Inventory.updateOne(
          {
            _id: supplierGoodInventory._id,
            "inventoryGoods._id": supplierGoodInventoryObj._id,
          },
          {
            $inc: {
              dynamicCountFromLastInventory:
                addOrRemove === "add" ? -convertedQuantity : convertedQuantity,
            },
          },
          { new: true }
        );
      }
    }
    return "Dynamic count supplier good updated!";
  } catch (error) {
    return "Could not update dynamic count supplier good! " + error;
  }
};
