import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, PlusCircle, Gift, Settings, LogOut, Menu, Activity, FileBarChart, ShieldCheck, ChevronsLeft, ChevronsRight, ShoppingBag, ShoppingCart, ReceiptText, Database, X, MoreHorizontal, Megaphone } from 'lucide-react';
import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';

// All possible nav items with unique keys for menu visibility control
const allNavItems = [
  { key: 'dashboard', to: '/admin', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { key: 'pos', to: '/admin/pos', icon: ShoppingCart, label: 'POS', end: false },
  { key: 'customers', to: '/admin/customers', icon: Users, label: 'Customers', end: false },
  { key: 'redemptions', to: '/admin/redemptions', icon: Gift, label: 'Redemptions', end: false },
  { key: 'report', to: '/admin/report', icon: FileBarChart, label: 'Report', end: false },
  { key: 'transactions', to: '/admin/transactions', icon: ReceiptText, label: 'Transactions', end: false },
  { key: 'staff', to: '/admin/staff', icon: ShieldCheck, label: 'Staff', end: false },
  { key: 'broadcast', to: '/admin/broadcasts', icon: Megaphone, label: 'Broadcast', end: false },
  { key: 'settings', to: '/admin/settings', icon: Settings, label: 'Settings', end: false },
  { key: 'activity', to: '/admin/activity', icon: Activity, label: 'Activity', end: false },
];

// Export for use in SettingsPage checkbox list
export { allNavItems };

export default function AdminLayout() {
  const { user } = useAuth();

  // Staff gets a completely different layout
  if (user?.role === 'staff') {
    return <StaffLayout />;
  }

  return <AdminSidebarLayout />;
}

// ═══════════════════════════════════════════
// Staff Layout — Bottom nav + Modal menu
// ═══════════════════════════════════════════
function StaffLayout() {
  const { logout, user } = useAuth();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const location = useLocation();
  const [showMenu, setShowMenu] = useState(false);

  // Filter nav items for staff
  const navItems = useMemo(() => {
    const menuSetting = settings.staff_visible_menus;
    if (!menuSetting) return allNavItems;
    try {
      const visibleKeys: string[] = JSON.parse(menuSetting);
      // Backward compat: old 'walkin-sales' or 'add-token' keys grant access to 'pos'
      const expanded = [...visibleKeys];
      if (visibleKeys.includes('walkin-sales') || visibleKeys.includes('add-token')) {
        if (!expanded.includes('pos')) expanded.push('pos');
      }
      return allNavItems.filter(item => item.key === 'dashboard' || expanded.includes(item.key));
    } catch {
      return allNavItems;
    }
  }, [settings.staff_visible_menus]);

  // Bottom nav: show up to 4 items, then "More" if needed
  const MAX_BOTTOM_ITEMS = 4;
  const needsMore = navItems.length > MAX_BOTTOM_ITEMS;
  const bottomItems = needsMore ? navItems.slice(0, MAX_BOTTOM_ITEMS - 1) : navItems;

  const handleLogout = () => {
    setShowMenu(false);
    logout();
    navigate('/admin/login');
  };

  const handleNavClick = (to: string) => {
    setShowMenu(false);
    navigate(to);
  };

  const isActive = (to: string, end?: boolean) => {
    if (end) return location.pathname === to || location.pathname === to + '/';
    return location.pathname.startsWith(to);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">

      {/* ===== Staff Header — Hamburger | Logo | Avatar ===== */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-gray-100">
        <div className="flex items-center justify-between px-4 py-2.5">
          {/* Left: Hamburger */}
          <button
            onClick={() => setShowMenu(true)}
            className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors"
          >
            <Menu className="w-5 h-5 text-gray-600" />
          </button>

          {/* Center: Logo + Name */}
          <button
            onClick={() => navigate('/admin')}
            className="flex items-center gap-2 min-w-0"
          >
            {settings.business_logo ? (
              <img
                src={settings.business_logo}
                alt={settings.business_name}
                className="w-8 h-8 rounded-lg object-cover shadow-sm"
              />
            ) : (
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shadow-sm text-white font-bold text-xs"
                style={{ backgroundColor: settings.primary_color }}
              >
                {settings.business_name?.charAt(0)?.toUpperCase() || 'B'}
              </div>
            )}
            <span className="font-bold text-sm text-gray-900 truncate max-w-[140px]">
              {settings.business_name}
            </span>
          </button>

          {/* Right: Avatar */}
          <button
            onClick={() => setShowMenu(true)}
            className="w-10 h-10 flex items-center justify-center"
          >
            {user?.avatar ? (
              <img
                src={user.avatar}
                alt={user.name}
                className="w-8 h-8 rounded-full object-cover ring-2 ring-gray-100"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-8 h-8 rounded-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-sm">
                <span className="text-xs font-bold">{user?.name?.charAt(0)?.toUpperCase()}</span>
              </div>
            )}
          </button>
        </div>
      </header>

      {/* ===== Page Content ===== */}
      <main className="flex-1 p-4 pb-24">
        <Outlet />
      </main>

      {/* ===== Bottom Navigation Bar ===== */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-200 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
        <div className="flex items-center justify-around px-2 py-1.5 max-w-lg mx-auto">
          {bottomItems.map(({ to, icon: Icon, label, end }) => {
            const active = isActive(to, end);
            return (
              <button
                key={to}
                onClick={() => handleNavClick(to)}
                className={`flex flex-col items-center gap-0.5 py-1.5 px-3 rounded-xl min-w-[60px] transition-colors ${
                  active ? 'text-white' : 'text-gray-400'
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                  active
                    ? 'shadow-sm'
                    : 'hover:bg-gray-100'
                }`}
                  style={active ? { background: `linear-gradient(135deg, ${settings.primary_color}, ${settings.primary_color}cc)` } : undefined}
                >
                  <Icon className={`w-5 h-5 ${active ? 'text-white' : 'text-gray-500'}`} />
                </div>
                <span className={`text-[10px] font-medium leading-tight ${active ? 'font-bold' : ''}`}
                  style={active ? { color: settings.primary_color } : undefined}
                >
                  {label.length > 10 ? label.split(' ')[0] : label}
                </span>
              </button>
            );
          })}

          {/* More button */}
          {needsMore && (
            <button
              onClick={() => setShowMenu(true)}
              className="flex flex-col items-center gap-0.5 py-1.5 px-3 rounded-xl min-w-[60px] text-gray-400"
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-gray-100 transition-all">
                <MoreHorizontal className="w-5 h-5 text-gray-500" />
              </div>
              <span className="text-[10px] font-medium leading-tight">More</span>
            </button>
          )}
        </div>

        {/* Safe area for iPhone notch */}
        <div className="h-safe-area-bottom bg-white" />
      </nav>

      {/* ===== Full-Screen Menu Modal ===== */}
      <AnimatePresence>
        {showMenu && (
          <>
            {/* Backdrop */}
            <motion.div
              className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMenu(false)}
            />

            {/* Modal Panel — slides up from bottom */}
            <motion.div
              className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl max-h-[85vh] overflow-y-auto shadow-2xl"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            >
              {/* Drag handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-gray-300" />
              </div>

              {/* Profile Card */}
              <div className="px-5 pb-4 pt-2">
                <div className="flex items-center gap-3">
                  {user?.avatar ? (
                    <img
                      src={user.avatar}
                      alt={user.name}
                      className="w-12 h-12 rounded-full object-cover ring-2 ring-gray-100 shadow-sm"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-sm">
                      <span className="text-lg font-bold">{user?.name?.charAt(0)?.toUpperCase()}</span>
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-gray-900 truncate">{user?.name}</p>
                    <p className="text-xs text-gray-400 truncate">{user?.email || user?.phone}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-50 text-green-600">
                        <ShieldCheck className="w-2.5 h-2.5" />
                        Staff
                      </span>
                      <span className="text-[10px] text-gray-300 font-mono">{user?.user_code}</span>
                    </div>
                  </div>
                  {/* Close button */}
                  <button
                    onClick={() => setShowMenu(false)}
                    className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
                  >
                    <X className="w-4 h-4 text-gray-500" />
                  </button>
                </div>
              </div>

              {/* Divider */}
              <div className="h-px bg-gray-100 mx-5" />

              {/* Menu Items */}
              <div className="px-3 py-3">
                <div className="grid grid-cols-3 gap-2">
                  {navItems.map(({ to, icon: Icon, label, end }) => {
                    const active = isActive(to, end);
                    return (
                      <button
                        key={to}
                        onClick={() => handleNavClick(to)}
                        className={`flex flex-col items-center gap-2 p-4 rounded-2xl transition-all ${
                          active
                            ? 'bg-primary-50 shadow-sm'
                            : 'hover:bg-gray-50 active:bg-gray-100'
                        }`}
                      >
                        <div
                          className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                            active ? 'shadow-sm' : 'bg-gray-100'
                          }`}
                          style={active ? { background: `linear-gradient(135deg, ${settings.primary_color}, ${settings.primary_color}cc)` } : undefined}
                        >
                          <Icon className={`w-5 h-5 ${active ? 'text-white' : 'text-gray-500'}`} />
                        </div>
                        <span className={`text-xs font-medium text-center leading-tight ${
                          active ? 'font-bold' : 'text-gray-600'
                        }`}
                          style={active ? { color: settings.primary_color } : undefined}
                        >
                          {label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Divider */}
              <div className="h-px bg-gray-100 mx-5" />

              {/* Logout */}
              <div className="px-5 py-4 pb-8">
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-red-600 hover:bg-red-50 active:bg-red-100 transition-colors"
                >
                  <LogOut className="w-5 h-5" />
                  <span className="text-sm font-semibold">Logout</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ═══════════════════════════════════════════
// Admin/SuperAdmin Layout — Original sidebar (unchanged)
// ═══════════════════════════════════════════
function AdminSidebarLayout() {
  const { logout, user } = useAuth();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  // Filter nav items based on role and menu visibility settings
  const navItems = useMemo(() => {
    if (user?.role === 'super_admin') {
      const menuSetting = settings.super_admin_visible_menus;
      if (!menuSetting) return allNavItems;
      try {
        const visibleKeys: string[] = JSON.parse(menuSetting);
        const expanded = [...visibleKeys];
        if (visibleKeys.includes('walkin-sales') || visibleKeys.includes('add-token')) {
          if (!expanded.includes('pos')) expanded.push('pos');
        }
        return allNavItems.filter(item => item.key === 'dashboard' || expanded.includes(item.key));
      } catch {
        return allNavItems;
      }
    }
    if (user?.role === 'admin') {
      const menuSetting = settings.admin_visible_menus;
      if (!menuSetting) return allNavItems;
      try {
        const visibleKeys: string[] = JSON.parse(menuSetting);
        const expanded = [...visibleKeys];
        if (visibleKeys.includes('walkin-sales') || visibleKeys.includes('add-token')) {
          if (!expanded.includes('pos')) expanded.push('pos');
        }
        return allNavItems.filter(item => item.key === 'dashboard' || expanded.includes(item.key));
      } catch {
        return allNavItems;
      }
    }
    return allNavItems;
  }, [user?.role, settings.admin_visible_menus, settings.super_admin_visible_menus]);

  const handleLogout = () => {
    logout();
    navigate('/admin/login');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">

      {/* ===== Sidebar ===== */}
      <aside
        className={`
          fixed top-0 left-0 z-40 h-full bg-white border-r border-gray-100 flex flex-col
          transition-all duration-200 ease-out
          ${collapsed ? 'w-[68px]' : 'w-64'}
        `}
      >
        {/* Header: Logo + brand */}
        <div className={`border-b border-gray-100 ${collapsed ? 'py-4 flex justify-center' : 'p-4'}`}>
          {collapsed ? (
            /* Collapsed: just the logo */
            settings.business_logo ? (
              <img
                src={settings.business_logo}
                alt={settings.business_name}
                className="w-10 h-10 rounded-xl object-cover shadow-sm border border-gray-100"
              />
            ) : (
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm text-white font-bold text-sm"
                style={{ backgroundColor: settings.primary_color }}
              >
                {settings.business_name?.charAt(0)?.toUpperCase() || 'B'}
              </div>
            )
          ) : (
            /* Expanded: logo + name */
            <div className="flex items-center gap-3 min-w-0">
              {settings.business_logo ? (
                <img
                  src={settings.business_logo}
                  alt={settings.business_name}
                  className="w-10 h-10 rounded-xl object-cover shadow-sm border border-gray-100 shrink-0"
                />
              ) : (
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm text-white font-bold text-sm"
                  style={{ backgroundColor: settings.primary_color }}
                >
                  {settings.business_name?.charAt(0)?.toUpperCase() || 'B'}
                </div>
              )}
              <div className="min-w-0">
                <h1 className="font-bold text-base text-gray-900 truncate leading-tight">{settings.business_name}</h1>
                <p className="text-xs text-gray-400">Admin Panel</p>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 px-2">
          <div className={`space-y-1 ${collapsed ? 'flex flex-col items-center' : ''}`}>
            {navItems.map(({ to, icon: Icon, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                title={collapsed ? label : undefined}
                className={({ isActive }) =>
                  collapsed
                    ? `relative w-11 h-11 flex items-center justify-center rounded-xl transition-all duration-150 group
                       ${isActive ? 'bg-primary-50 text-primary-700 shadow-sm' : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600'}`
                    : `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors
                       ${isActive ? 'bg-primary-50 text-primary-700' : 'text-gray-600 hover:bg-gray-50'}`
                }
              >
                <Icon className="w-5 h-5 shrink-0" />
                {!collapsed && label}
                {/* Tooltip for collapsed mode */}
                {collapsed && (
                  <span className="absolute left-full ml-3 px-2.5 py-1 rounded-lg bg-gray-900 text-white text-xs font-medium whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 shadow-lg z-[60]">
                    {label}
                  </span>
                )}
              </NavLink>
            ))}
          </div>
        </nav>

        {/* Bottom section */}
        <div className="border-t border-gray-100 p-2">
          {collapsed ? (
            /* Collapsed: avatar + logout icon */
            <div className="flex flex-col items-center gap-2 py-2">
              {user?.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="w-9 h-9 rounded-full object-cover ring-2 ring-gray-100 shadow-sm"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-9 h-9 rounded-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-sm">
                  <span className="text-xs font-bold">{user?.name?.charAt(0)?.toUpperCase()}</span>
                </div>
              )}
              <button
                onClick={handleLogout}
                title="Logout"
                className="relative w-11 h-11 flex items-center justify-center rounded-xl text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors group"
              >
                <LogOut className="w-5 h-5" />
                <span className="absolute left-full ml-3 px-2.5 py-1 rounded-lg bg-gray-900 text-white text-xs font-medium whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 shadow-lg z-[60]">
                  Logout
                </span>
              </button>
            </div>
          ) : (
            /* Expanded: full user card + logout */
            <>
              <div className="px-2 py-2 mb-1 rounded-xl bg-gradient-to-r from-gray-50 to-slate-50 border border-gray-100">
                <div className="flex items-center gap-2.5">
                  {user?.avatar ? (
                    <img
                      src={user.avatar}
                      alt={user.name}
                      className="w-8 h-8 rounded-full object-cover ring-2 ring-white shadow-sm shrink-0"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-sm">
                      <span className="text-xs font-bold">{user?.name?.charAt(0)?.toUpperCase()}</span>
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-gray-800 truncate">{user?.name}</p>
                    <p className="text-[10px] text-gray-400 truncate">{user?.email || user?.phone}</p>
                  </div>
                </div>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                    user?.role === 'super_admin'
                      ? 'bg-amber-50 text-amber-600'
                      : 'bg-blue-50 text-blue-600'
                  }`}>
                    <ShieldCheck className="w-2.5 h-2.5" />
                    {user?.role === 'super_admin' ? 'Super Admin' : 'Admin'}
                  </span>
                  <span className="text-[9px] text-gray-300 font-mono">{user?.user_code}</span>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 w-full"
              >
                <LogOut className="w-5 h-5" />
                Logout
              </button>
            </>
          )}

          {/* Collapse/Expand toggle at bottom */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={`
              w-full flex items-center justify-center gap-2 mt-1 py-2 rounded-xl text-xs font-medium
              text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-colors
            `}
          >
            {collapsed ? <ChevronsRight className="w-4 h-4" /> : <ChevronsLeft className="w-4 h-4" />}
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      </aside>

      {/* ===== Main content ===== */}
      <div
        className={`flex-1 min-w-0 transition-all duration-200 ease-out ${collapsed ? 'ml-[68px]' : 'ml-64'}`}
      >
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-gray-100 px-4 py-3 md:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button
                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                onClick={() => setCollapsed(!collapsed)}
              >
                <Menu className="w-5 h-5 text-gray-600" />
              </button>
              <div className="min-w-0">
                <h2 className="font-semibold text-gray-900 text-lg truncate leading-tight">
                  Welcome, {user?.name?.split(' ')[0]}
                </h2>
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-2">
              {user?.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="w-8 h-8 rounded-full object-cover ring-2 ring-gray-100 shadow-sm"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-8 h-8 rounded-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-sm">
                  <span className="text-xs font-bold">{user?.name?.charAt(0)?.toUpperCase()}</span>
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-700 truncate">{user?.name}</p>
                <span className={`inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                  user?.role === 'super_admin'
                    ? 'bg-amber-50 text-amber-600'
                    : 'bg-blue-50 text-blue-600'
                }`}>
                  <ShieldCheck className="w-2.5 h-2.5" />
                  {user?.role === 'super_admin' ? 'Super Admin' : 'Admin'}
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 md:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
