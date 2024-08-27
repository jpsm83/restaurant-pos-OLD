import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import Business from "@/app/lib/models/business";
import BusinessGood from "@/app/lib/models/businessGood";
import SupplierGood from "@/app/lib/models/supplierGood";
import Supplier from "@/app/lib/models/supplier";
import User from "@/app/lib/models/user";

// Cloudinary ENV variables
cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export async function POST(req: Request) {
  try {
    const data = await req.formData();
    const imageFile = data.get("imageFile");
    const businessId = data.get("businessId");

    // those are ids required for individaul models for the image
    const businessGoodId = data.get("businessGoodId") || null; // subfolder = "businessGoods"
    const supplierGoodId = data.get("supplierGoodId") || null; // subfolder = "supplierGoods"
    const supplierId = data.get("supplierId") || null; // subfolder = "suppliers"
    const userId = data.get("userId") || null; // subfolder = "users"

    let restaurantSubfolder = null;

    if (businessGoodId) restaurantSubfolder = "businessGoods";
    if (supplierGoodId) restaurantSubfolder = "supplierGoods";
    if (supplierId) restaurantSubfolder = "suppliers";
    if (userId) restaurantSubfolder = "users";

    // validate requeried fields
    if (!imageFile || !businessId) {
      return new NextResponse(
        JSON.stringify({ message: "Image and restaurant folder are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Ensure imageFile is a File object before processing it
    if (!(imageFile instanceof File)) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid file format" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Prepare the data for Cloudinary upload
    const bytes = await imageFile.arrayBuffer();
    const mime = imageFile.type;
    const encoding = "base64";
    const base64Data = Buffer.from(bytes).toString("base64");
    const fileUri = `data:${mime};${encoding},${base64Data}`;

    // to which project in Cloudinary
    const uploadPreset = "restaurant-pos"; // Use your Cloudinary preset

    const folder = restaurantSubfolder
      ? `restaurant-pos/${businessId}/${restaurantSubfolder}`
      : `restaurant-pos/${businessId}`;

    const response = await cloudinary.uploader.upload(fileUri, {
      invalidate: true,
      upload_preset: uploadPreset,
      // businessId is used as a folder name
      folder: folder, // Optional: specify a folder in Cloudinary
    });

    if (!businessGoodId && !supplierGoodId && !supplierId && !userId) {
      await Business.findByIdAndUpdate(businessId, {
        logoImageUrl: response.secure_url,
      });
    }

    if (businessGoodId) {
      await BusinessGood.findByIdAndUpdate(businessGoodId, {
        image: response.secure_url,
      });
    }

    if (supplierGoodId) {
      await SupplierGood.findByIdAndUpdate(supplierGoodId, {
        image: response.secure_url,
      });
    }

    if (supplierId) {
      await Supplier.findByIdAndUpdate(supplierId, {
        logoImageUrl: response.secure_url,
      });
    }

    if (userId) {
      await User.findByIdAndUpdate(userId, {
        image: response.secure_url,
      });
    }

    return new NextResponse(JSON.stringify({ message: "ok" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new NextResponse(
      JSON.stringify({ message: "An error occurred while uploading images." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    // example of a cloudinary image url
    // "https://console.cloudinary.com/pm/c-9e91323343059685f5636d90d4b413/media-explorer/restaurant-pos/66cad982bb87c1faf53fb031/salesLocationQrCodes/66c9d6afc45a1547f9ab893b.png"
    const { logoImageUrl } = await req.json();

    if (!logoImageUrl) {
      return "Invalid logoImageUrl!";
    }

    // Extract cloudinaryPublicId using regex
    // example of a publicId
    // "restaurant-pos/6673fed98c45d0a0ca5f34c1/salesLocationQrCodes/66c9d6afc45a1547f9ab893b"
    let cloudinaryPublicId = logoImageUrl.match(/restaurant-pos\/[^.]+/);

    const deletionResponse = await cloudinary.uploader.destroy(
      cloudinaryPublicId?.[0] ?? "",
      {
        resource_type: "image",
      }
    );

    if (deletionResponse.result === "ok") {
      return new NextResponse(
        JSON.stringify({
          cloudinaryPublicId,
          success: true,
          message: "Image deleted successfully.",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    } else {
      return new NextResponse(
        JSON.stringify({
          cloudinaryPublicId,
          success: false,
          message: "Failed to delete the image.",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  } catch (error) {
    return new NextResponse(
      JSON.stringify({
        message: "Error occurred while deleting the image(s).",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
}
