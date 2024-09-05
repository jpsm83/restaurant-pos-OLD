import { Types } from "mongoose";

const isObjectIdValid = (ids: Types.ObjectId[]) => {
  for(const id of ids) {
    if (!id || !Types.ObjectId.isValid(id)) {
      return false;
    }
  }
  return true;
};

export default isObjectIdValid;