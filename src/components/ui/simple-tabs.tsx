'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

type TabItem = { value: string; label: string; content: React.ReactNode }

/**
 * Tabs sem dependência externa (não há @radix-ui/react-tabs instalado) — só
 * troca qual painel é renderizado, sem rotas nem estado além do local.
 */
export function SimpleTabs({ tabs, defaultValue }: { tabs: TabItem[]; defaultValue?: string }) {
  const [active, setActive] = useState(defaultValue ?? tabs[0]?.value)
  const activeTab = tabs.find((tab) => tab.value === active) ?? tabs[0]

  return (
    <div>
      <div role="tablist" className="flex gap-1 overflow-x-auto border-b">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={tab.value === active}
            onClick={() => setActive(tab.value)}
            className={cn(
              'flex min-h-[44px] shrink-0 items-center border-b-2 px-4 text-sm font-medium transition-colors',
              tab.value === active
                ? 'border-foreground text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="pt-6">
        {activeTab?.content}
      </div>
    </div>
  )
}
