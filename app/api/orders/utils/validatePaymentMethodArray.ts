import { IPaymentMethod } from "@/app/interface/IOrder";

export const validatePaymentMethodArray = (paymentMethod: IPaymentMethod[]) => {
    // example of a payment method object
    // paymentMethod = [
    //   {
    //     method: "Card",
    //     card: "Visa",
    //     paymentMethodAmount: 40,
    //   },
    //   {
    //     method: "Cash",
    //     paymentMethodAmount: 60,
    //   },
    // ];
    if (!Array.isArray(paymentMethod)) {
      return "Invalid paymentMethod array!";
    }
  
    for (let payment of paymentMethod) {
      if (!payment.method || !payment.paymentMethodAmount) {
        return "Payment has no method or paymentMethodAmount!";
      }
      switch (payment.method) {
        case "Card":
          if (!payment.card) {
            return "Card payment method provided without card details";
          }
          break;
        case "Crypto":
          if (!payment.crypto) {
            return "Crypto payment method provided without crypto details";
          }
          break;
        case "Other":
          if (!payment.other) {
            return "Other payment method provided without other details";
          }
          break;
        case "Cash":
          // No additional validation needed for cash payments
          break;
        default:
          return "Invalid payment method";
      }
    }
    return paymentMethod;
  };
  