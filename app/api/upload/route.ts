import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export async function POST(request: Request) {
  try {
    const data = await request.formData();
    const files = data.getAll("images");

    if (files.length === 0) {
      return new NextResponse(
        JSON.stringify({ message: "No images to upload." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const uploadPreset = "restaurant-pos";
    const uploadPromises = [];

    for (const file of files) {
      // @ts-ignore
      const bytes = await (file as Blob).arrayBuffer();

      // @ts-ignore
      const mime = file.type;
      const encoding = "base64";
      const base64Data = Buffer.from(bytes).toString("base64");
      const fileUri = `data:${mime};${encoding},${base64Data}`;

      const response = cloudinary.uploader.upload(fileUri, {
        invalidate: true,
        upload_preset: uploadPreset,
      });

      uploadPromises.push(response);
    }

    const uploadResponses = await Promise.all(uploadPromises);
    return new NextResponse(JSON.stringify({ message: uploadResponses }), {
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

export async function DELETE(request: Request) {
  try {
    const { publicIds } = await request.json();

    const deletionResponses = [];

    for (const publicId of publicIds) {
      const deletionResponse = await cloudinary.uploader.destroy(
        `restaurant-pos/${publicId}`,
        { resource_type: "image" }
      );
      if (deletionResponse.result === "ok") {
        deletionResponses.push({
          publicId,
          success: true,
          message: "Image deleted successfully.",
        });
      } else {
        deletionResponses.push({
          publicId,
          success: false,
          message: "Failed to delete the image.",
        });
      }
    }

    return new NextResponse(JSON.stringify({ message: deletionResponses }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new NextResponse(
      JSON.stringify({
        message: "Error occurred while deleting the image(s).",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
}
