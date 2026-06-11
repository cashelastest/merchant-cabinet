import client from './client';
import type { TokenResponse, User } from '../types';

export const register = (username: string, password: string, api_key: string, secret: string) =>
  client.post<TokenResponse>('/auth/register', { username, password, api_key, secret }).then((r) => r.data);

export const login = (username: string, password: string) =>
  client.post<TokenResponse>('/auth/login', { username, password }).then((r) => r.data);

export const getMe = () =>
  client.get<User>('/auth/me').then((r) => r.data);

export const setMyStatus = (is_active: boolean) =>
  client.patch<{ id: number; username: string; is_active: boolean }>('/auth/me/status', { is_active }).then((r) => r.data);

export const updateMyCurrencies = (currencies: string[]) =>
  client.patch<{ id: number; username: string; currencies: string[] }>('/auth/me/currencies', { currencies }).then((r) => r.data);
