import { Outlet } from 'react-router-dom';
import BottomNav from './BottomNav';

export default function CustomerLayout() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-lg md:max-w-2xl lg:max-w-4xl xl:max-w-5xl mx-auto">
        <Outlet />
      </div>
      <BottomNav />
    </div>
  );
}
