import connectDb from "@/app/lib/utils/connectDb";
import { Types } from "mongoose";
import convert, { Unit } from "convert-units";
import BusinessGood from "@/app/lib/models/businessGood";
import Inventory from "@/app/lib/models/inventory";
import SupplierGood from "@/app/lib/models/supplierGood";
import { IInventory } from "./app/lib/interface/IInventory";

// every time an order is created or cancel, we MUST update the supplier goods
// check all the ingredients of the business goods array of the order
// each ingredient is a supplier good
// add or remove the quantity used from the inventoy.inventoryGoods.[the supplier good that applied].dynamicCountFromLastInventory
// if insted of ingredients we have setMenu
// get all business goods from the setMenu and repeat the cicle
export const updateDynamicCountSupplierGood = async (
  businessGoodsIds: Types.ObjectId[],
  addOrRemove: "add" | "remove"
) => {
  try {
    // Connect to the database
    await connectDb();

    // Fetch all business goods including setMenu and their ingredients
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

    // Collect all required ingredients from business goods and setMenus
    let allIngredientsRequired: {
      ingredientId: Types.ObjectId;
      requiredQuantity: number;
      measurementUnit: string;
    }[] = [];

    businessGoodsIngredients.forEach((businessGood) => {
      if (businessGood.ingredients) {
        businessGood.ingredients.forEach((ing: any) => {
          allIngredientsRequired.push({
            ingredientId: ing.supplierGood,
            requiredQuantity: ing.requiredQuantity,
            measurementUnit: ing.measurementUnit,
          });
        });
      }
      if (businessGood.setMenu) {
        businessGood.setMenu.forEach((setMenuItem: any) => {
          setMenuItem.ingredients.forEach((ing: any) => {
            allIngredientsRequired.push({
              ingredientId: ing.supplierGood,
              requiredQuantity: ing.requiredQuantity,
              measurementUnit: ing.measurementUnit,
            });
          });
        });
      }
    });

    // Fetch supplier goods and their units in one query
    const supplierGoods = await SupplierGood.find({
      _id: { $in: allIngredientsRequired.map((ing) => ing.ingredientId) },
    })
      .select("_id measurementUnit")
      .lean();

    // Fetch inventory items in one query
    const inventoryItems: IInventory | null = await Inventory.findOne({
      setFinalCount: false,
      "inventoryGoods.supplierGoodId": {
        $in: allIngredientsRequired.map((ing) => ing.ingredientId),
      },
    })
      .select("inventoryGoods.supplierGoodId inventoryGoods.dynamicSystemCount")
      .lean();

    if (!inventoryItems) return "Inventory not found!";

    // Create a map of supplier good measurement units and dynamic system counts
    const supplierGoodUnitsMap = supplierGoods.reduce((map: any, good: any) => {
      map[good._id] = good.measurementUnit;
      return map;
    }, {});

    const inventoryMap = inventoryItems.inventoryGoods.reduce(
      (map: any, invItem: any) => {
        map[invItem.supplierGoodId.toString()] = invItem;
        return map;
      },
      {}
    );

    // Perform bulk update to modify dynamic counts
    const bulkOperations: any = allIngredientsRequired
      .map((ingredientObj) => {
        const inventoryItem =
          inventoryMap[ingredientObj.ingredientId.toString()];
        const supplierGoodUnit =
          supplierGoodUnitsMap[ingredientObj.ingredientId.toString()];

        if (!inventoryItem || !supplierGoodUnit) return null;

        let quantityChange = ingredientObj.requiredQuantity;
        if (ingredientObj.measurementUnit !== supplierGoodUnit) {
          // Convert units if necessary
          quantityChange = convert(quantityChange)
            .from(ingredientObj.measurementUnit as Unit)
            .to(supplierGoodUnit as Unit);
        }

        return {
          updateOne: {
            filter: {
              "inventoryGoods.supplierGoodId": ingredientObj.ingredientId,
            },
            update: {
              $inc: {
                "inventoryGoods.$.dynamicSystemCount":
                  addOrRemove === "add" ? -quantityChange : quantityChange,
              },
            },
          },
        };
      })
      .filter(Boolean); // Remove null values

    // Execute bulk update
    if (bulkOperations.length > 0) {
      await Inventory.bulkWrite(bulkOperations);
    }

    return true;
  } catch (error) {
    return "Could not update dynamic count supplier good! " + error;
  }
};
