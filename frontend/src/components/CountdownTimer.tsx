import { useEffect, useState } from 'react'

const DURATION = 120

interface Props {
  startedAt: string
}

export default function CountdownTimer({ startedAt }: Props) {
  function calc() {
    const diff = (Date.now() - new Date(startedAt).getTime()) / 1000
    return Math.max(0, DURATION - Math.min(diff, DURATION))
  }

  const [remaining, setRemaining] = useState(calc)

  useEffect(() => {
    const id = setInterval(() => setRemaining(calc()), 1000)
    return () => clearInterval(id)
  }, [startedAt])

  const circumference = 2 * Math.PI * 36
  const offset = circumference * (1 - remaining / DURATION)
  const color = remaining > 30 ? '#22c55e' : remaining > 10 ? '#eab308' : '#ef4444'
  const mins = Math.floor(remaining / 60)
  const secs = Math.floor(remaining % 60)

  return (
    <div className="relative w-[72px] h-[72px] flex items-center justify-center">
      <svg width="72" height="72" className="-rotate-90" style={{ position: 'absolute' }}>
        <circle cx="36" cy="36" r="30" fill="none" stroke="#1e2235" strokeWidth="4" />
        <circle
          cx="36" cy="36" r="30"
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.5s' }}
        />
      </svg>
      <span className="text-white font-semibold text-xs z-10">
        {mins}:{String(secs).padStart(2, '0')}
      </span>
    </div>
  )
}
