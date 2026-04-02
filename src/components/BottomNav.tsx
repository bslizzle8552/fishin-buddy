import { useLocation, useNavigate } from 'react-router-dom'

const tabs = [
  { path: '/map', label: 'Map', icon: MapIcon },
  { path: '/timeline', label: 'Timeline', icon: TimelineIcon },
  { path: '/log', label: 'Log Catch', icon: PlusIcon },
  { path: '/lures', label: 'Lures', icon: LureIcon },
  { path: '/manage', label: 'My Spots', icon: ManageIcon },
]

export default function BottomNav() {
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <nav className="flex items-center justify-around bg-[var(--color-bg-card)] border-t border-[var(--color-border)] safe-bottom pt-2 pb-2 shrink-0">
      {tabs.map(tab => {
        const active = location.pathname === tab.path
        const isLog = tab.path === '/log'
        return (
          <button
            key={tab.path}
            onClick={() => navigate(tab.path)}
            className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg transition-colors ${
              isLog
                ? 'relative -top-3'
                : ''
            } ${active && !isLog ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)]'}`}
          >
            {isLog ? (
              <div className="w-14 h-14 rounded-full bg-[var(--color-accent)] flex items-center justify-center shadow-lg active:scale-95 transition-transform">
                <tab.icon className="w-7 h-7 text-white" />
              </div>
            ) : (
              <tab.icon className={`w-6 h-6 ${active ? 'text-[var(--color-accent)]' : ''}`} />
            )}
            <span className={`text-[10px] font-medium ${isLog ? 'text-[var(--color-accent)]' : ''}`}>
              {tab.label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}

function MapIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498 4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 0 0-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0Z" />
    </svg>
  )
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  )
}

function TimelineIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  )
}

function LureIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m21 7.5-2.25-1.313M21 7.5v2.25m0-2.25-2.25 1.313M3 7.5l2.25-1.313M3 7.5l2.25 1.313M3 7.5v2.25m9 3 2.25-1.313M12 12.75l-2.25-1.313M12 12.75V15m0 6.75 2.25-1.313M12 21.75V19.5m0 2.25-2.25-1.313m0-16.875L12 2.25l2.25 1.313M21 14.25v2.25l-2.25 1.313m-13.5 0L3 16.5v-2.25" />
    </svg>
  )
}

function ManageIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
    </svg>
  )
}
