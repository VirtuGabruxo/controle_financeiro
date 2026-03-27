import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import InviteNotification from './InviteNotification';

export default function DashboardLayout() {
  return (
    <div className="flex h-screen bg-background text-zinc-50 overflow-hidden flex-col md:flex-row">
      <Sidebar />
      <InviteNotification />
      <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 pb-24 md:p-8 md:pb-8 w-full">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
