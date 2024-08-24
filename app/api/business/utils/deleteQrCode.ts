import { v2 as cloudinary } from "cloudinary";

export const deleteQrCode = async (publicId: string) => {
  // example of a publicId
  // "restaurant-pos/6673fed98c45d0a0ca5f34c1/salesLocationQrCodes/66c9d6afc45a1547f9ab893b"
  try {
    const deletionResponse = await cloudinary.uploader.destroy(publicId, {
      resource_type: "image",
    });
    if (deletionResponse.result === "ok") {
      return "Image deleted successfully.";
    } else {
      return "Failed to delete the image.";
    }
  } catch (error) {
    return "Error occurred while deleting the image(s)." + error;
  }
};
