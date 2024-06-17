import { IPromotionPeriod } from "@/app/interface/IPromotion";

export const validateDateAndTime = (promotionPeriod: IPromotionPeriod, obj: any) => {
    if (
      promotionPeriod.hasOwnProperty("start") &&
      promotionPeriod.hasOwnProperty("end")
    ) {
      const startDate = new Date(promotionPeriod.start);
      const endDate = new Date(promotionPeriod.end);
  
      if (startDate >= endDate) {
        return "The start date must be before the end date.";
      }
  
      // Additional validation checks can be added here
  
      obj.promotionPeriod.start = promotionPeriod.start;
      obj.promotionPeriod.end = promotionPeriod.end;
      return true;
    } else {
      return "Invalid dateRange!";
    }
  };
  