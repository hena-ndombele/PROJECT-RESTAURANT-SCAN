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
  status: 'pending_payment' | 'trial' | 'active' | 'past_due' | 'suspended' | 'cancelled';
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
    tables: number;
    users: number;
  };
  usage: {
    tables: number;
    users: number;
  };
  permissions: {
    can_create_table: boolean;
    can_create_user: boolean;
  };
  messages: {
    tables: string;
    users: string;
  };
}
