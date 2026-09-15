import client from './client';
import type { BalanceHistoryItem, Deal } from '../types';

/** Deals this merchant finished — completed or refused by them — newest first. */
export const getDealsHistory = () =>
  client.get<Deal[]>('/deals/history').then((r) => r.data);

/** Balance movements of the current merchant, in USDT, newest first. */
export const getMyBalanceHistory = () =>
  client.get<BalanceHistoryItem[]>('/auth/me/balance-history').then((r) => r.data);
