import { useState, type FormEvent } from 'react'
import { login, register } from '../api'

interface Props {
  onLogin: (token: string) => void
}

export default function LoginPage({ onLogin }: Props) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const token = mode === 'login'
        ? await login(username, password)
        : await register(username, password)
      onLogin(token)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0b0e1b]">
      <div className="w-full max-w-sm bg-[#141827] rounded-2xl p-8 shadow-2xl border border-[#1e2235]">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-sm">G</div>
          <span className="text-white text-xl font-semibold">BPay</span>
        </div>

        <h2 className="text-white text-lg font-semibold mb-6">
          {mode === 'login' ? 'Sign In' : 'Register'}
        </h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            className="bg-[#0b0e1b] border border-[#1e2235] rounded-lg px-4 py-3 text-white placeholder-gray-600 outline-none focus:border-blue-500 transition text-sm"
            placeholder="Username"
            value={username}
            onChange={e => setUsername(e.target.value)}
            required
          />
          <input
            type="password"
            className="bg-[#0b0e1b] border border-[#1e2235] rounded-lg px-4 py-3 text-white placeholder-gray-600 outline-none focus:border-blue-500 transition text-sm"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />

          {error && <p className="text-red-400 text-xs">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-3 font-medium transition disabled:opacity-50 text-sm mt-1"
          >
            {loading ? 'Loading...' : mode === 'login' ? 'Sign In' : 'Register'}
          </button>
        </form>

        <p className="text-gray-600 text-xs text-center mt-4">
          {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <button
            className="text-blue-400 hover:text-blue-300 transition"
            onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}
          >
            {mode === 'login' ? 'Register' : 'Sign In'}
          </button>
        </p>
      </div>
    </div>
  )
}
