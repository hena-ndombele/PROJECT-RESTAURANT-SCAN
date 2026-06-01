import { CommonModule } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

type AdminTab = 'dashboard' | 'restaurants' | 'plans' | 'payments' | 'wallet' | 'support' | 'audit';

interface SaasPlan {
  id?: string;
  name: string;
  slug?: string;
  description?: string;
  monthly_price: number | string;
  currency: string;
  max_restaurants: number;
  max_tables: number;
  max_users: number;
  features: string[] | string;
  is_popular?: boolean;
  is_active?: boolean;
}

interface Restaurant {
  id?: string;
  name: string;
  slug?: string;
  owner_name: string;
  owner_email: string;
  owner_phone?: string;
  city?: string;
  country?: string;
  currency?: string;
  status: string;
  saas_plan_id?: string;
  trial_ends_at?: string;
  subscription_ends_at?: string;
  plan?: SaasPlan;
  subscription?: { status: string; next_billing_at?: string; amount?: number; currency?: string };
  users_count?: number;
  tables_count?: number;
  orders_count?: number;
  subscription_revenue?: number;
  owner_password?: string;
}

interface Payment {
  id: string;
  reference?: string;
  status: string;
  amount: number;
  currency: string;
  provider?: string;
  method?: string;
  paid_at?: string;
  created_at?: string;
  restaurant?: Restaurant;
}

interface WalletBalance {
  wallet: string;
  currency: string;
  balance: number;
  status: string;
  updated_at?: string;
}

interface SupportCenter {
  contact_messages: any[];
  account_requests: any[];
  feedbacks: any[];
  reservations: any[];
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  readonly apiUrl = `${window.location.protocol}//${window.location.hostname}:8000/api/saas`;

  activeTab = signal<AdminTab>('dashboard');
  loading = signal(false);
  saving = signal(false);
  message = signal('');
  error = signal('');
  search = signal('');
  statusFilter = signal('all');
  paymentFilter = signal('all');
  walletVisible = signal(false);

  overview = signal<any>(null);
  restaurants = signal<Restaurant[]>([]);
  plans = signal<SaasPlan[]>([]);
  payments = signal<Payment[]>([]);
  wallet = signal<Record<string, WalletBalance>>({});
  support = signal<SupportCenter>({ contact_messages: [], account_requests: [], feedbacks: [], reservations: [] });
  auditEvents = signal<any[]>([]);
  selectedRestaurant = signal<Restaurant | null>(null);
  restaurantForm: Restaurant = this.emptyRestaurant();
  planForm: SaasPlan = this.emptyPlan();
  ownerPassword = '';

  filteredRestaurants = computed(() => {
    const query = this.search().trim().toLowerCase();
    const status = this.statusFilter();

    return this.restaurants().filter((restaurant) => {
      const matchesStatus = status === 'all' || restaurant.status === status;
      const text = `${restaurant.name} ${restaurant.owner_name} ${restaurant.owner_email} ${restaurant.city ?? ''}`.toLowerCase();
      return matchesStatus && (!query || text.includes(query));
    });
  });

