import { Schema, model, models } from "mongoose";

const promotionType = [
  "fixedPrice",
  "discountPercent",
  "twoForOne",
  "threeForTwo",
  "secondHalfPrice",
  "fullComplimentary",
];

const weekDays = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const promotionSchema = new Schema(
  {
    // required fields
    promotionName: { type: String, required: true }, // name of the promotion
    promotionPeriod: {
      type: {
        start: { type: Date, required: true }, // Combined start date and time
        end: { type: Date, required: true }, // Combined end date and time
      },
      required: true,
    }, // object with the range of the promotion
    weekDays: {
      type: [String],
      enum: weekDays,
      required: true,
    }, // days of the week when the promotion applies
    promotionType: {
      type: String,
      enum: promotionType,
      required: true,
    }, // type of the promotion
    activePromotion: { type: Boolean, required: true, default: true }, // if the promotion is active or not
    business: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
    },

    // non required fields
    fixedPrice: { type: Number }, // fixed price of the promotion "fron 15:00 to 17:00 all beers 2€"
    discountPercent: { type: Number }, // discount percent of the promotion "from 15:00 to 17:00 all beers 50% off"
    twoForOne: { type: Boolean }, // two for one promotion "from 15:00 to 17:00 all beers two for one"
    threeForTwo: { type: Boolean }, // three for two promotion "from 15:00 to 17:00 all beers three for two"
    secondHalfPrice: { type: Boolean }, // second half price promotion "from 15:00 to 17:00 buy one beer get second half price"
    fullComplimentary: { type: Boolean }, // full complimentary promotion "from 15:00 to 17:00 all beers are free"
    businessGoodsToApply: {
      type: [Schema.Types.ObjectId],
      ref: "BusinessGood",
      default: undefined,
    }, // business goods that the promotion will apply to
    description: { type: String }, // description of the promotion
  },
  { timestamps: true, minimize: false }
);

const Promotion = models.Promotion || model("Promotion", promotionSchema);

export default Promotion;
