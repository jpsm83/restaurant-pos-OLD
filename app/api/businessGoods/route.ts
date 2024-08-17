import connectDB from "@/app/lib/db";
import { NextResponse } from "next/server";

// import models
import BusinessGood from "@/app/lib/models/businessGood";
import { IBusinessGood } from "@/app/lib/interface/IBusinessGood";
import { handleApiError } from "@/app/lib/utils/handleApiError";
import { validateIngredients } from "./utils/validateIngredients";
import { calculateIngredientsCostPriceAndAllergies } from "./utils/calculateIngredientsCostPriceAndAllergies";
import { calculateSetMenuCostPriceAndAllergies } from "./utils/calculateSetMenuCostPriceAndAllergies";

// @desc    Get all business goods
// @route   GET /businessGoods
// @access  Private
export const GET = async () => {
  try {
    // connect before first call to DB
    await connectDB();
    const businessGoods = await BusinessGood.find()
      .populate("ingredients.ingredient", "name mainCategory subCategory")
      .populate("setMenu", "name mainCategory subCategory sellingPrice")
      .lean();
    return !businessGoods.length
      ? new NextResponse(
          JSON.stringify({ message: "No business goods found!" }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        )
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
      mainCategory,
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
      !mainCategory ||
      !subCategory ||
      onMenu === undefined ||
      available === undefined ||
      !sellingPrice ||
      !business
    ) {
      return new NextResponse(
        JSON.stringify({
          message:
            "Name, keyword, mainCategory, subcategory, onMenu, available, sellingPrice and business are required!",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // one of the two fields should be present (ingredients or setMenu)
    if (ingredients && setMenu) {
      return new NextResponse(
        JSON.stringify({
          message: "Only one of ingredients or setMenu can be asigned!",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
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
      return new NextResponse(
        JSON.stringify({
          message: `${name} already exists on business goods!`,
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // create a business good object
    let newBusinessGood: IBusinessGood = {
      name,
      keyword,
      mainCategory,
      subCategory,
      onMenu,
      available,
      sellingPrice,
      business,
      description: description || undefined,
      image: image || undefined,
      deliveryTime: deliveryTime || undefined,
    };

    // validate ingredients if they exist and calculate the cost price and allergens
    if (ingredients) {
      const validateIngredientsResult = validateIngredients(ingredients);
      if (validateIngredientsResult !== true) {
        return new NextResponse(
          JSON.stringify({ message: validateIngredientsResult }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
      const calculateIngredientsCostPriceAndAllergiesResult =
        await calculateIngredientsCostPriceAndAllergies(ingredients);
      if (typeof calculateIngredientsCostPriceAndAllergiesResult !== "object") {
        return new NextResponse(
          JSON.stringify({
            message: calculateIngredientsCostPriceAndAllergiesResult,
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      } else {
        newBusinessGood.ingredients =
          calculateIngredientsCostPriceAndAllergiesResult.map((ing) => {
            return {
              ingredient: ing.ingredient,
              measurementUnit: ing.measurementUnit,
              requiredQuantity: ing.requiredQuantity ?? 0,
              costOfRequiredQuantity: ing.costOfRequiredQuantity,
            };
          });
        newBusinessGood.setMenu = undefined;
        newBusinessGood.costPrice =
          calculateIngredientsCostPriceAndAllergiesResult.reduce(
            (acc, curr) => acc + curr.costOfRequiredQuantity,
            0
          );
        const reducedAllergens =
          calculateIngredientsCostPriceAndAllergiesResult.reduce(
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
        newBusinessGood.allergens =
          reducedAllergens && reducedAllergens.length > 0
            ? reducedAllergens
            : undefined;
      }
    }

    // calculate the cost price and allergens for the setMenu if they exist
    if (setMenu) {
      const calculateSetMenuCostPriceAndAllergiesResult =
        await calculateSetMenuCostPriceAndAllergies(setMenu);
      if (typeof calculateSetMenuCostPriceAndAllergiesResult !== "object") {
        return new NextResponse(
          JSON.stringify({
            message: calculateSetMenuCostPriceAndAllergiesResult,
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      } else {
        newBusinessGood.ingredients = undefined;
        newBusinessGood.setMenu = setMenu;
        newBusinessGood.costPrice =
          calculateSetMenuCostPriceAndAllergiesResult.costPrice;
        newBusinessGood.allergens =
          calculateSetMenuCostPriceAndAllergiesResult.allergens &&
          calculateSetMenuCostPriceAndAllergiesResult.allergens.length > 0
            ? calculateSetMenuCostPriceAndAllergiesResult.allergens
            : undefined;
      }
    }

    // create the new business good
    await BusinessGood.create(newBusinessGood);

    return new NextResponse(
      JSON.stringify({
        message: `Business good ${name} created successfully!`,
      }),
      {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }
    );
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
//     // const ingredients = await calculateIngredientsCostPriceAndAllergies(
//     //   ingredientsArr
//     // );
//     // return new NextResponse(JSON.stringify(ingredients), {
//     //   status: 201,
//     //   headers: { "Content-Type": "application/json" },
//     // });

//     // @ts-ignore
//     const setMenu = await calculateSetMenuCostPriceAndAllergies(setMenuArr);
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
