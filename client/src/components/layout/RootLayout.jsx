import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import MobileNav from './MobileNav';

export default function RootLayout() {
  return (
    <div className="flex min-h-screen font-sans bg-[var(--t-bg)]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-h-screen">
        <main className="flex-1 p-4 lg:p-6 pb-20 lg:pb-6 overflow-auto">
          <Outlet />
        </main>
      </div>
      <MobileNav />
    </div>
  );
}

