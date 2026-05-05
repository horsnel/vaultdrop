'use client'

import { useEffect, useState, useCallback } from 'react'
import APKAlertCard from '@/components/APKAlertCard'
import { APKVersion, GAMES, GAME_COLORS } from '@/lib/types'
import { fetchApkAlerts, timeAgo } from '@/lib/api'

const GAME_TABS = ['All', ...GAMES.map((g) => g.name)]

export default function APKPage() {
  const [apks, setApks] = useState<APKVersion[]>([])
  const [activeGame, setActiveGame] = useState('All')
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid')

  const loadApks = useCallback(async () => {
    setLoading(true)
    try {
      const game = activeGame === 'All' ? undefined : activeGame
      const data = await fetchApkAlerts(game)
      setApks(data)
    } catch (err) {
      console.error('Failed to load APK alerts:', err)
    } finally {
      setLoading(false)
    }
  }, [activeGame])

  useEffect(() => {
    loadApks()
  }, [loadApks])

  // Group by game for table view
  const groupedByGame = apks.reduce<Record<string, APKVersion[]>>((acc, apk) => {
    if (!acc[apk.game]) acc[apk.game] = []
    acc[apk.game].push(apk)
    return acc
  }, {})

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-black gradient-text">APK Monitor</h1>
        <p className="text-slate-400 text-sm">
          Track version changes across all monitored games. Alerts are updated in real-time.
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
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

        {/* View Mode Toggle */}
        <div className="flex items-center gap-1 bg-vault-card border border-vault-border rounded-lg p-1">
          <button
            onClick={() => setViewMode('grid')}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
              viewMode === 'grid' ? 'bg-neon-purple/20 text-neon-purple' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Grid
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
              viewMode === 'table' ? 'bg-neon-purple/20 text-neon-purple' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Table
          </button>
        </div>
      </div>

      {/* Last checked */}
      {apks.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <div className="w-1.5 h-1.5 rounded-full bg-neon-green animate-pulse" />
          Last updated: {timeAgo(apks[0]?.detected_at || new Date().toISOString())}
        </div>
      )}

      {/* Content */}
      {loading ? (
        viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="skeleton rounded-xl h-32" />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="skeleton rounded-xl h-16" />
            ))}
          </div>
        )
      ) : viewMode === 'grid' ? (
        /* Grid View */
        apks.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {apks.map((apk) => (
              <APKAlertCard key={apk.id} apk={apk} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 space-y-3">
            <div className="text-4xl opacity-30">📦</div>
            <p className="text-slate-500">No APK alerts found</p>
          </div>
        )
      ) : (
        /* Table View */
        Object.keys(groupedByGame).length > 0 ? (
          <div className="space-y-6">
            {Object.entries(groupedByGame).map(([game, versions]) => {
              const gameColor = GAME_COLORS[game] || '#6b7280'
              return (
                <div key={game} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span
                      className="px-2 py-0.5 rounded text-xs font-bold"
                      style={{ backgroundColor: `${gameColor}20`, color: gameColor }}
                    >
                      {game}
                    </span>
                    <span className="text-xs text-slate-500">{versions.length} version(s)</span>
                  </div>
                  <div className="rounded-xl bg-vault-card border border-vault-border overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-vault-border">
                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">Version</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">Code</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 hidden sm:table-cell">Package</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">Source</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">Status</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">Detected</th>
                          </tr>
                        </thead>
                        <tbody>
                          {versions.map((apk) => {
                            const isNew = (Date.now() - new Date(apk.detected_at).getTime()) < 7 * 24 * 60 * 60 * 1000
                            return (
                              <tr key={apk.id} className="border-b border-vault-border/50 hover:bg-white/[0.02] transition-colors">
                                <td className="px-4 py-3 font-medium text-slate-200">{apk.version_name}</td>
                                <td className="px-4 py-3 text-slate-400 font-mono text-xs">{apk.version_code}</td>
                                <td className="px-4 py-3 text-slate-500 font-mono text-xs hidden sm:table-cell">{apk.package_name}</td>
                                <td className="px-4 py-3">
                                  <a
                                    href={apk.source_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-neon-purple hover:text-neon-blue transition-colors"
                                  >
                                    {apk.source}
                                  </a>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    {apk.is_beta && (
                                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-neon-blue/20 text-neon-blue border border-neon-blue/30">
                                        BETA
                                      </span>
                                    )}
                                    {isNew && (
                                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-neon-green/20 text-neon-green border border-neon-green/30 animate-pulse">
                                        NEW
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-xs text-slate-500">{timeAgo(apk.detected_at)}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-16 space-y-3">
            <div className="text-4xl opacity-30">📦</div>
            <p className="text-slate-500">No APK alerts found</p>
          </div>
        )
      )}
    </div>
  )
}
