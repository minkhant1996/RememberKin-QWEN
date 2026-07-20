import { Outlet } from 'react-router-dom';
import Header from './Header';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import { useWebSocket } from '../../hooks/useWebSocket';

export default function Layout() {
  // Connect WebSocket when authenticated
  useWebSocket();

  return (
    <div className="min-h-screen bg-warm-50">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-6 lg:ml-64 pb-16 lg:pb-6">
          <Outlet />
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
