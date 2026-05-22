import { useState } from 'react'
import type { FormEvent } from 'react'
import { API_BASE } from '../../lib/config'
import { useAuth } from '../../context/AuthContext'

const AdminSettingsPage = () => {
  const { token, refreshUser, user } = useAuth()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setMessage(null)
    setError(null)

    if (newPassword !== confirmPassword) {
      setError('New password and confirm password do not match.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/settings/password`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload?.error || 'Failed to update password')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setMessage('Password changed successfully.')
      await refreshUser()
    } catch (err: any) {
      setError(err?.message || 'Failed to update password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100">Admin Settings</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
          Manage your platform admin authentication credentials.
        </p>
      </div>

      {user?.mustChangePassword && (
        <div className="rounded-xl bg-amber-50 text-amber-800 px-4 py-3 text-sm font-semibold">
          Security action required: change the temporary admin password before continuing platform operations.
        </div>
      )}

      {message && <div className="rounded-xl bg-emerald-50 text-emerald-700 px-4 py-3 text-sm font-semibold">{message}</div>}
      {error && <div className="rounded-xl bg-red-50 text-red-700 px-4 py-3 text-sm font-semibold">{error}</div>}

      <form onSubmit={submit} className="max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
        <Field
          label="Current Password"
          value={currentPassword}
          onChange={setCurrentPassword}
          type="password"
        />
        <Field
          label="New Password"
          value={newPassword}
          onChange={setNewPassword}
          type="password"
        />
        <Field
          label="Confirm New Password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          type="password"
        />
        <button
          disabled={loading}
          className="rounded-xl bg-slate-900 text-white px-5 py-2.5 text-xs font-black uppercase tracking-wider disabled:opacity-60"
        >
          {loading ? 'Updating...' : 'Update Password'}
        </button>
      </form>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  type,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type: string
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-black uppercase tracking-wider text-slate-500">{label}</span>
      <input
        type={type}
        value={value}
        onChange={event => onChange(event.target.value)}
        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm"
        required
      />
    </label>
  )
}

export default AdminSettingsPage
