// ============================================
// Loyalty & Rewards POS - TypeScript Interfaces
// ============================================

export interface User {
  id: number;
  user_code: string;
  name: string;
  phone: string | null;
  email: string | null;
  role: 'customer' | 'admin' | 'super_admin' | 'staff';
  avatar: string | null;
  status: 'active' | 'inactive' | 'banned';
  active_card?: LoyaltyCard | null;
  total_completed_cards?: number;
  google_id?: string | null;
  created_at?: string | null;
  needs_profile_completion?: boolean;
  needs_phone?: boolean;
  needs_vehicle?: boolean;
}

export interface Vehicle {
  id: number;
  user_id?: number;
  plate_number: string;
  vehicle_type: string;
  vehicle_model: string | null;
  is_primary: boolean;
  created_at: string;
}

export interface LoyaltyCard {
  id: number;
  user_id?: number;
  card_number: number;
  tokens_required: number;
  tokens_earned: number;
  status: 'active' | 'completed' | 'redeemed';
  tokens: Token[];
  is_completed?: boolean;
  total_amount?: number;
  completed_at: string | null;
  redeemed_at: string | null;
  created_at: string;
}

export interface Token {
  id: number;
  card_id: number;
  user_id?: number;
  added_by?: number;
  added_by_name?: string;
  vehicle_id?: number | null;
  plate_number?: string | null;
  token_position: number;
  amount: number | null;
  notes: string | null;
  created_at: string;
}

export interface Redemption {
  id: number;
  card_id: number;
  user_id: number;
  processed_by: number;
  processed_by_name?: string;
  reward_description: string;
  notes: string | null;
  redeemed_at: string;
  customer_name?: string;
  user_code?: string;
  card_number?: number;
}

export interface BusinessSettings {
  business_name: string;
  business_logo: string;
  business_phone: string;
  business_email: string;
  business_address: string;
  business_type: string;
  tokens_per_card: string;
  min_spend: string;
  min_spend_enabled: string;
  payment_tracking_enabled: string;
  require_vehicle: string;
  reward_description: string;
  primary_color: string;
  secondary_color: string;
  currency_symbol: string;
  currency_code: string;
  timezone: string;
  language: string;
  staff_visible_menus: string;
  admin_visible_menus: string;
  super_admin_visible_menus: string;
  pos_quick_quantities: string;
  pos_quantity_picker: string;
  vapid_public_key?: string;
  push_notifications_enabled?: string;
}

export interface Broadcast {
  id: number;
  title: string;
  message: string;
  channels: 'push';
  sent_by: number;
  sent_by_name?: string;
  total_recipients: number;
  push_sent: number;
  push_failed: number;
  status: 'sending' | 'completed' | 'failed';
  created_at: string;
}

export interface DashboardStats {
  total_customers: number;
  tokens_today: number;
  active_cards: number;
  completed_cards: number;
  redeemed_today: number;
  total_redeemed: number;
  total_tokens: number;
  revenue_today: number;
  below_threshold_today?: number;
  below_threshold_count?: number;
  walkin_today?: number;
  walkin_count_today?: number;
  new_customers_week: number;
}

export interface WalkInSale {
  id: number;
  customer_name: string | null;
  amount: number;
  notes: string | null;
  added_by: number;
  added_by_name?: string;
  payment_method: 'cash' | 'online' | 'split' | null;
  cash_amount: number | null;
  online_amount: number | null;
  status?: 'active' | 'voided';
  created_at: string;
}

export interface ActivityLog {
  id: number;
  user_id: number | null;
  action: string;
  description: string | null;
  ip_address?: string | null;
  user_name?: string;
  user_code?: string;
  user_role?: string;
  created_at: string;
}

export interface Staff {
  id: number;
  user_code: string;
  name: string;
  phone: string | null;
  email: string | null;
  avatar: string | null;
  google_id: string | null;
  role: 'admin' | 'super_admin';
  status: 'active' | 'inactive' | 'banned';
  last_login: string | null;
  created_at: string;
  is_google?: boolean;
}

export interface StaffInvite {
  code: string;
  expires_at: string;
  invited_by?: string;
  valid?: boolean;
}

export interface ServiceCategory {
  id: number;
  name: string;
  color: string;
  sort_order: number;
  status: 'active' | 'inactive';
  service_count?: number;
}

export interface Service {
  id: number;
  category_id: number | null;
  category_name?: string | null;
  category_color?: string | null;
  name: string;
  price: number;
  sort_order: number;
  status: 'active' | 'inactive';
}

export interface CustomerWithCard {
  id: number;
  user_code: string;
  name: string;
  phone: string | null;
  email: string | null;
  avatar?: string | null;
  google_id?: string | null;
  status: string;
  created_at: string;
  last_login?: string | null;
  card_id: number | null;
  card_number: number | null;
  tokens_earned: number;
  tokens_required: number;
  card_status: string | null;
  plate_number?: string | null;
  plate_numbers?: string[];
  completed_cards?: number;
}

export interface CartItem {
  service: Service;
  quantity: number;
}

export interface ReceiptLineItem {
  name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  [key: string]: any;
}

export interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
}

// Google Sign-In global type
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: any) => void;
          renderButton: (element: HTMLElement, config: any) => void;
          prompt: () => void;
          revoke: (email: string, callback: () => void) => void;
        };
      };
    };
  }
}
