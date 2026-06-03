import { CommonModule } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

type AdminTab = 'dashboard' | 'restaurants' | 'plans' | 'payments' | 'users' | 'roles' | 'support' | 'audit';

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
  plan?: SaasPlan;
  tables_count?: number;
  orders_count?: number;
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

interface AdminUser {
  id?: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string;
  address?: string;
  password?: string;
  roles?: Array<{ id?: number; name: string }>;
  role?: string;
}

interface Role {
  id?: number;
  name: string;
  permissions?: Array<{ id?: number; name: string }>;
}

interface Paginated<T> {
  data: T[];
  current_page: number;
  last_page: number;
  total: number;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  readonly apiRoot = `${window.location.protocol}//${window.location.hostname}:8000/api`;
  readonly saasUrl = `${this.apiRoot}/saas`;

  token = signal(localStorage.getItem('admin_token') || '');
  currentUser = signal<AdminUser | null>(this.readStoredUser());
  loginStep = signal<'credentials' | 'otp'>('credentials');
  loginForm = { email: '', password: '', otp: '' };
  authLoading = signal(false);

  activeTab = signal<AdminTab>('dashboard');
  loading = signal(false);
  saving = signal(false);
  message = signal('');
  error = signal('');
  search = signal('');
  statusFilter = signal('all');
  paymentFilter = signal('all');
  restaurantPage = signal(1);
  pageSize = 8;

  overview = signal<any>(null);
  restaurants = signal<Restaurant[]>([]);
  plans = signal<SaasPlan[]>([]);
  payments = signal<Payment[]>([]);
  users = signal<AdminUser[]>([]);
  roles = signal<Role[]>([]);
  support = signal<any>({ contact_messages: [], account_requests: [], feedbacks: [] });
  auditEvents = signal<any[]>([]);

  restaurantModalOpen = signal(false);
  planModalOpen = signal(false);
  userModalOpen = signal(false);
  roleModalOpen = signal(false);
  restaurantForm: Restaurant = this.emptyRestaurant();
  planForm: SaasPlan = this.emptyPlan();
  userForm: AdminUser = this.emptyUser();
  roleForm: Role = this.emptyRole();
  ownerPassword = '';

  filteredRestaurants = computed(() => {
    const query = this.search().trim().toLowerCase();
    const status = this.statusFilter();
    return this.restaurants().filter((restaurant) => {
      const text = `${restaurant.name} ${restaurant.owner_name} ${restaurant.owner_email} ${restaurant.city ?? ''}`.toLowerCase();
      return (status === 'all' || restaurant.status === status) && (!query || text.includes(query));
    });
  });

  paginatedRestaurants = computed(() => {
    const start = (this.restaurantPage() - 1) * this.pageSize;
    return this.filteredRestaurants().slice(start, start + this.pageSize);
  });

  restaurantPages = computed(() => Math.max(1, Math.ceil(this.filteredRestaurants().length / this.pageSize)));

