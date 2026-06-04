import client from './client';
import type { Deal } from '../types';

export interface DealFilters {
  deal_id?: number;
  status?: string;
  from_xml?: string;
}

export const getDeals = (filters: DealFilters = {}) => {
  const params = Object.fromEntries(
    Object.entries(filters).filter(([, v]) => v !== undefined && v !== '')
  );
  return client.get<Deal[]>('/deals', { params }).then((r) => r.data);
};

export const acceptDeal = (id: number) =>
  client.post<{ id: number; status: string }>(`/deal/${id}/accept`).then((r) => r.data);

export const refuseDeal = (id: number) =>
  client.post<{ id: number; status: string }>(`/deal/${id}/refuse`).then((r) => r.data);