  metrics = computed(() => {
    const restaurants = this.restaurants();
    const payments = this.payments();
    const revenue = payments
      .filter((payment) => payment.status === 'paid')
      .reduce((total, payment) => total + Number(payment.amount || 0), 0);

    return {
      total: this.overview()?.metrics?.restaurants ?? restaurants.length,
      active: this.overview()?.metrics?.active_restaurants ?? restaurants.filter((item) => ['active', 'trial'].includes(item.status)).length,
      trial: this.overview()?.metrics?.trial_restaurants ?? restaurants.filter((item) => item.status === 'trial').length,
      pastDue: this.overview()?.metrics?.past_due_restaurants ?? restaurants.filter((item) => item.status === 'past_due').length,
      revenue: this.overview()?.metrics?.monthly_revenue ?? revenue,
      paymentsPending: payments.filter((payment) => payment.status === 'pending').length,
    };
  });

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadAll();
  }

  setTab(tab: AdminTab): void {
    this.activeTab.set(tab);
    this.clearNotice();
  }

  loadAll(): void {
    this.loading.set(true);
    this.clearNotice();

    this.http.get<any>(`${this.apiUrl}/overview`).subscribe({
      next: (overview) => {
        this.overview.set(overview);
        this.plans.set(overview.plans ?? []);
        if (!this.planForm.id && overview.plans?.[0]) {
          this.restaurantForm = { ...this.restaurantForm, saas_plan_id: overview.plans[0].id };
        }
      },
      error: (error) => this.showError(error),
    });

    this.http.get<Restaurant[]>(`${this.apiUrl}/restaurants`).subscribe({
      next: (restaurants) => this.restaurants.set(restaurants),
      error: (error) => this.showError(error),
    });

    this.loadWallet();
    this.loadSupport();
    this.loadAudit();
    this.loadPayments();
  }

  loadPayments(): void {
    let params = new HttpParams();
    if (this.paymentFilter() !== 'all') {
      params = params.set('status', this.paymentFilter());
    }

    this.http.get<Payment[]>(`${this.apiUrl}/payments`, { params }).subscribe({
      next: (payments) => {
        this.payments.set(payments);
        this.loading.set(false);
      },
      error: (error) => {
        this.loading.set(false);
        this.showError(error);
      },
    });
  }

  loadWallet(): void {
    this.http.get<{ balances: Record<string, WalletBalance> }>(`${this.apiUrl}/wallet/balance`).subscribe({
      next: (response) => this.wallet.set(response.balances ?? {}),
      error: (error) => this.showError(error),
    });
  }

  loadSupport(): void {
    this.http.get<SupportCenter>(`${this.apiUrl}/support`).subscribe({
      next: (support) => this.support.set({
        contact_messages: support.contact_messages ?? [],
        account_requests: support.account_requests ?? [],
        feedbacks: support.feedbacks ?? [],
        reservations: support.reservations ?? [],
      }),
      error: (error) => this.showError(error),
    });
  }

  loadAudit(): void {
    this.http.get<{ events: any[] }>(`${this.apiUrl}/audit`).subscribe({
      next: (response) => this.auditEvents.set(response.events ?? []),
      error: (error) => this.showError(error),
    });
  }

  selectRestaurant(restaurant: Restaurant): void {
    this.selectedRestaurant.set(restaurant);
    this.restaurantForm = {
      ...this.emptyRestaurant(),
      ...restaurant,
      saas_plan_id: restaurant.saas_plan_id ?? restaurant.plan?.id,
      owner_password: '',
    };
  }

  newRestaurant(): void {
    const firstPlan = this.plans()[0];
    this.selectedRestaurant.set(null);
    this.restaurantForm = { ...this.emptyRestaurant(), saas_plan_id: firstPlan?.id };
    this.setTab('restaurants');
  }

  saveRestaurant(): void {
    this.saving.set(true);
    this.clearNotice();
    const form = this.restaurantForm;
    const payload = { ...form };
    if (!payload.owner_password) {
      delete payload.owner_password;
    }

    const request = form.id
      ? this.http.put<Restaurant>(`${this.apiUrl}/restaurants/${form.id}`, payload)
      : this.http.post<Restaurant>(`${this.apiUrl}/restaurants`, payload);

    request.subscribe({
      next: (restaurant) => {
        this.saving.set(false);
        this.message.set(form.id ? 'Restaurant mis a jour avec succes.' : 'Restaurant cree avec succes.');
        this.selectedRestaurant.set(restaurant);
        this.restaurantForm = { ...this.restaurantForm, id: restaurant.id };
        this.loadAll();
      },
      error: (error) => {
        this.saving.set(false);
        this.showError(error);
      },
    });
  }

  quickStatus(restaurant: Restaurant, status: string): void {
    this.http.put<Restaurant>(`${this.apiUrl}/restaurants/${restaurant.id}`, { status }).subscribe({
      next: () => {
        this.message.set(`Statut ${status} applique a ${restaurant.name}.`);
        this.loadAll();
      },
      error: (error) => this.showError(error),
    });
  }

  deleteRestaurant(restaurant: Restaurant): void {
    if (!confirm(`Supprimer ${restaurant.name} de la plateforme ?`)) {
      return;
    }

    this.http.delete(`${this.apiUrl}/restaurants/${restaurant.id}`).subscribe({
      next: () => {
        this.message.set('Restaurant supprime avec succes.');
        this.newRestaurant();
        this.loadAll();
      },
      error: (error) => this.showError(error),
    });
  }

  resetOwnerPassword(): void {
    if (!this.restaurantForm.id) return;
    const password = this.ownerPassword.trim();
    if (password.length < 6) {
      this.error.set('Le mot de passe doit contenir au moins 6 caracteres.');
      return;
    }

    this.http.post(`${this.apiUrl}/restaurants/${this.restaurantForm.id}/reset-owner-password`, { password }).subscribe({
      next: () => {
        this.ownerPassword = '';
        this.message.set('Mot de passe proprietaire reinitialise.');
      },
      error: (error) => this.showError(error),
    });
  }

  editPlan(plan: SaasPlan): void {
    this.planForm = {
      ...plan,
      monthly_price: Number(plan.monthly_price),
      features: Array.isArray(plan.features) ? plan.features.join('\n') : plan.features,
    };
    this.setTab('plans');
  }

  newPlan(): void {
    this.planForm = this.emptyPlan();
    this.setTab('plans');
  }

  savePlan(): void {
    this.saving.set(true);
    this.clearNotice();
    const form = this.planForm;
    const payload = {
      ...form,
      features: typeof form.features === 'string'
        ? form.features.split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean)
        : form.features,
    };

    const request = form.id
      ? this.http.put<SaasPlan>(`${this.apiUrl}/plans/${form.id}`, payload)
      : this.http.post<SaasPlan>(`${this.apiUrl}/plans`, payload);

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.message.set(form.id ? 'Plan mis a jour.' : 'Plan cree.');
        this.newPlan();
        this.loadAll();
      },
      error: (error) => {
        this.saving.set(false);
        this.showError(error);
      },
    });
  }

  formatMoney(amount: number | string | undefined, currency = 'USD'): string {
    return `${Number(amount || 0).toLocaleString('fr-FR')} ${currency}`;
  }

  maskedMoney(amount: number | string | undefined, currency = 'USD'): string {
    return this.walletVisible() ? this.formatMoney(amount, currency) : '••••••';
  }

  planFeatures(plan: SaasPlan): string[] {
    if (Array.isArray(plan.features)) {
      return plan.features;
    }

    return String(plan.features || '')
      .split(/\r?\n|,/)
      .map((feature) => feature.trim())
      .filter(Boolean);
  }

  statusLabel(status: string | undefined): string {
    const labels: Record<string, string> = {
      pending_payment: 'Paiement attendu',
      trial: 'Essai',
      active: 'Actif',
      past_due: 'En retard',
      suspended: 'Suspendu',
      cancelled: 'Annule',
      paid: 'Paye',
      pending: 'En attente',
      failed: 'Echoue',
    };
    return labels[status ?? ''] ?? (status || '-');
  }

  private emptyRestaurant(): Restaurant {
    return {
      name: '',
      owner_name: '',
      owner_email: '',
      owner_phone: '',
      city: '',
      country: 'CD',
      currency: 'CDF',
      status: 'trial',
      saas_plan_id: '',
      owner_password: '',
    };
  }

  private emptyPlan(): SaasPlan {
    return {
      name: '',
      slug: '',
      description: '',
      monthly_price: 0,
      currency: 'USD',
      max_restaurants: 1,
      max_tables: 10,
      max_users: 3,
      features: '',
      is_popular: false,
      is_active: true,
    };
  }

  private showError(error: any): void {
    const message = error?.error?.message || error?.error?.details || error?.message || 'Une erreur est survenue.';
    this.error.set(message);
  }

  private clearNotice(): void {
    this.message.set('');
    this.error.set('');
  }
}
