'use client'

import { AdvanceServer, GAME_COLORS } from '@/lib/types'
import { timeAgo } from '@/lib/api'

interface AdvanceServerCardProps {
  server: AdvanceServer
}

const STATUS_CONFIG: Record<string, { color: string; bg: string; border: string; label: string }> = {
  open: { color: '#10b981', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.3)', label: 'OPEN' },
  active: { color: '#10b981', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.3)', label: 'ACTIVE' },
  closed: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.3)', label: 'CLOSED' },
  rumored: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.3)', label: 'RUMORED' },
}

export default function AdvanceServerCard({ server }: AdvanceServerCardProps) {
  const gameColor = GAME_COLORS[server.game] || '#6b7280'
  const statusKey = server.status?.toLowerCase() || 'rumored'
  const statusConfig = STATUS_CONFIG[statusKey] || STATUS_CONFIG.rumored

  return (
    <div className="card-glow rounded-xl bg-vault-card border border-vault-border p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className="px-2 py-0.5 rounded text-[10px] font-bold"
            style={{ backgroundColor: `${gameColor}20`, color: gameColor }}
          >
            {server.game}
          </span>
        </div>
        <span
          className="px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1"
          style={{
            backgroundColor: statusConfig.bg,
            color: statusConfig.color,
            border: `1px solid ${statusConfig.border}`,
          }}
        >
          {(statusKey === 'open' || statusKey === 'active') && (
            <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: statusConfig.color }} />
          )}
          {statusConfig.label}
        </span>
      </div>

      <div className="space-y-1">
        <div className="text-sm font-semibold text-slate-200">{server.server_name}</div>
        {server.notes && (
          <div className="text-xs text-slate-500">{server.notes}</div>
        )}
      </div>

      <div className="flex items-center justify-between">
        {server.registration_url ? (
          <a
            href={server.registration_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-neon-green hover:text-neon-blue transition-colors"
          >
            Register Now →
          </a>
        ) : (
          <span className="text-xs text-slate-600">No registration link</span>
        )}
        <span className="text-[10px] text-slate-600">{timeAgo(server.detected_at)}</span>
      </div>
    </div>
  )
}
