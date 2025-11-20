import { useEffect, useState } from 'react'
import { supabase } from "../lib/supabase"
import type { Project, Expense } from '../types'
import { useAuthStore } from '../store/authStore'

interface GroupedTotals {
  total: number
  alimentacao: number
  transporte: number
  outros: number
}

export default function ReportsPage() {
  const { profile } = useAuthStore()
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProject, setSelectedProject] = useState<string | 'all'>('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [loading, setLoading] = useState(false)
  const [totals, setTotals] = useState<GroupedTotals | null>(null)

  const isAdmin = profile?.role === 'admin'

  useEffect(() => {
    const loadProjects = async () => {
      const { data, error } = await supabase
        .from('obras')
        .select('*')
        .order('created_at', { ascending: false })

      if (!error && data) {
        setProjects(data as Project[])
      }
    }
    if (isAdmin) loadProjects()
  }, [isAdmin])

  const loadReport = async () => {
    setLoading(true)
    setTotals(null)

    let query = supabase.from('gastos').select('*')

    if (selectedProject !== 'all') {
      query = query.eq('project_id', selectedProject)
    }

    if (from) query = query.gte('date', from)
    if (to) query = query.lte('date', to)

    // só gastos aprovados
    query = query.eq('status', 'aprovado')

    const { data, error } = await query

    setLoading(false)

    if (error || !data) {
      console.error(error)
      return
    }

    const expenses = data as Expense[]

    const grouped: GroupedTotals = {
      total: 0,
      alimentacao: 0,
      transporte: 0,
      outros: 0,
    }

    for (const e of expenses) {
      grouped.total += e.amount
      if (e.type === 'alimentacao') grouped.alimentacao += e.amount
      else if (e.type === 'transporte') grouped.transporte += e.amount
      else grouped.outros += e.amount
    }

    setTotals(grouped)
  }

  if (!isAdmin) {
    return (
      <div className="p-6 text-white">
        Você não tem permissão para acessar os relatórios.
      </div>
    )
  }

  return (
    <div className="p-6 text-white space-y-4">
      <h1 className="text-2xl font-display text-marvil-orange">
        Relatórios Financeiros
      </h1>

      <div className="grid gap-4 md:grid-cols-4 max-w-5xl">
        <div className="space-y-1 md:col-span-2">
          <span className="text-sm text-gray-300">Obra</span>
          <select
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            className="w-full rounded bg-marvil-dark border border-marvil-border px-3 py-2 text-sm focus:outline-none focus:border-marvil-orange"
          >
            <option value="all">Todas</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} – {p.city}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <span className="text-sm text-gray-300">De</span>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="w-full rounded bg-marvil-dark border border-marvil-border px-3 py-2 text-sm focus:outline-none focus:border-marvil-orange"
          />
        </div>

        <div className="space-y-1">
          <span className="text-sm text-gray-300">Até</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="w-full rounded bg-marvil-dark border border-marvil-border px-3 py-2 text-sm focus:outline-none focus:border-marvil-orange"
          />
        </div>
      </div>

      <button
        onClick={loadReport}
        disabled={loading}
        className="inline-flex items-center justify-center rounded bg-marvil-orange px-4 py-2 text-sm font-medium text-black shadow-glow hover:shadow-glow-strong transition-shadow disabled:opacity-50"
      >
        {loading ? 'Carregando...' : 'Gerar relatório'}
      </button>

      {totals && (
        <div className="mt-4 grid gap-4 md:grid-cols-4 max-w-5xl">
          <div className="rounded bg-marvil-card border border-marvil-border p-4">
            <div className="text-xs text-gray-400">Total</div>
            <div className="text-xl font-semibold">
              R$ {totals.total.toFixed(2)}
            </div>
          </div>
          <div className="rounded bg-marvil-card border border-marvil-border p-4">
            <div className="text-xs text-gray-400">Alimentação</div>
            <div className="text-lg">
              R$ {totals.alimentacao.toFixed(2)}
            </div>
          </div>
          <div className="rounded bg-marvil-card border border-marvil-border p-4">
            <div className="text-xs text-gray-400">Transporte</div>
            <div className="text-lg">
              R$ {totals.transporte.toFixed(2)}
            </div>
          </div>
          <div className="rounded bg-marvil-card border border-marvil-border p-4">
            <div className="text-xs text-gray-400">Outros</div>
            <div className="text-lg">
              R$ {totals.outros.toFixed(2)}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
