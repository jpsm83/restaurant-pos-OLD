export interface IAddress {
  [key: string]: string | number | undefined | [number, number];
  country: string;
  state: string;
  city: string;
  street: string;
  buildingNumber: string;
  postCode: string;
  region?: string;
  additionalDetails?: string;
  coordinates?: [number, number];
}