  metrics = computed(() => ({
    total: this.overview()?.metrics?.restaurants ?? this.restaurants().length,
    active: this.overview()?.metrics?.active_restaurants ?? this.restaurants().filter((item) => ['active', 'trial'].includes(item.status)).length,
    trial: this.overview()?.metrics?.trial_restaurants ?? this.restaurants().filter((item) => item.status === 'trial').length,
    pastDue: this.overview()?.metrics?.past_due_restaurants ?? this.restaurants().filter((item) => item.status === 'past_due').length,
    revenue: this.overview()?.metrics?.monthly_revenue ?? 0,
  }));

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    if (this.token()) this.loadAll();
  }

  login(): void {
    this.authLoading.set(true);
    this.clearNotice();
    this.http.post(`${this.apiRoot}/admin/auth/login`, {
      email: this.loginForm.email,
      password: this.loginForm.password,
    }).subscribe({
      next: () => {
        this.loginStep.set('otp');
        this.authLoading.set(false);
        this.message.set('Un code OTP a ete envoye a votre adresse email.');
      },
      error: (error) => this.authError(error),
    });
  }

  verifyOtp(): void {
    this.authLoading.set(true);
    this.clearNotice();
    this.http.post<any>(`${this.apiRoot}/admin/auth/verify-otp`, {
      email: this.loginForm.email,
      otp: this.loginForm.otp,
    }).subscribe({
      next: (response) => {
        localStorage.setItem('admin_token', response.token);
        localStorage.setItem('admin_user', JSON.stringify(response.user));
        this.token.set(response.token);
        this.currentUser.set(response.user);
        this.authLoading.set(false);
        this.loadAll();
      },
      error: (error) => this.authError(error),
    });
  }

  logout(): void {
    this.http.post(`${this.apiRoot}/auth/logout`, {}).subscribe({ error: () => undefined });
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    this.token.set('');
    this.currentUser.set(null);
    this.loginStep.set('credentials');
    this.loginForm.otp = '';
  }

  setTab(tab: AdminTab): void {
    this.activeTab.set(tab);
    this.clearNotice();
    if (tab === 'users') this.loadUsers();
    if (tab === 'roles') this.loadRoles();
  }

  loadAll(): void {
    this.loading.set(true);
    this.clearNotice();
    this.http.get<any>(`${this.saasUrl}/overview`).subscribe({
      next: (overview) => {
        this.overview.set(overview);
        this.plans.set(overview.plans ?? []);
      },
      error: (error) => this.showError(error),
    });
    this.http.get<Restaurant[]>(`${this.saasUrl}/restaurants`).subscribe({
      next: (restaurants) => this.restaurants.set(restaurants),
      error: (error) => this.showError(error),
    });
    this.loadPayments();
    this.loadSupport();
    this.loadAudit();
    this.loadRoles();
  }

  loadPayments(): void {
    let params = new HttpParams();
    if (this.paymentFilter() !== 'all') params = params.set('status', this.paymentFilter());
    this.http.get<Payment[]>(`${this.saasUrl}/payments`, { params }).subscribe({
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

  loadUsers(): void {
    this.http.get<Paginated<AdminUser>>(`${this.apiRoot}/users/list`).subscribe({
      next: (response) => this.users.set(response.data ?? []),
      error: (error) => this.showError(error),
    });
  }

  loadRoles(): void {
    this.http.get<Paginated<Role>>(`${this.apiRoot}/roles`, { params: { per_page: 100 } }).subscribe({
      next: (response) => this.roles.set(response.data ?? []),
      error: () => undefined,
    });
  }

  loadSupport(): void {
    this.http.get<any>(`${this.saasUrl}/support`).subscribe({
      next: (support) => this.support.set(support),
      error: (error) => this.showError(error),
    });
  }

  loadAudit(): void {
    this.http.get<{ events: any[] }>(`${this.saasUrl}/audit`).subscribe({
      next: (response) => this.auditEvents.set(response.events ?? []),
      error: (error) => this.showError(error),
    });
  }

  openRestaurantModal(restaurant?: Restaurant): void {
    this.restaurantForm = restaurant
      ? { ...this.emptyRestaurant(), ...restaurant, saas_plan_id: restaurant.saas_plan_id ?? restaurant.plan?.id }
      : { ...this.emptyRestaurant(), saas_plan_id: this.plans()[0]?.id };
    this.ownerPassword = '';
    this.restaurantModalOpen.set(true);
  }

  saveRestaurant(): void {
    this.saving.set(true);
    this.clearNotice();
    const payload = { ...this.restaurantForm };
    if (!payload.owner_password) delete payload.owner_password;
    const request = payload.id
      ? this.http.put<Restaurant>(`${this.saasUrl}/restaurants/${payload.id}`, payload)
      : this.http.post<Restaurant>(`${this.saasUrl}/restaurants`, payload);
    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.restaurantModalOpen.set(false);
        this.message.set(payload.id ? 'Restaurant mis a jour.' : 'Restaurant cree avec succes.');
        this.loadAll();
      },
      error: (error) => {
        this.saving.set(false);
        this.showError(error);
      },
    });
  }

  toggleRestaurant(restaurant: Restaurant): void {
    const status = restaurant.status === 'suspended' ? 'active' : 'suspended';
    this.http.put(`${this.saasUrl}/restaurants/${restaurant.id}`, { status }).subscribe({
      next: () => {
        this.message.set(`${restaurant.name} est maintenant ${status === 'active' ? 'actif' : 'suspendu'}.`);
        this.loadAll();
      },
      error: (error) => this.showError(error),
    });
  }

  deleteRestaurant(restaurant: Restaurant): void {
    if (!confirm(`Supprimer ${restaurant.name} de la plateforme ?`)) return;
    this.http.delete(`${this.saasUrl}/restaurants/${restaurant.id}`).subscribe({
      next: () => {
        this.message.set('Restaurant supprime.');
        this.loadAll();
      },
      error: (error) => this.showError(error),
    });
  }

  resetOwnerPassword(): void {
    if (!this.restaurantForm.id || this.ownerPassword.trim().length < 6) {
      this.error.set('Le mot de passe doit contenir au moins 6 caracteres.');
      return;
    }
    this.http.post(`${this.saasUrl}/restaurants/${this.restaurantForm.id}/reset-owner-password`, {
      password: this.ownerPassword.trim(),
    }).subscribe({
      next: () => {
        this.ownerPassword = '';
        this.message.set('Mot de passe proprietaire reinitialise.');
      },
      error: (error) => this.showError(error),
    });
  }

  openPlanModal(plan?: SaasPlan): void {
    this.planForm = plan
      ? { ...plan, monthly_price: Number(plan.monthly_price), features: this.planFeatures(plan).join('\n') }
      : this.emptyPlan();
    this.planModalOpen.set(true);
  }

  savePlan(): void {
    this.saving.set(true);
    const payload = {
      ...this.planForm,
      features: typeof this.planForm.features === 'string'
        ? this.planForm.features.split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean)
        : this.planForm.features,
    };
    const request = payload.id
      ? this.http.put(`${this.saasUrl}/plans/${payload.id}`, payload)
      : this.http.post(`${this.saasUrl}/plans`, payload);
    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.planModalOpen.set(false);
        this.message.set('Plan enregistre.');
        this.loadAll();
      },
      error: (error) => {
        this.saving.set(false);
        this.showError(error);
      },
    });
  }

  openUserModal(): void {
    this.userForm = this.emptyUser();
    this.userModalOpen.set(true);
  }

  saveUser(): void {
    this.saving.set(true);
    this.http.post<any>(`${this.apiRoot}/auth/register`, this.userForm).subscribe({
      next: () => {
        this.saving.set(false);
        this.userModalOpen.set(false);
        this.message.set('Compte utilisateur cree.');
        this.loadUsers();
      },
      error: (error) => {
        this.saving.set(false);
        this.showError(error);
      },
    });
  }

  openRoleModal(role?: Role): void {
    this.roleForm = role ? { ...role } : this.emptyRole();
    this.roleModalOpen.set(true);
  }

  saveRole(): void {
    this.saving.set(true);
    const request = this.roleForm.id
      ? this.http.put(`${this.apiRoot}/roles/${this.roleForm.id}`, { name: this.roleForm.name })
      : this.http.post(`${this.apiRoot}/roles`, { name: this.roleForm.name });
    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.roleModalOpen.set(false);
        this.message.set('Role enregistre.');
        this.loadRoles();
      },
      error: (error) => {
        this.saving.set(false);
        this.showError(error);
      },
    });
  }

  deleteRole(role: Role): void {
    if (!confirm(`Supprimer le role ${role.name} ?`)) return;
    this.http.delete(`${this.apiRoot}/roles/${role.id}`).subscribe({
      next: () => this.loadRoles(),
      error: (error) => this.showError(error),
    });
  }

  changeRestaurantPage(page: number): void {
    if (page < 1 || page > this.restaurantPages()) return;
    this.restaurantPage.set(page);
  }

  formatMoney(amount: number | string | undefined, currency = 'USD'): string {
    return `${Number(amount || 0).toLocaleString('fr-FR')} ${currency}`;
  }

  planFeatures(plan: SaasPlan): string[] {
    return Array.isArray(plan.features)
      ? plan.features
      : String(plan.features || '').split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean);
  }

  statusLabel(status?: string): string {
    const labels: Record<string, string> = {
      pending_payment: 'Paiement attendu', trial: 'Essai', active: 'Actif', past_due: 'En retard',
      suspended: 'Suspendu', cancelled: 'Annule', paid: 'Paye', pending: 'En attente', failed: 'Echoue',
    };
    return labels[status ?? ''] ?? (status || '-');
  }

  userName(): string {
    const user = this.currentUser();
    return user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email : 'Administrateur';
  }

  userInitials(): string {
    return this.userName().split(' ').map((part) => part.charAt(0)).join('').slice(0, 2).toUpperCase();
  }

  private emptyRestaurant(): Restaurant {
    return { name: '', owner_name: '', owner_email: '', owner_phone: '', city: '', country: 'CD', currency: 'CDF', status: 'trial', saas_plan_id: '', owner_password: '' };
  }

  private emptyUser(): AdminUser {
    return { first_name: '', last_name: '', email: '', phone_number: '', address: '', password: '', role: '' };
  }

  private emptyPlan(): SaasPlan {
    return { name: '', slug: '', description: '', monthly_price: 0, currency: 'USD', max_restaurants: 1, max_tables: 10, max_users: 3, features: '', is_popular: false, is_active: true };
  }

  private emptyRole(): Role {
    return { name: '' };
  }

  private readStoredUser(): AdminUser | null {
    try {
      return JSON.parse(localStorage.getItem('admin_user') || 'null');
    } catch {
      return null;
    }
  }

  private authError(error: any): void {
    this.authLoading.set(false);
    this.showError(error);
  }

  private showError(error: any): void {
    if (error?.status === 401) {
      this.logout();
      this.error.set('Votre session a expire. Connectez-vous de nouveau.');
      return;
    }
    const errors = error?.error?.errors;
    const validation = errors ? Object.values(errors).flat().join(' ') : '';
    this.error.set(validation || error?.error?.message || error?.message || 'Une erreur est survenue.');
  }

  private clearNotice(): void {
    this.message.set('');
    this.error.set('');
  }
}
