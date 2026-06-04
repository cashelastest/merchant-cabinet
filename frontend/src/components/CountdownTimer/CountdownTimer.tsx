import { useState, useEffect } from 'react';
import styles from './CountdownTimer.module.css';

const ESTIMATE = 120;

interface Props {
  receivedAt: string | null;
  isActive: boolean;
}

function toUtcMs(receivedAt: string): number {
  // Ensure the datetime is parsed as UTC even without 'Z' suffix
  const s = receivedAt.endsWith('Z') || receivedAt.includes('+') ? receivedAt : receivedAt + 'Z';
  return new Date(s).getTime();
}

function getSecondsLeft(receivedAt: string | null): number {
  if (!receivedAt) return 0;
  const elapsed = (Date.now() - toUtcMs(receivedAt)) / 1000;
  return Math.max(0, Math.floor(ESTIMATE - elapsed));
}

export default function CountdownTimer({ receivedAt, isActive }: Props) {
  const [secondsLeft, setSecondsLeft] = useState(() => getSecondsLeft(receivedAt));

  useEffect(() => {
    if (!isActive) { setSecondsLeft(0); return; }
    setSecondsLeft(getSecondsLeft(receivedAt));
    const id = setInterval(() => setSecondsLeft(getSecondsLeft(receivedAt)), 1000);
    return () => clearInterval(id);
  }, [receivedAt, isActive]);

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;

  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const progress = secondsLeft / ESTIMATE;
  const dashOffset = circumference * (1 - progress);
  const expired = secondsLeft === 0;
  const strokeColor = expired ? '#ef4444' : '#4ade80';

  return (
    <div className={styles.wrapper}>
      <svg viewBox="0 0 100 100" width="76" height="76">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="#1a1a1a" strokeWidth="7" />
        <circle
          cx="50" cy="50" r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth="7"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          transform="rotate(-90 50 50)"
        />
        <text
          x="50" y="55"
          textAnchor="middle"
          fill="#ffffff"
          fontSize="17"
          fontWeight="bold"
          fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
        >
          {timeStr}
        </text>
      </svg>
    </div>
  );
}
