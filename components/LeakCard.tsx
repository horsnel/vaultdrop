'use client'

import { Leak, CATEGORY_COLORS, GAME_COLORS } from '@/lib/types'
import { timeAgo } from '@/lib/api'
import { useState } from 'react'

interface LeakCardProps {
  leak: Leak
}

export default function LeakCard({ leak }: LeakCardProps) {
  const [imgError, setImgError] = useState(false)
  const categoryColor = CATEGORY_COLORS[leak.category] || '#6b7280'
  const gameColor = GAME_COLORS[leak.game] || '#6b7280'

  return (
    <div className="card-glow rounded-xl bg-vault-card border border-vault-border overflow-hidden group">
      {/* Thumbnail */}
      <div className="relative aspect-video overflow-hidden">
        {leak.thumbnail_url && !imgError ? (
          <img
            src={leak.thumbnail_url}
            alt={leak.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={() => setImgError(true)}
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full img-fallback flex items-center justify-center">
            <div className="text-4xl opacity-30">🎮</div>
          </div>
        )}

        {/* Severity indicator */}
        {leak.severity === 'high' && (
          <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/20 border border-red-500/30">
            <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-[10px] font-semibold text-red-400 uppercase">High</span>
          </div>
        )}

        {/* Verified badge */}
        {leak.is_verified && (
          <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-neon-green/20 border border-neon-green/30">
            <svg className="w-3 h-3 text-neon-green" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            <span className="text-[10px] font-semibold text-neon-green">Verified</span>
          </div>
        )}

        {/* Category badge */}
        <div className="absolute bottom-2 left-2">
          <span
            className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase"
            style={{
              backgroundColor: `${categoryColor}20`,
              color: categoryColor,
              border: `1px solid ${categoryColor}40`,
            }}
          >
            {leak.category}
          </span>
        </div>

        {/* Media download button */}
        {leak.media_url && (
          <a
            href={leak.media_url}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute bottom-2 right-2 p-1.5 rounded-lg bg-black/50 hover:bg-black/70 text-white transition-all opacity-0 group-hover:opacity-100"
            title="View media"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </a>
        )}
      </div>

      {/* Content */}
      <div className="p-4 space-y-2">
        {/* Game badge */}
        <div className="flex items-center gap-2">
          <span
            className="px-2 py-0.5 rounded text-[10px] font-bold"
            style={{
              backgroundColor: `${gameColor}20`,
              color: gameColor,
            }}
          >
            {leak.game}
          </span>
          <span className="text-[10px] text-slate-600">•</span>
          <span className="text-[10px] text-slate-500">{leak.source_name}</span>
        </div>

        {/* Title */}
        <h3 className="text-sm font-semibold text-slate-200 line-clamp-2 group-hover:text-white transition-colors">
          {leak.title}
        </h3>

        {/* AI Caption */}
        {leak.ai_caption && (
          <p className="text-xs text-slate-500 line-clamp-2">{leak.ai_caption}</p>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-1">
          <a
            href={leak.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-neon-purple hover:text-neon-blue transition-colors"
          >
            View source →
          </a>
          <span className="text-[10px] text-slate-600">{timeAgo(leak.created_at)}</span>
        </div>
      </div>
    </div>
  )
}
