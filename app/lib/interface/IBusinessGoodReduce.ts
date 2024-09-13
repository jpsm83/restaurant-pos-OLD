import { Types } from "mongoose";

export interface IBusinessGoodReduce {
  businessGoodId: Types.ObjectId; // reference to the "Order" model
  quantity: number; // quantity of the good sold or void
  totalPrice: number; // total price of the good sold or void
  totalCostPrice: number; // total cost price of the good sold or void
}
