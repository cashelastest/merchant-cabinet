import { useState, useRef } from 'react'
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
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleAccept() {
    setLoading(true)
    try {
      await acceptDeal(deal.id)
      onAccepted(deal.id)
    } finally {
      setLoading(false)
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(`/api/v1/deal/${deal.id}/receipt`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.merchantToken}` },
        body: formData,
      })
      if (!res.ok) throw new Error('Upload failed')
      window.location.reload()
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
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
      <td className="px-3 py-3">
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileUpload}
            style={{ display: 'none' }}
            accept=".pdf,.jpg,.jpeg,.png,.gif"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            title="Upload receipt"
            className="px-2 py-1 rounded text-xs bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50 transition"
          >
            {uploading ? '⏳' : '📎'}
          </button>
          {deal.receipt_url && (
            <a
              href={deal.receipt_url}
              target="_blank"
              rel="noopener noreferrer"
              title="View receipt"
              className="px-2 py-1 rounded text-xs bg-blue-600 hover:bg-blue-700 text-white transition"
            >
              👁️
            </a>
          )}
        </div>
      </td>
    </tr>
  )
}
