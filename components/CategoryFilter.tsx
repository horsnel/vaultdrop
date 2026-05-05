'use client'

import { LeakCategory, CATEGORY_COLORS } from '@/lib/types'

interface CategoryFilterProps {
  categories: LeakCategory[]
  activeCategory: string
  onCategoryChange: (category: string) => void
}

const ALL_CATEGORIES = [
  'all', 'mythic', 'legendary', 'collab', 'DMZ', 'BR', 'meta',
  'esports', 'test_server', 'season', 'apk_update', 'general',
]

export default function CategoryFilter({ categories, activeCategory, onCategoryChange }: CategoryFilterProps) {
  const countMap: Record<string, number> = {}
  categories.forEach((c) => {
    countMap[c.category] = c.count
  })

  return (
    <div className="flex overflow-x-auto scrollbar-hide gap-2 pb-2">
      {ALL_CATEGORIES.map((cat) => {
        const isActive = activeCategory === cat
        const color = cat === 'all' ? '#8b5cf6' : (CATEGORY_COLORS[cat] || '#6b7280')
        const count = cat === 'all'
          ? categories.reduce((sum, c) => sum + c.count, 0)
          : (countMap[cat] || 0)

        return (
          <button
            key={cat}
            onClick={() => onCategoryChange(cat)}
            className={`
              flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold capitalize transition-all
              ${isActive
                ? 'text-white border'
                : 'text-slate-400 bg-vault-card border border-vault-border hover:border-vault-border-light hover:text-slate-300'
              }
            `}
            style={isActive ? {
              backgroundColor: `${color}20`,
              borderColor: `${color}50`,
              color: color,
              boxShadow: `0 0 12px ${color}30`,
            } : {}}
          >
            {cat.replace('_', ' ')}
            {count > 0 && (
              <span className={`ml-1.5 ${isActive ? 'opacity-80' : 'opacity-50'}`}>
                {count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
