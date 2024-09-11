import { Types } from "mongoose";
import QRCode from "qrcode";
import { v2 as cloudinary } from "cloudinary";
import { ObjectId } from "mongodb";

// Configure Cloudinary (you should have these values in your environment variables)
cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export const generateQrCode = async (businessId: Types.ObjectId) => {
  try {
    // generate randomUniqueId
    const randomUniqueId = new ObjectId();

    // this QR will redirect to a page where user can order and pay - to be developed
    //    scan QR
    //    select language
    //    createTable function will be called so user will fill the necessary inputs
    //      salesLocation - auto generated
    //      guests - user input
    //      openedBy - auto generated
    //      responsibleBy - auto generated
    //      business - auto generated
    //      clientName - user input
    //      dailyReferenceNumber - auto generated
    // *** once a table is created, no other user will be able to scan the QR code and create a table till this table is closed ***
    //    user will be redirected to an order menu page - to be developed
    //    user will select items and quantity
    //    user will pay for the order and get a confirmation message with order number to be compare by the waiter
    //    them order will be place to the kitchen/bar

    // Generate QR code as a data URL
    const qrCodeDataUrl = await QRCode.toDataURL(
      `http://localhost:3000/selfOrder/${randomUniqueId}`
    );

    // Prepare the data for Cloudinary upload
    const bytes = Buffer.from(qrCodeDataUrl.split(",")[1], "base64");
    const fileUri = `data:image/png;base64,${bytes.toString("base64")}`;

    // Upload the QR code image to Cloudinary
    const uploadPreset = "restaurant-pos"; // Use your Cloudinary preset

    const response = await cloudinary.uploader.upload(fileUri, {
      invalidate: true,
      upload_preset: uploadPreset,
      public_id: randomUniqueId.toString(), // Optional: use the ID as the public ID
      // businessId is used as a folder name
      folder: `restaurant-pos/${businessId}/salesLocationQrCodes`, // Optional: specify a folder in Cloudinary
    });

    // Return the Cloudinary URL
    return response.secure_url;
    // example of a return
    // "https://res.cloudinary.com/jpsm83/image/upload/v1724503727/restaurant-pos/6673fed98c45d0a0ca5f34c1/salesLocationQrCodes/66c9d6afc45a1547f9ab893b.png"
  } catch (err) {
    return "Failed to generate QR code";
  }
};
