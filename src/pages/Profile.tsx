import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { useAuthStore } from '../store/authStore'
import type { Profile } from '../types'

export default function ProfilePage() {
  const { profile, setProfile } = useAuthStore()
  const [form, setForm] = useState<Partial<Profile>>({})
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (profile) setForm(profile)
  }, [profile])

  const handleChange = (field: keyof Profile, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSave = async () => {
    if (!profile) return
    setSaving(true)
    setMessage(null)

    const { error, data } = await supabase
      .from('users_profiles')
      .update({
        full_name: form.full_name,
        phone: form.phone,
      })
      .eq('id', profile.id)
      .select('*')
      .single()

    setSaving(false)

    if (error) {
      console.error(error)
      setMessage('Erro ao salvar perfil.')
      return
    }

    setProfile(data as Profile)
    setMessage('Perfil atualizado com sucesso!')
  }

  if (!profile) {
    return <div className="p-6 text-white">Carregando perfil...</div>
  }

  return (
    <div className="p-6 text-white space-y-4">
      <h1 className="text-2xl font-display text-marvil-orange">Meu Perfil</h1>

      {message && (
        <div className="rounded border border-marvil-orange/60 bg-marvil-card/40 px-3 py-2 text-sm">
          {message}
        </div>
      )}

      <div className="grid gap-4 max-w-lg">
        <label className="space-y-1">
          <span className="text-sm text-gray-300">Nome completo</span>
          <input
            className="w-full rounded bg-marvil-dark border border-marvil-border px-3 py-2 text-sm focus:outline-none focus:border-marvil-orange"
            value={form.full_name ?? ''}
            onChange={(e) => handleChange('full_name', e.target.value)}
          />
        </label>

        <label className="space-y-1">
          <span className="text-sm text-gray-300">Telefone</span>
          <input
            className="w-full rounded bg-marvil-dark border border-marvil-border px-3 py-2 text-sm focus:outline-none focus:border-marvil-orange"
            value={form.phone ?? ''}
            onChange={(e) => handleChange('phone', e.target.value)}
          />
        </label>

        <label className="space-y-1">
          <span className="text-sm text-gray-300">E-mail (somente leitura)</span>
          <input
            className="w-full rounded bg-marvil-dark border border-marvil-border px-3 py-2 text-sm opacity-70 cursor-not-allowed"
            value={profile.email}
            disabled
          />
        </label>

        <button
          onClick={handleSave}
          disabled={saving}
          className="mt-2 inline-flex items-center justify-center rounded bg-marvil-orange px-4 py-2 text-sm font-medium text-black shadow-glow hover:shadow-glow-strong transition-shadow disabled:opacity-50"
        >
          {saving ? 'Salvando...' : 'Salvar alterações'}
        </button>
      </div>
    </div>
  )
}
