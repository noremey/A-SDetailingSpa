import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { publicService } from '../services/api';
import type { BusinessSettings } from '../types';

const defaultSettings: BusinessSettings = {
  business_name: 'My Business',
  business_logo: '',
  business_phone: '',
  business_email: '',
  business_address: '',
  business_type: 'general',
  tokens_per_card: '10',
  min_spend: '0',
  min_spend_enabled: '0',
  payment_tracking_enabled: '0',
  require_vehicle: '1',
  reward_description: '1 FREE service/product',
  primary_color: '#6366f1',
  secondary_color: '#8b5cf6',
  currency_symbol: 'RM',
  currency_code: 'MYR',
  timezone: 'Asia/Kuala_Lumpur',
  language: 'en',
  staff_visible_menus: '',
  admin_visible_menus: '',
  super_admin_visible_menus: '',
  pos_quick_quantities: '5,10,15,20,25,30',
  pos_quantity_picker: '1',
};

interface SettingsContextType {
  settings: BusinessSettings;
  loading: boolean;
  refreshSettings: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType>({
  settings: defaultSettings,
  loading: true,
  refreshSettings: async () => {},
});

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<BusinessSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);

  const refreshSettings = async () => {
    try {
      const { data } = await publicService.getSettings();
      if (data.success && data.settings) {
        setSettings({ ...defaultSettings, ...data.settings });
      }
    } catch {
      // Use defaults
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshSettings();
  }, []);

  // Apply theme colors to CSS variables
  useEffect(() => {
    document.documentElement.style.setProperty('--color-primary', settings.primary_color);
    document.documentElement.style.setProperty('--color-secondary', settings.secondary_color);
    // Update meta theme-color
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', settings.primary_color);
  }, [settings.primary_color, settings.secondary_color]);

  // Update page title with business name
  useEffect(() => {
    if (settings.business_name) {
      document.title = settings.business_name;
    }
  }, [settings.business_name]);

  // Update favicon with business logo
  useEffect(() => {
    if (settings.business_logo) {
      let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.type = 'image/x-icon';
      link.href = settings.business_logo;

      // Also update apple-touch-icon
      let apple = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]');
      if (apple) {
        apple.href = settings.business_logo;
      }
    }
  }, [settings.business_logo]);

  return (
    <SettingsContext.Provider value={{ settings, loading, refreshSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}
