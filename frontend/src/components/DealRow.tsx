import { useState } from 'react'
import type { Deal } from '../types'
import { acceptDeal } from '../api'
import CountdownTimer from './CountdownTimer'

interface Props {
  deal: Deal
  onAccepted: (id: number) => void
}

function StatusBadge({ status }: { status: string }) {
  const s = status.toUpperCase()
  const cls =
    s === 'ACTIVE'   ? 'bg-green-500/20 text-green-400 border-green-500/30' :
    s === 'ACCEPTED' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
                       'bg-red-500/20 text-red-400 border-red-500/30'
  return (
    <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${cls}`}>{s}</span>
  )
}

export default function DealRow({ deal, onAccepted }: Props) {
  const [loading, setLoading] = useState(false)

  async function handleAccept() {
    setLoading(true)
    try {
      await acceptDeal(deal.id)
      onAccepted(deal.id)
    } finally {
      setLoading(false)
    }
  }

  const v = deal.to_values
  const timerStart = deal.received_at ?? deal.created_at

  return (
    <tr className="border-b border-[#1a1f30] hover:bg-[#141827]/60 transition">
      <td className="px-3 py-3">
        {deal.accepted_by == null ? (
          <button
            onClick={handleAccept}
            disabled={loading}
            title="Accept"
            className="w-9 h-9 rounded-full bg-blue-600 hover:bg-blue-500 flex items-center justify-center transition disabled:opacity-40"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
              <path d="M8 5v14l11-7z" />
            </svg>
          </button>
        ) : (
          <div className="w-9 h-9 rounded-full bg-[#1e2235] flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5">
              <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        )}
      </td>
      <td className="px-3 py-3">
        <CountdownTimer startedAt={timerStart ?? new Date().toISOString()} />
      </td>
      <td className="px-3 py-3 text-gray-400 font-mono text-[11px] max-w-[130px]">
        <span className="truncate block" title={String(deal.uid)}>{deal.uid}</span>
      </td>
      <td className="px-3 py-3"><StatusBadge status={deal.status} /></td>
      <td className="px-3 py-3 text-gray-300 text-xs">{deal.to_name}</td>
      <td className="px-3 py-3 text-gray-300 text-xs">{v.cardHolder ?? '—'}</td>
      <td className="px-3 py-3 text-gray-400 font-mono text-xs">{v.cardNumber ?? '—'}</td>
      <td className="px-3 py-3 text-gray-300 text-xs">{v.phoneNumber ?? '—'}</td>
      <td className="px-3 py-3 text-gray-300 text-xs">{v.bankName ?? '—'}</td>
      <td className="px-3 py-3 text-white font-semibold text-sm">
        {v.outAmount != null ? Number(v.outAmount).toLocaleString() : '—'}
      </td>
    </tr>
  )
}
