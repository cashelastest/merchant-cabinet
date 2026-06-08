import { useEffect, useRef, useState } from 'react'
import type { Deal, WsDealMessage } from '../types'
import { fetchDeals, createWs } from '../api'
import DealRow from '../components/DealRow'

const COLUMNS = [
  'Change Status', 'Estimate', 'Request ID', 'Status',
  'Currency', 'Card Holder', 'Card Number', 'Phone Number',
  'External Bank Name', 'Amount',
]

interface Props {
  onLogout: () => void
}

export default function DealsPage({ onLogout }: Props) {
  const [deals, setDeals] = useState<Deal[]>([])
  const [filter, setFilter] = useState('')
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    fetchDeals().then(setDeals).catch(console.error)
    connect()
    return () => wsRef.current?.close()
  }, [])

  function connect() {
    const ws = createWs()
    wsRef.current = ws

    ws.onmessage = (e: MessageEvent) => {
      const msg: WsDealMessage = JSON.parse(e.data)
      if (msg.event !== 'new_deal') return
      const deal: Deal = {
        id: msg.deal_id,
        ...msg.data,
        accepted_by: null,
        received_at: new Date().toISOString(),
      }
      setDeals(prev => [deal, ...prev])
    }

    ws.onclose = () => setTimeout(connect, 3000)
    ws.onerror = () => ws.close()
  }

  function handleAccepted(id: number) {
    setDeals(prev => prev.filter(d => d.id !== id))
  }

  const filtered = filter
    ? deals.filter(d =>
        String(d.uid).includes(filter) ||
        d.status.toLowerCase().includes(filter.toLowerCase()) ||
        d.to_name.toLowerCase().includes(filter.toLowerCase())
      )
    : deals

  return (
    <div className="flex min-h-screen bg-[#0b0e1b]">
      {/* Sidebar */}
      <aside className="w-14 bg-[#0e1120] flex flex-col items-center py-4 gap-3 border-r border-[#1a1f30] shrink-0">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-sm">G</div>
        <div className="flex-1 flex flex-col gap-2 mt-2">
          {['M', 'B', 'H', 'S', 'C', 'T'].map((icon, i) => (
            <div
              key={i}
              className="w-9 h-9 rounded-lg bg-[#141827] hover:bg-[#1e2235] flex items-center justify-center cursor-pointer transition text-gray-500 text-xs font-medium"
            >
              {icon}
            </div>
          ))}
        </div>
        <button
          onClick={onLogout}
          title="Logout"
          className="w-9 h-9 rounded-lg bg-[#141827] hover:bg-red-900/30 flex items-center justify-center transition"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" strokeLinecap="round" />
            <polyline points="16 17 21 12 16 7" strokeLinecap="round" strokeLinejoin="round" />
            <line x1="21" y1="12" x2="9" y2="12" strokeLinecap="round" />
          </svg>
        </button>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-14 bg-[#0e1120] border-b border-[#1a1f30] flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-4">
            <span className="text-white font-semibold">BPay</span>
            <div className="flex gap-1">
              <button className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition">End</button>
              <button className="bg-yellow-500 hover:bg-yellow-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition">Pause</button>
              <button className="bg-green-600 hover:bg-green-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition">Payout</button>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-green-400 text-xs font-semibold border border-green-500/30 bg-green-500/10 px-3 py-1 rounded-lg">
              {deals.length} active
            </span>
            <button
              onClick={() => fetchDeals().then(setDeals)}
              className="text-gray-500 hover:text-white transition text-xs"
            >
              ↻ Refresh
            </button>
          </div>
        </header>

        {/* Breadcrumb + filters */}
        <div className="px-6 pt-3 pb-2 shrink-0">
          <p className="text-gray-600 text-xs mb-3">Requests / <span className="text-gray-400">List</span></p>
          <div className="flex gap-2 flex-wrap">
            <input
              className="bg-[#141827] border border-[#1a1f30] rounded-lg px-3 py-1.5 text-xs text-gray-300 placeholder-gray-600 outline-none focus:border-blue-500/50 transition w-44"
              placeholder="Search by ID, status, currency…"
              value={filter}
              onChange={e => setFilter(e.target.value)}
            />
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto px-6 pb-6">
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 z-10 bg-[#0b0e1b]">
              <tr className="border-b border-[#1a1f30]">
                {COLUMNS.map(col => (
                  <th key={col} className="px-3 py-2.5 text-left text-gray-600 font-medium text-[11px] whitespace-nowrap">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={COLUMNS.length} className="text-center text-gray-700 py-20 text-sm">
                    No active deals
                  </td>
                </tr>
              ) : (
                filtered.map(deal => (
                  <DealRow key={deal.id} deal={deal} onAccepted={handleAccepted} />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
