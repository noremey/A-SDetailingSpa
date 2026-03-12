import { NavLink } from 'react-router-dom';
import { CreditCard, Clock, User } from 'lucide-react';
import { useSettings } from '../../context/SettingsContext';

export default function BottomNav() {
  const { settings } = useSettings();

  const links = [
    { to: '/', icon: CreditCard, label: 'My Card', end: true },
    { to: '/history', icon: Clock, label: 'History', end: false },
    { to: '/profile', icon: User, label: 'Profile', end: false },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-t border-gray-100 safe-area-pb">
      <div className="max-w-lg md:max-w-2xl lg:max-w-4xl xl:max-w-5xl mx-auto flex justify-around">
        {links.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex flex-col items-center py-2.5 px-4 md:px-6 lg:px-8 text-xs md:text-sm font-medium transition-colors ${
                isActive ? 'text-primary-600' : 'text-gray-400 hover:text-gray-600'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  className="w-5 h-5 md:w-6 md:h-6 mb-1"
                  style={isActive ? { color: settings.primary_color } : {}}
                />
                <span style={isActive ? { color: settings.primary_color } : {}}>
                  {label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
