import client from './client';
import type { Deal, User } from '../types';

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

export const getUser = (userId: number) =>
  client.get<User>(`/users/${userId}`).then((r) => r.data).catch(() => null);

export const getUsers = () =>
  client.get<User[]>('/users').then((r) => r.data).catch(() => []);

export const acceptDeal = (id: number) =>
  client.post<{ id: number; status: string }>(`/deal/${id}/accept`).then((r) => r.data);

export const refuseDeal = (id: number) =>
  client.post<{ id: number; status: string }>(`/deal/${id}/refuse`).then((r) => r.data);

export const completeDeal = (id: number) =>
  client.post<{ id: number; status: string }>(`/deal/${id}/complete`).then((r) => r.data);
