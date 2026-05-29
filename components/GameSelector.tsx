'use client'

import { GAMES, GAME_COLORS } from '@/lib/types'

interface GameSelectorProps {
  selectedGame: string
  onGameChange: (game: string) => void
  counts?: Record<string, number>
}

export default function GameSelector({ selectedGame, onGameChange, counts }: GameSelectorProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <button
        onClick={() => onGameChange('')}
        className={`
          relative rounded-xl p-4 border transition-all text-left
          ${selectedGame === ''
            ? 'bg-vault-card border-neon-purple/30 shadow-neon-purple'
            : 'bg-vault-card border-vault-border hover:border-vault-border-light card-glow'
          }
        `}
      >
        <div className="text-2xl mb-2">🌐</div>
        <div className={`text-sm font-semibold ${selectedGame === '' ? 'text-neon-purple' : 'text-slate-300'}`}>
          All Games
        </div>
        {counts && (
          <div className="text-xs text-slate-500 mt-1">
            {Object.values(counts).reduce((a, b) => a + b, 0)} items
          </div>
        )}
      </button>

      {GAMES.map((game) => {
        const isSelected = selectedGame === game.name
        const color = GAME_COLORS[game.name] || '#6b7280'

        return (
          <button
            key={game.name}
            onClick={() => onGameChange(game.name)}
            className={`
              relative rounded-xl p-4 border transition-all text-left
              ${isSelected
                ? 'bg-vault-card shadow-lg'
                : 'bg-vault-card border-vault-border hover:border-vault-border-light card-glow'
              }
            `}
            style={isSelected ? {
              borderColor: `${color}40`,
              boxShadow: `0 0 20px ${color}25`,
            } : {}}
          >
            <div className="text-2xl mb-2">{game.icon}</div>
            <div
              className={`text-sm font-semibold ${isSelected ? '' : 'text-slate-300'}`}
              style={isSelected ? { color } : {}}
            >
              {game.name}
            </div>
            {counts && counts[game.name] !== undefined && (
              <div className="text-xs text-slate-500 mt-1">
                {counts[game.name]} items
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
}
