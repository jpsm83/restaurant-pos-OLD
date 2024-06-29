import connectDB from "@/app/lib/db";
import { NextResponse } from "next/server";

// import models
import BusinessGood from "@/app/lib/models/businessGood";
import { IBusinessGood } from "@/app/lib/interface/IBusinessGood";
import { handleApiError } from "@/app/utils/handleApiError";
import { validateIngredients } from "./utils/validateIngredients";
import { calculateIngredientsCostPriceAndAllery } from "./utils/calculateIngredientsCostPriceAndAllery";
import { calculateSetMenuCostPriceAndAllery } from "./utils/calculateSetMenuCostPriceAndAllery";

// @desc    Get all business goods
// @route   GET /businessGoods
// @access  Private
export const GET = async () => {
  try {
    // connect before first call to DB
    await connectDB();
    const businessGoods = await BusinessGood.find()
      .populate("ingredients.ingredient", "name category")
      .populate("setMenu", "name category sellingPrice")
      .lean();
    return !businessGoods.length
      ? new NextResponse("No business goods found!", { status: 404 })
      : new NextResponse(JSON.stringify(businessGoods), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
  } catch (error) {
    return handleApiError("Get all business goods failed!", error);
  }
};

// @desc    Create new business good
// @route   POST /businessGoods
// @access  Private
export const POST = async (req: Request) => {
  try {
    const {
      name,
      keyword,
      category,
      subCategory,
      onMenu,
      available,
      sellingPrice,
      business,
      ingredients,
      setMenu,
      description,
      image,
      deliveryTime,
    } = (await req.json()) as IBusinessGood;

    // check required fields
    if (
      !name ||
      !keyword ||
      !category ||
      !subCategory ||
      onMenu === undefined ||
      available === undefined ||
      !sellingPrice ||
      !business
    ) {
      return new NextResponse(
        "Name, keyword, category, subcategory, onMenu, available, sellingPrice and business are required!",
        { status: 400 }
      );
    }

    // one of the two fields should be present (ingredients or setMenu)
    if (ingredients && setMenu) {
      return new NextResponse(
        "Only one of ingredients or setMenu can be asigned!",
        { status: 400 }
      );
    }

    // connect before first call to DB
    await connectDB();

    // check for duplicate business good
    const duplicateBusinessGood = await BusinessGood.findOne({
      business,
      name,
    });

    if (duplicateBusinessGood) {
      return new NextResponse(`${name} already exists on business goods!`, {
        status: 400,
      });
    }

    // create a business good object
    let newBusinessGood: IBusinessGood = {
      name,
      keyword,
      category: {
        mainCategory: category as unknown as string,
        setMenuSubCategory: undefined,
        foodSubCategory: undefined,
        beverageSubCategory: undefined,
        merchandiseSubCategory: undefined,
      },
      onMenu,
      available,
      sellingPrice,
      business,
      description: description || undefined,
      image: image || undefined,
      deliveryTime: deliveryTime || undefined,
    };

    // set the category and subcategory
    switch (category as unknown as string) {
      case "Set Menu":
        newBusinessGood.category.setMenuSubCategory = subCategory;
        break;
      case "Food":
        newBusinessGood.category.foodSubCategory = subCategory;
        break;
      case "Beverage":
        newBusinessGood.category.beverageSubCategory = subCategory;
        break;
      case "Merchandise":
        newBusinessGood.category.merchandiseSubCategory = subCategory;
        break;
      default:
        newBusinessGood.category.merchandiseSubCategory = "No subcategory";
        break;
    }

    // validate ingredients if they exist and calculate the cost price and allergens
    if (ingredients) {
      const validateIngredientsResult = validateIngredients(ingredients);
      if (validateIngredientsResult !== true) {
        return new NextResponse(validateIngredientsResult, { status: 400 });
      }
      const calculateIngredientsCostPriceAndAlleryResult =
        await calculateIngredientsCostPriceAndAllery(ingredients);
      if (typeof calculateIngredientsCostPriceAndAlleryResult !== "object") {
        return new NextResponse(calculateIngredientsCostPriceAndAlleryResult, {
          status: 400,
        });
      } else {
        newBusinessGood.ingredients =
          calculateIngredientsCostPriceAndAlleryResult.map((ing) => {
            return {
              ingredient: ing.ingredient,
              measurementUnit: ing.measurementUnit,
              requiredQuantity: ing.requiredQuantity ?? 0,
              costOfRequiredQuantity: ing.costOfRequiredQuantity,
            };
          });
        newBusinessGood.setMenu = undefined;
        newBusinessGood.costPrice =
          calculateIngredientsCostPriceAndAlleryResult.reduce(
            (acc, curr) => acc + curr.costOfRequiredQuantity,
            0
          );
        const reducedAllergens =
          calculateIngredientsCostPriceAndAlleryResult.reduce(
            (acc: string[], curr) => {
              if (curr.allergens) {
                curr.allergens.forEach((allergen) => {
                  if (!acc.includes(allergen)) {
                    acc.push(allergen);
                  }
                });
              }
              return acc;
            },
            []
          );
          newBusinessGood.allergens = reducedAllergens && reducedAllergens.length > 0 ? reducedAllergens : undefined;
      }
    }

    // calculate the cost price and allergens for the setMenu if they exist
    if (setMenu) {
      const calculateSetMenuCostPriceAndAlleryResult =
        await calculateSetMenuCostPriceAndAllery(setMenu);
      if (typeof calculateSetMenuCostPriceAndAlleryResult !== "object") {
        return new NextResponse(calculateSetMenuCostPriceAndAlleryResult, {
          status: 400,
        });
      } else {
        newBusinessGood.ingredients = undefined;
        newBusinessGood.setMenu = setMenu;
        newBusinessGood.costPrice =
          calculateSetMenuCostPriceAndAlleryResult.costPrice;
        newBusinessGood.allergens =
          calculateSetMenuCostPriceAndAlleryResult.allergens && calculateSetMenuCostPriceAndAlleryResult.allergens.length > 0 ? calculateSetMenuCostPriceAndAlleryResult.allergens : undefined;
      }
    }

    // create the new business good
    await BusinessGood.create(newBusinessGood);

    return new NextResponse(`Business good ${name} created successfully!`, {
      status: 201,
    });
  } catch (error) {
    return handleApiError("Create business good failed!", error);
  }
};

// export const POST = async (req: Request) => {
//   try {
//     const ingredientsArr: any = [
//       {
//         ingredient: "667bfac8d28a7ee19d9be443",
//         measurementUnit: "unit",
//         requiredQuantity: 1,
//       },
//       {
//         ingredient: "667bfac8d28a7ee19d9be444",
//         measurementUnit: "g",
//         requiredQuantity: 0.5,
//       },
//       {
//         ingredient: "667bfac8d28a7ee19d9be445",
//         measurementUnit: "unit",
//         requiredQuantity: 1,
//       },
//       {
//         ingredient: "667bfac8d28a7ee19d9be446",
//         measurementUnit: "g",
//         requiredQuantity: 20,
//       },
//       {
//         ingredient: "667bfac8d28a7ee19d9be447",
//         measurementUnit: "g",
//         requiredQuantity: 10,
//       },
//       {
//         ingredient: "667bfac8d28a7ee19d9be44c",
//         measurementUnit: "g",
//         requiredQuantity: 15,
//       },
//     ];

//     // cheeseburger - fries
//     const setMenuArr = ["667bfc0c5d50be40f0c7b065", "667bfddd5d50be40f0c7b079"];

//     await connectDB();

//     // // @ts-ignore
//     // const ingredients = await calculateIngredientsCostPriceAndAllery(
//     //   ingredientsArr
//     // );
//     // return new NextResponse(JSON.stringify(ingredients), {
//     //   status: 201,
//     //   headers: { "Content-Type": "application/json" },
//     // });

//     // @ts-ignore
//     const setMenu = await calculateSetMenuCostPriceAndAllery(setMenuArr);
//     return new NextResponse(JSON.stringify(setMenu), {
//       status: 201,
//       headers: { "Content-Type": "application/json" },
//     });

//     // // @ts-ignore
//     // const validate = validateIngredients(ingredientsArr);
//     // return new NextResponse(JSON.stringify(validate), {
//     //   status: 201,
//     //   headers: { "Content-Type": "application/json" },
//     // });
//   } catch (error) {
//     return handleApiError("Create schedule failed!", error);
//   }
// };
