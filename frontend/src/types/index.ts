export interface User {
  id: number;
  username: string;
  balance: number;
  is_active: boolean;
  currencies: string[];
}

export interface Deal {
  id: number;
  uid: number;
  secret: string;
  to_values: {
    outAmount?: number;
    cardHolder?: string;
    cardNumber?: string;
    phoneNumber?: string;
    bankName?: string;
    country?: string;
    usdtWallet?: string;
    [key: string]: unknown;
  };
  from_xml: string;
  from_name: string;
  from_image_url: string;
  to_xml: string;
  to_name: string;
  to_image_xml: string;
  status: string;
  accepted_by: number | null;
  accepted_at: string | null;
  received_at: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}
