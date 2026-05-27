export interface SaasPlan {
  id: string;
  name: string;
  slug: string;
  description: string;
  monthly_price: string | number;
  currency: string;
  max_restaurants: number;
  max_tables: number;
  max_users: number;
  features: string[];
  is_popular: boolean;
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
  status: 'trial' | 'active' | 'suspended' | 'cancelled';
  saas_plan_id?: string;
  trial_ends_at?: string;
  subscription_ends_at?: string;
  plan?: SaasPlan;
  created_at?: string;
}

export interface SaasOverview {
  metrics: {
    restaurants: number;
    active_restaurants: number;
    trial_restaurants: number;
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
