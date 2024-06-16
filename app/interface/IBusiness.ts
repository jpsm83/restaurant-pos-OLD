export interface IAddress {
    country: string;
    state: string;
    city: string;
    street: string;
    buildingNumber: string;
    postCode: string;
    region?: string;
    additionalDetails?: string;
    coordinates?: [number, number];
    [key: string]: string | number | undefined | [number, number];
  }
  
  export interface IBusiness {
    tradeName: string;
    legalName: string;
    email: string;
    password: string;
    phoneNumber: string;
    taxNumber: string;
    currencyTrade: string;
    subscription: string;
    address: IAddress;
    contactPerson?: string;
    businessTables?: string[] | undefined;
  }
  