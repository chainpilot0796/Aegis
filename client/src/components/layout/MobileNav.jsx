import { NavLink } from 'react-router-dom';

const NAV_ITEMS = [
  { to: '/app/shield', label: 'Earn', icon: '\u25C8' },
  { to: '/app/markets', label: 'Assets', icon: '\u25A0' },
  { to: '/app/portfolio', label: 'Dashboard', icon: '\u25C6' },
  { to: '/app/leaderboard', label: 'Board', icon: '\u2261' },
];

export default function MobileNav() {
  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-[var(--t-border)] bg-[var(--t-bg-secondary)]">
      <div className="flex">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center py-2 text-[0.55rem] uppercase tracking-[0.08em] transition-colors ${
                isActive
                  ? 'text-[var(--t-green)] border-t-2 border-[var(--t-green)]'
                  : 'text-[var(--t-text-muted)] border-t-2 border-transparent'
              }`
            }
          >
            <span className="text-sm mb-0.5">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
