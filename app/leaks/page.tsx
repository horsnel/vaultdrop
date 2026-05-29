'use client'

import { useEffect, useState, useCallback } from 'react'
import LeakCard from '@/components/LeakCard'
import CategoryFilter from '@/components/CategoryFilter'
import { Leak, LeakCategory, GAMES, GAME_COLORS } from '@/lib/types'
import { fetchLeaks, fetchLeakCategories } from '@/lib/api'

const GAME_TABS = ['All', ...GAMES.map((g) => g.name)]

export default function LeaksPage() {
  const [leaks, setLeaks] = useState<Leak[]>([])
  const [categories, setCategories] = useState<LeakCategory[]>([])
  const [activeCategory, setActiveCategory] = useState('all')
  const [activeGame, setActiveGame] = useState('All')
  const [loading, setLoading] = useState(true)
  const [limit, setLimit] = useState(20)

  const loadLeaks = useCallback(async () => {
    setLoading(true)
    try {
      const game = activeGame === 'All' ? undefined : activeGame
      const category = activeCategory === 'all' ? undefined : activeCategory
      const data = await fetchLeaks(game, category, limit)
      setLeaks(data)
    } catch (err) {
      console.error('Failed to load leaks:', err)
    } finally {
      setLoading(false)
    }
  }, [activeGame, activeCategory, limit])

  const loadCategories = useCallback(async () => {
    try {
      const data = await fetchLeakCategories()
      setCategories(data)
    } catch (err) {
      console.error('Failed to load categories:', err)
    }
  }, [])

  useEffect(() => {
    loadCategories()
  }, [loadCategories])

  useEffect(() => {
    loadLeaks()
  }, [loadLeaks])

  const handleCategoryChange = (category: string) => {
    setActiveCategory(category)
    setLimit(20)
  }

  const handleGameChange = (game: string) => {
    setActiveGame(game)
    setLimit(20)
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-black gradient-text">Leaks</h1>
        <p className="text-slate-400 text-sm">
          Real-time gaming leaks, datamines, and exclusive content from across the community.
        </p>
      </div>

      {/* Game Filter Tabs */}
      <div className="flex overflow-x-auto scrollbar-hide gap-2 pb-2">
        {GAME_TABS.map((game) => {
          const isActive = activeGame === game
          const color = game === 'All' ? '#8b5cf6' : (GAME_COLORS[game] || '#6b7280')

          return (
            <button
              key={game}
              onClick={() => handleGameChange(game)}
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

      {/* Category Filter */}
      <CategoryFilter
        categories={categories}
        activeCategory={activeCategory}
        onCategoryChange={handleCategoryChange}
      />

      {/* Leak Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="space-y-3">
              <div className="skeleton aspect-video rounded-xl" />
              <div className="skeleton h-4 w-3/4 rounded" />
              <div className="skeleton h-3 w-1/2 rounded" />
            </div>
          ))}
        </div>
      ) : leaks.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {leaks.map((leak) => (
            <LeakCard key={leak.id} leak={leak} />
          ))}
        </div>
      ) : (
        <div className="text-center py-16 space-y-3">
          <div className="text-4xl opacity-30">🔍</div>
          <p className="text-slate-500">No leaks found for this filter combination</p>
          <button
            onClick={() => {
              setActiveCategory('all')
              setActiveGame('All')
            }}
            className="text-sm text-neon-purple hover:text-neon-blue transition-colors"
          >
            Reset filters
          </button>
        </div>
      )}

      {/* Load More */}
      {leaks.length >= limit && (
        <div className="text-center pt-4">
          <button
            onClick={() => setLimit((prev) => prev + 20)}
            disabled={loading}
            className="px-6 py-2.5 rounded-lg bg-vault-card border border-vault-border text-slate-300 font-semibold text-sm hover:border-neon-purple/30 transition-all disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Load More'}
          </button>
        </div>
      )}
    </div>
  )
}
