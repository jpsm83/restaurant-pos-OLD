import { IPaymentMethod } from "@/app/interface/IOrder";

export const createPaymentMethodObject = (
    paymentMethod: IPaymentMethod,
    orderNetPrice: number
  ) => {
    let newPaymentMethodObj: IPaymentMethod = {
      method: "",
      paymentMethodAmount: 0,
    };
    newPaymentMethodObj.method = paymentMethod.method;
    switch (paymentMethod.method) {
      case "Card":
        newPaymentMethodObj.card = paymentMethod.card;
        break;
      case "Crypto":
        newPaymentMethodObj.crypto = paymentMethod.crypto;
        break;
      case "Other":
        newPaymentMethodObj.other = paymentMethod.other;
        break;
      case "Cash":
        break;
      default:
        throw new Error("Invalid payment method");
    }
    newPaymentMethodObj.paymentMethodAmount = orderNetPrice;
    return newPaymentMethodObj;
  }
  