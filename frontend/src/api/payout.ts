import client from './client';

export interface PayoutResponse {
  id: number;
  amount: number;
  wallet_address: string;
  status: string;
  created_at: string;
  redirect_url: string;
}

export const requestPayout = (amount: number, wallet_address: string) =>
  client.post<PayoutResponse>('/payout/', { amount, wallet_address }).then((r) => r.data);

export const getPayouts = () =>
  client.get<PayoutResponse[]>('/payout/').then((r) => r.data);
