import client from './client';

export interface PayoutResponse {
  id: number;
  amount: number;
  wallet_address: string;
  currency?: string;
  card_holder?: string;
  card_number?: string;
  phone_number?: string;
  bank_name?: string;
  status: string;
  created_at: string;
  redirect_url: string;
}

export interface PayoutRequest {
  amount: number;
  wallet_address: string;
  currency?: string;
  card_holder?: string;
  card_number?: string;
  phone_number?: string;
  bank_name?: string;
}

export const requestPayout = (data: PayoutRequest) =>
  client.post<PayoutResponse>('/payout/', data).then((r) => r.data);

export const getPayouts = () =>
  client.get<PayoutResponse[]>('/payout/').then((r) => r.data);
