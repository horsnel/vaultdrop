'use client'

import { APKVersion, GAME_COLORS } from '@/lib/types'
import { timeAgo } from '@/lib/api'

interface APKAlertCardProps {
  apk: APKVersion
}

export default function APKAlertCard({ apk }: APKAlertCardProps) {
  const gameColor = GAME_COLORS[apk.game] || '#6b7280'
  const detectedDate = new Date(apk.detected_at)
  const isNew = (Date.now() - detectedDate.getTime()) < 7 * 24 * 60 * 60 * 1000 // within 7 days

  return (
    <div className="card-glow rounded-xl bg-vault-card border border-vault-border p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className="px-2 py-0.5 rounded text-[10px] font-bold"
            style={{ backgroundColor: `${gameColor}20`, color: gameColor }}
          >
            {apk.game}
          </span>
          {apk.is_beta && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-neon-blue/20 text-neon-blue border border-neon-blue/30">
              BETA
            </span>
          )}
          {isNew && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-neon-green/20 text-neon-green border border-neon-green/30 animate-pulse">
              NEW
            </span>
          )}
        </div>
      </div>

      <div className="space-y-1">
        <div className="text-sm font-semibold text-slate-200">
          v{apk.version_name}
          <span className="text-xs text-slate-500 ml-2">({apk.version_code})</span>
        </div>
        <div className="text-xs text-slate-500 font-mono truncate">
          {apk.package_name}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <a
          href={apk.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-neon-purple hover:text-neon-blue transition-colors"
        >
          {apk.source} →
        </a>
        <span className="text-[10px] text-slate-600">{timeAgo(apk.detected_at)}</span>
      </div>
    </div>
  )
}
