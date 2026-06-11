import type { Deal } from './types'

const BASE = '/api/v1'

function getToken(): string {
  return localStorage.getItem('token') ?? ''
}

function authHeaders(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${getToken()}`,
  }
}

export async function login(username: string, password: string): Promise<string> {
  let res: Response
  try {
    res = await fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
  } catch {
    throw new Error('Cannot connect to server')
  }
  if (res.status === 401) throw new Error('Invalid credentials')
  if (!res.ok) throw new Error('Server error, try again later')
  const { access_token } = await res.json()
  return access_token
}

export async function register(username: string, password: string, api_key: string, secret: string): Promise<string> {
  let res: Response
  try {
    res = await fetch(`${BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, api_key, secret }),
    })
  } catch {
    throw new Error('Cannot connect to server')
  }
  if (res.status === 409) throw new Error('Username already taken')
  if (!res.ok) throw new Error('Server error, try again later')
  const { access_token } = await res.json()
  return access_token
}

export async function fetchDeals(): Promise<Deal[]> {
  const res = await fetch(`${BASE}/deals`, { headers: authHeaders() })
  if (!res.ok) throw new Error('Failed to load deals')
  return res.json()
}

export async function acceptDeal(id: number): Promise<void> {
  const res = await fetch(`${BASE}/deal/${id}/accept`, {
    method: 'POST',
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('Failed to accept deal')
}

export function createWs(): WebSocket {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws'
  return new WebSocket(`${proto}://${location.host}/api/v1/ws/deals?token=${getToken()}`)
}
