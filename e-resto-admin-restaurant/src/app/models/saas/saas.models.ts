export interface SaasPlan {
  id: string;
  name: string;
  slug: string;
  description: string;
  monthly_price: string | number;
  yearly_price?: string | number | null;
  promo_label?: string | null;
  promo_percent?: string | number | null;
  promo_starts_at?: string | null;
  promo_ends_at?: string | null;
  has_active_promo?: boolean;
  promo_monthly_price?: string | number | null;
  promo_yearly_price?: string | number | null;
  currency: string;
  max_restaurants: number;
  max_tables: number | null;
  max_users: number | null;
  max_dishes?: number | null;
  max_orders_per_month?: number | null;
  features: string[];
  is_popular: boolean;
  is_active?: boolean;
}

export interface Restaurant {
  id: string;
  name: string;
  slug: string;
  legal_name?: string;
  owner_name: string;
  owner_email: string;
  owner_phone?: string;
  address?: string;
  city?: string;
  country: string;
  currency: string;
  status: 'pending_payment' | 'trial' | 'active' | 'past_due' | 'suspended' | 'cancelled';
  saas_plan_id?: string;
  trial_ends_at?: string;
  subscription_ends_at?: string;
  plan?: SaasPlan;
  features?: Record<string, boolean>;
  payment_methods?: string[];
  created_at?: string;
}

export interface SaasOverview {
  metrics: {
    restaurants: number;
    active_restaurants: number;
    trial_restaurants: number;
    past_due_restaurants: number;
    monthly_revenue: number;
  };
  plans: SaasPlan[];
  recent_restaurants: Restaurant[];
  payment_methods: Array<{
    key: string;
    name: string;
    status: 'active' | 'coming_soon';
    description: string;
  }>;
}

export interface RestaurantPlanUsage {
  plan: SaasPlan | null;
  restaurant_status: Restaurant['status'];
  limits: {
    tables: number | null;
    users: number | null;
    roles?: number | null;
    dishes?: number | null;
    orders_month?: number | null;
  };
  usage: {
    tables: number;
    users: number;
    roles?: number;
    dishes?: number;
    orders_month?: number;
  };
  permissions: {
    can_create_table: boolean;
    can_create_user: boolean;
    can_create_dish?: boolean;
    can_create_role?: boolean;
    can_accept_order?: boolean;
    can_use_mobile_money?: boolean;
    can_view_analytics?: boolean;
    can_view_advanced_analytics?: boolean;
    can_customize_menu?: boolean;
    can_use_feedback?: boolean;
    can_use_reservations?: boolean;
    can_use_chatbot?: boolean;
    can_manage_roles?: boolean;
    can_use_multi_restaurant?: boolean;
    can_use_dish_promotions?: boolean;
  };
  features?: Record<string, boolean>;
  payment_methods?: string[];
  messages: {
    tables: string;
    users: string;
    roles?: string;
    dishes?: string;
    orders_month?: string;
  };
}

export interface SubscriptionPayment {
  id: string;
  reference?: string;
  status: 'pending' | 'paid' | 'failed' | 'refunded' | string;
  amount: number | string;
  currency: string;
  provider?: string;
  method?: string;
  paid_at?: string;
  created_at?: string;
  metadata?: {
    plan_id?: string;
    plan_slug?: string;
    plan_name?: string;
    billing_cycle?: 'monthly' | 'yearly' | string;
    wallet_id?: string;
  };
}

