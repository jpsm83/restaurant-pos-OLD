import convert, { Unit } from "convert-units";
import mongoose, { Types } from "mongoose";

// imported utils
import connectDb from "@/app/lib/utils/connectDb";

// imported interfaces
import BusinessGood from "@/app/lib/models/businessGood";

// imported models
import Inventory from "@/app/lib/models/inventory";
import { IIngredients } from "@/app/lib/interface/IBusinessGood";

// every time an order is created or cancel, we MUST update the supplier goods
// check all the ingredients of the business goods array of the order
// each ingredient is a supplier good
// add or remove the quantity used from the inventoy.inventoryGoods.[the supplier good that applied].dynamicSystemCount
// if insted of ingredients we have setMenu
// get all business goods from the setMenu and repeat the cicle
export const updateDynamicCountSupplierGood = async (
  businessGoodsIds: Types.ObjectId[],
  addOrRemove: "add" | "remove"
) => {
  // Connect to the database
  await connectDb();

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    // Fetch all business goods including setMenu and their ingredients
    const businessGoodsIngredients = await BusinessGood.find({
      _id: { $in: businessGoodsIds },
    })
      .select(
        "ingredients.supplierGoodId ingredients.measurementUnit ingredients.requiredQuantity setMenuIds"
      )
      .populate({
        path: "setMenuIds",
        select:
          "ingredients.supplierGoodId ingredients.measurementUnit ingredients.requiredQuantity",
        model: BusinessGood,
      })
      .lean();

    if (!businessGoodsIngredients || businessGoodsIngredients.length === 0) {
      return "Business goods not found!";
    }

    let ingredientsArr: IIngredients[] = [];

    businessGoodsIds.forEach((businessGoodId) => {
      // Find the business good by ID
      const businessGood = businessGoodsIngredients.find(
        (good: any) => good._id.toString() === businessGoodId.toString()
      );

      if (
        businessGood &&
        businessGood.ingredients &&
        Array.isArray(businessGood.ingredients)
      ) {
        // Iterate over each ingredient within the business good
        businessGood.ingredients.forEach((ingredient) => {
          ingredientsArr.push({
            supplierGoodId: ingredient.supplierGoodId,
            requiredQuantity: ingredient.requiredQuantity,
            measurementUnit: ingredient.measurementUnit,
          });
        });
      }
    });

    // Prepare bulk operations
    const bulkOperations = ingredientsArr.flatMap((ingredientItem: any) => {
      // Determine the increment value based on add or remove
      const quantityChange =
        addOrRemove === "add"
          ? ingredientItem.requiredQuantity
          : -ingredientItem.requiredQuantity;

      // Create the update object
      const updateObject = {
        $inc: {
          "inventoryGoods.$[elem].dynamicSystemCount": quantityChange,
        },
      };

      // Create the filter object
      const filterObject = {
        "inventoryGoods.supplierGoodId": ingredientItem.supplierGoodId,
      };

      // Return the update operation
      return {
        updateOne: {
          filter: filterObject,
          update: updateObject,
          arrayFilters: [
            { "elem.supplierGoodId": ingredientItem.supplierGoodId },
          ],
        },
      };
    });

    // Execute bulk update
    if (bulkOperations.length > 0) {
      await Inventory.bulkWrite(bulkOperations, { session });
    } else {
      return "No bulk operations executed!";
    }

    // Commit the transaction
    await session.commitTransaction();

    return true;
  } catch (error) {
    // Abort transaction on error
    await session.abortTransaction();
    return "Could not update dynamic count supplier good! " + error;
  } finally {
    // End the session
    await session.endSession();
  }
};
