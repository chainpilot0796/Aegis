import { NavLink } from 'react-router-dom';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import { truncateAddress } from '../../lib/utils';
import StarBorder from '../ui/StarBorder';
import AddTokenButton from '../AddTokenButton';
import logo from '../../assets/aegis-mark.svg';

const NAV_ITEMS = [
  { to: '/app/shield', label: 'Shield', icon: '\u25C8' },
  { to: '/app/markets', label: 'Assets', icon: '\u25A0' },
  { to: '/app/agents', label: 'My Agents', icon: '\u25C9' },
  { to: '/app/vault', label: 'LP Vault', icon: '\u25B2' },
  { to: '/app/portfolio', label: 'My Dashboard', icon: '\u25C6' },
  { to: '/app/leaderboard', label: 'Leaderboard', icon: '\u2261' },
];

export default function Sidebar() {
  const { address, isConnected } = useAccount();

  return (
    <aside className="hidden lg:flex flex-col w-56 border-r border-[var(--t-border)] bg-[var(--t-bg-secondary)] h-screen sticky top-0">
      {/* Logo */}
      <div className="p-4 border-b border-[var(--t-border)]">
        <NavLink to="/" className="block">
          <div className="flex items-center gap-2">
            <img src={logo} alt="" className="h-6 w-auto" />
            <span className="text-[var(--t-green)] font-bold text-sm tracking-[0.15em] uppercase">Aegis</span>
          </div>
          <div className="text-[0.55rem] text-[var(--t-text-dim)] tracking-[0.1em] mt-0.5">
            Principal-protected shield agent · on Mantle
          </div>
        </NavLink>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4">
        <div className="px-3 mb-2">
          <span className="text-[0.6rem] text-[var(--t-text-dim)] uppercase tracking-[0.15em]">
            &#9472;&#9472; NAVIGATION &#9472;&#9472;
          </span>
        </div>
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `t-nav-item ${isActive ? 'active' : ''}`
            }
          >
            <span className="text-xs w-4 text-center">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Wallet */}
      <div className="p-3 border-t border-[var(--t-border)]">
        {isConnected && address && (
          <div className="text-[0.6rem] text-[var(--t-text-muted)] mb-2 px-1 truncate">
            &#9656; {truncateAddress(address)}
          </div>
        )}
        <ConnectButton.Custom>
          {({ account, chain, openConnectModal, openAccountModal, mounted }) => {
            if (!mounted) return null;
            const connected = mounted && account && chain;

            return (
              <StarBorder
                as="div"
                active={!!connected}
                color="#A78BFA"
                speed="5s"
              >
                <button
                  onClick={connected ? openAccountModal : openConnectModal}
                  className="t-btn t-btn-ghost w-full text-[0.65rem]"
                >
                  {connected ? 'CONNECTED' : 'CONNECT WALLET'}
                </button>
              </StarBorder>
            );
          }}
        </ConnectButton.Custom>
        {isConnected && (
          <div className="mt-2">
            <AddTokenButton
              variant="compact"
              className="w-full justify-center"
              label="+ USDY to wallet"
            />
          </div>
        )}
      </div>
    </aside>
  );
}
