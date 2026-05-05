'use client'

import { useEffect, useState, useCallback } from 'react'
import AdvanceServerCard from '@/components/AdvanceServerCard'
import { AdvanceServer, GAMES, GAME_COLORS } from '@/lib/types'
import { fetchAdvanceServers, timeAgo } from '@/lib/api'

const GAME_TABS = ['All', ...GAMES.map((g) => g.name)]

export default function AdvanceServerPage() {
  const [servers, setServers] = useState<AdvanceServer[]>([])
  const [activeGame, setActiveGame] = useState('All')
  const [loading, setLoading] = useState(true)

  const loadServers = useCallback(async () => {
    setLoading(true)
    try {
      const game = activeGame === 'All' ? undefined : activeGame
      const data = await fetchAdvanceServers(game)
      setServers(data)
    } catch (err) {
      console.error('Failed to load advance servers:', err)
    } finally {
      setLoading(false)
    }
  }, [activeGame])

  useEffect(() => {
    loadServers()
  }, [loadServers])

  // Stats
  const openCount = servers.filter((s) => s.status?.toLowerCase() === 'open' || s.status?.toLowerCase() === 'active').length
  const closedCount = servers.filter((s) => s.status?.toLowerCase() === 'closed').length
  const rumoredCount = servers.filter((s) => s.status?.toLowerCase() === 'rumored').length

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-black gradient-text">Advance Server Tracker</h1>
        <p className="text-slate-400 text-sm">
          Monitor advance/beta server registration windows across all games. Never miss an opening.
        </p>
      </div>

      {/* Status Overview */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-vault-card border border-vault-border p-4 text-center card-glow">
          <div className="text-2xl font-black text-neon-green">{openCount}</div>
          <div className="text-xs text-slate-500 mt-1">Open / Active</div>
        </div>
        <div className="rounded-xl bg-vault-card border border-vault-border p-4 text-center card-glow">
          <div className="text-2xl font-black text-neon-red">{closedCount}</div>
          <div className="text-xs text-slate-500 mt-1">Closed</div>
        </div>
        <div className="rounded-xl bg-vault-card border border-vault-border p-4 text-center card-glow">
          <div className="text-2xl font-black text-neon-gold">{rumoredCount}</div>
          <div className="text-xs text-slate-500 mt-1">Rumored</div>
        </div>
      </div>

      {/* Game Filter */}
      <div className="flex overflow-x-auto scrollbar-hide gap-2 pb-2">
        {GAME_TABS.map((game) => {
          const isActive = activeGame === game
          const color = game === 'All' ? '#8b5cf6' : (GAME_COLORS[game] || '#6b7280')

          return (
            <button
              key={game}
              onClick={() => setActiveGame(game)}
              className={`
                flex-shrink-0 px-4 py-2 rounded-lg text-sm font-semibold transition-all
                ${isActive
                  ? 'text-white'
                  : 'text-slate-400 bg-vault-card border border-vault-border hover:text-slate-200 hover:border-vault-border-light'
                }
              `}
              style={isActive ? {
                backgroundColor: `${color}20`,
                border: `1px solid ${color}40`,
                color: color,
                boxShadow: `0 0 12px ${color}25`,
              } : {}}
            >
              {game}
            </button>
          )
        })}
      </div>

      {/* Last checked */}
      {servers.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <div className="w-1.5 h-1.5 rounded-full bg-neon-green animate-pulse" />
          Last checked: {timeAgo(servers[0]?.detected_at || new Date().toISOString())}
        </div>
      )}

      {/* Server Cards */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="skeleton rounded-xl h-40" />
          ))}
        </div>
      ) : servers.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {servers.map((server) => (
            <AdvanceServerCard key={server.id} server={server} />
          ))}
        </div>
      ) : (
        <div className="text-center py-16 space-y-3">
          <div className="text-4xl opacity-30">🖥️</div>
          <p className="text-slate-500">No advance server data found</p>
        </div>
      )}

      {/* Hashtag Monitoring Info */}
      <div className="rounded-xl bg-vault-card border border-vault-border p-6 space-y-4">
        <h2 className="text-lg font-bold text-slate-200">How We Track Servers</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-slate-300">
              <div className="w-6 h-6 rounded-full bg-neon-purple/20 flex items-center justify-center">
                <svg className="w-3 h-3 text-neon-purple" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              Social media hashtag monitoring
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-300">
              <div className="w-6 h-6 rounded-full bg-neon-purple/20 flex items-center justify-center">
                <svg className="w-3 h-3 text-neon-purple" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              Official announcements & patch notes
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-300">
              <div className="w-6 h-6 rounded-full bg-neon-purple/20 flex items-center justify-center">
                <svg className="w-3 h-3 text-neon-purple" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              Community Discord channels
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-slate-300">
              <div className="w-6 h-6 rounded-full bg-neon-purple/20 flex items-center justify-center">
                <svg className="w-3 h-3 text-neon-purple" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              App store version monitoring
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-300">
              <div className="w-6 h-6 rounded-full bg-neon-purple/20 flex items-center justify-center">
                <svg className="w-3 h-3 text-neon-purple" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              Reddit & forum scraping
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-300">
              <div className="w-6 h-6 rounded-full bg-neon-purple/20 flex items-center justify-center">
                <svg className="w-3 h-3 text-neon-purple" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              Automated change detection
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
