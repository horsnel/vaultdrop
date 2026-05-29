'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import LeakCard from '@/components/LeakCard'
import APKAlertCard from '@/components/APKAlertCard'
import AdvanceServerCard from '@/components/AdvanceServerCard'
import GameSelector from '@/components/GameSelector'
import { Leak, APKVersion, AdvanceServer, Clip, ContentStats } from '@/lib/types'
import { fetchLeaks, fetchApkAlerts, fetchAdvanceServers, fetchClips, fetchStats, timeAgo } from '@/lib/api'

function Skeleton({ className }: { className?: string }) {
  return <div className={`skeleton rounded-lg ${className || ''}`} />
}

export default function HomePage() {
  const [leaks, setLeaks] = useState<Leak[]>([])
  const [apkAlerts, setApkAlerts] = useState<APKVersion[]>([])
  const [servers, setServers] = useState<AdvanceServer[]>([])
  const [clips, setClips] = useState<Clip[]>([])
  const [stats, setStats] = useState<ContentStats | null>(null)
  const [selectedGame, setSelectedGame] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      try {
        const [leaksData, apkData, serverData, clipsData, statsData] = await Promise.allSettled([
          fetchLeaks(selectedGame || undefined, undefined, 8),
          fetchApkAlerts(selectedGame || undefined),
          fetchAdvanceServers(selectedGame || undefined),
          fetchClips(selectedGame || undefined, 6),
          fetchStats(),
        ])

        if (leaksData.status === 'fulfilled') setLeaks(leaksData.value)
        if (apkData.status === 'fulfilled') setApkAlerts(apkData.value)
        if (serverData.status === 'fulfilled') setServers(serverData.value)
        if (clipsData.status === 'fulfilled') setClips(clipsData.value)
        if (statsData.status === 'fulfilled') setStats(statsData.value)
      } catch (err) {
        console.error('Failed to load data:', err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [selectedGame])

  return (
    <div className="space-y-12">
      {/* Hero */}
      <section className="relative overflow-hidden py-16 sm:py-24">
        <div className="absolute inset-0 bg-gradient-radial from-neon-purple/5 via-transparent to-transparent" />
        <div className="relative max-w-7xl mx-auto px-4 text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-neon-purple/10 border border-neon-purple/20 text-neon-purple text-xs font-medium">
            <div className="w-2 h-2 rounded-full bg-neon-green animate-pulse" />
            Live Monitoring
          </div>
          <h1 className="text-5xl sm:text-7xl font-black gradient-text-animated">
            VaultDrop
          </h1>
          <p className="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto">
            First-Mover Gaming Intelligence — Real-time leaks, APK alerts, advance server tracking, and more.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href="/leaks"
              className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-neon-purple to-neon-blue text-white font-semibold text-sm hover:shadow-neon-purple transition-all hover:scale-105"
            >
              Browse Leaks
            </Link>
            <Link
              href="/apk"
              className="px-6 py-2.5 rounded-lg bg-vault-card border border-vault-border text-slate-300 font-semibold text-sm hover:border-neon-purple/30 transition-all"
            >
              APK Monitor
            </Link>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      {stats && (
        <section className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total Leaks', value: stats.leaks, color: '#8b5cf6' },
              { label: 'Clips', value: stats.clips, color: '#3b82f6' },
              { label: 'APK Alerts', value: stats.apk_versions, color: '#10b981' },
              { label: 'Advance Servers', value: stats.advance_servers, color: '#f59e0b' },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl bg-vault-card border border-vault-border p-4 text-center card-glow"
              >
                <div className="text-2xl font-black" style={{ color: stat.color }}>
                  {stat.value?.toLocaleString() || '—'}
                </div>
                <div className="text-xs text-slate-500 mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Game Selector */}
      <section className="max-w-7xl mx-auto px-4 space-y-4">
        <h2 className="text-xl font-bold text-slate-200">Select Game</h2>
        <GameSelector selectedGame={selectedGame} onGameChange={setSelectedGame} />
      </section>

      {/* APK Alerts */}
      <section className="max-w-7xl mx-auto px-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-200 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-neon-green animate-pulse" />
            Live APK Alerts
          </h2>
          <Link href="/apk" className="text-xs text-neon-purple hover:text-neon-blue transition-colors">
            View all →
          </Link>
        </div>
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        ) : apkAlerts.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {apkAlerts.slice(0, 4).map((apk) => (
              <APKAlertCard key={apk.id} apk={apk} />
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-slate-600 text-sm">No APK alerts found</div>
        )}
      </section>

      {/* Advance Server Status */}
      <section className="max-w-7xl mx-auto px-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-200 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-neon-purple animate-pulse" />
            Advance Server Status
          </h2>
          <Link href="/advance-server" className="text-xs text-neon-purple hover:text-neon-blue transition-colors">
            View all →
          </Link>
        </div>
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-40" />
            ))}
          </div>
        ) : servers.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {servers.slice(0, 4).map((server) => (
              <AdvanceServerCard key={server.id} server={server} />
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-slate-600 text-sm">No advance server data found</div>
        )}
      </section>

      {/* Latest Leaks */}
      <section className="max-w-7xl mx-auto px-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-200">Latest Leaks</h2>
          <Link href="/leaks" className="text-xs text-neon-purple hover:text-neon-blue transition-colors">
            View all →
          </Link>
        </div>
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="aspect-video" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        ) : leaks.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {leaks.map((leak) => (
              <LeakCard key={leak.id} leak={leak} />
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-slate-600 text-sm">No leaks found</div>
        )}
      </section>

      {/* Trending Clips */}
      <section className="max-w-7xl mx-auto px-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-200">Trending Clips</h2>
          <Link href="/leaks" className="text-xs text-neon-purple hover:text-neon-blue transition-colors">
            View all →
          </Link>
        </div>
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="aspect-video" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ))}
          </div>
        ) : clips.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {clips.map((clip) => (
              <div key={clip.id} className="card-glow rounded-xl bg-vault-card border border-vault-border overflow-hidden group">
                <div className="relative aspect-video overflow-hidden">
                  {clip.thumbnail_url ? (
                    <img
                      src={clip.thumbnail_url}
                      alt={clip.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full img-fallback flex items-center justify-center">
                      <div className="text-4xl opacity-30">🎬</div>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
                      <svg className="w-6 h-6 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                  </div>
                </div>
                <div className="p-4 space-y-2">
                  <h3 className="text-sm font-semibold text-slate-200 line-clamp-1">{clip.title}</h3>
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z" /><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" /></svg>
                      {clip.views?.toLocaleString() || 0}
                    </span>
                    <span className="flex items-center gap-1">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" /></svg>
                      {clip.likes?.toLocaleString() || 0}
                    </span>
                    <span>{timeAgo(clip.created_at)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-slate-600 text-sm">No clips found</div>
        )}
      </section>
    </div>
  )
}
