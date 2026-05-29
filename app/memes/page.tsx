'use client'

import { useEffect, useState, useCallback } from 'react'
import { Meme, GAMES, GAME_COLORS } from '@/lib/types'
import { fetchMemes } from '@/lib/api'

const GAME_TABS = ['All', ...GAMES.map((g) => g.name)]

export default function MemesPage() {
  const [memes, setMemes] = useState<Meme[]>([])
  const [activeGame, setActiveGame] = useState('All')
  const [loading, setLoading] = useState(true)
  const [expandedMeme, setExpandedMeme] = useState<number | null>(null)
  const [limit, setLimit] = useState(30)

  const loadMemes = useCallback(async () => {
    setLoading(true)
    try {
      const game = activeGame === 'All' ? undefined : activeGame
      const data = await fetchMemes(game, limit)
      setMemes(data)
    } catch (err) {
      console.error('Failed to load memes:', err)
    } finally {
      setLoading(false)
    }
  }, [activeGame, limit])

  useEffect(() => {
    loadMemes()
  }, [loadMemes])

  const handleGameChange = (game: string) => {
    setActiveGame(game)
    setLimit(30)
    setExpandedMeme(null)
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-black gradient-text">Memes</h1>
        <p className="text-slate-400 text-sm">
          The best gaming memes from across the community. Click to expand.
        </p>
      </div>

      {/* Game Filter */}
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

      {/* Masonry Grid */}
      {loading ? (
        <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4 space-y-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="skeleton rounded-xl" style={{ height: `${200 + Math.random() * 200}px` }} />
          ))}
        </div>
      ) : memes.length > 0 ? (
        <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4">
          {memes.map((meme) => {
            const isExpanded = expandedMeme === meme.id
            const gameColor = GAME_COLORS[meme.game] || '#6b7280'

            return (
              <div
                key={meme.id}
                className="mb-4 break-inside-avoid"
              >
                <div
                  className={`
                    card-glow rounded-xl bg-vault-card border border-vault-border overflow-hidden cursor-pointer
                    ${isExpanded ? 'col-span-full' : ''}
                  `}
                  onClick={() => setExpandedMeme(isExpanded ? null : meme.id)}
                >
                  <div className="relative">
                    <img
                      src={meme.image_url}
                      alt={meme.title}
                      className={`w-full object-cover transition-all ${isExpanded ? 'max-h-[80vh]' : 'max-h-96'}`}
                      loading="lazy"
                    />
                  </div>
                  <div className="p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="px-1.5 py-0.5 rounded text-[10px] font-bold"
                        style={{ backgroundColor: `${gameColor}20`, color: gameColor }}
                      >
                        {meme.game}
                      </span>
                      {meme.upvotes > 0 && (
                        <span className="flex items-center gap-1 text-[10px] text-neon-green">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                          </svg>
                          {meme.upvotes}
                        </span>
                      )}
                    </div>
                    <h3 className="text-xs font-medium text-slate-300 line-clamp-2">{meme.title}</h3>
                    {meme.source_name && (
                      <span className="text-[10px] text-slate-600">via {meme.source_name}</span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="text-center py-16 space-y-3">
          <div className="text-4xl opacity-30">😂</div>
          <p className="text-slate-500">No memes found</p>
        </div>
      )}

      {/* Load More */}
      {memes.length >= limit && (
        <div className="text-center pt-4">
          <button
            onClick={() => setLimit((prev) => prev + 30)}
            disabled={loading}
            className="px-6 py-2.5 rounded-lg bg-vault-card border border-vault-border text-slate-300 font-semibold text-sm hover:border-neon-purple/30 transition-all disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Load More'}
          </button>
        </div>
      )}

      {/* Expanded overlay */}
      {expandedMeme !== null && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setExpandedMeme(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            {memes.find((m) => m.id === expandedMeme) && (
              <img
                src={memes.find((m) => m.id === expandedMeme)!.image_url}
                alt={memes.find((m) => m.id === expandedMeme)!.title}
                className="max-w-full max-h-[85vh] object-contain rounded-xl"
              />
            )}
            <button
              onClick={() => setExpandedMeme(null)}
              className="absolute top-2 right-2 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-all"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
