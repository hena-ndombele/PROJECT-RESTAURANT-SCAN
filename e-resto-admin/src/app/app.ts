import { CommonModule } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

type AdminTab = 'dashboard' | 'restaurants' | 'payments' | 'users' | 'roles' | 'contacts' | 'newsletter' | 'support' | 'audit';

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

interface ContactMessage {
  id: string;
  name: string;
  email: string;
  phone?: string;
  subject?: string;
  message: string;
  created_at?: string;
}

interface NewsletterSubscriber {
  id: string;
  email: string;
  source?: string;
  status?: string;
  subscribed_at?: string;
  created_at?: string;
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
 readonly apiRoot = 'http://localhost:8000/api';
  readonly saasUrl = `${this.apiRoot}/saas`;

  token = signal(localStorage.getItem('admin_token') || '');
  currentUser = signal<AdminUser | null>(this.readStoredUser());
  loginStep = signal<'credentials' | 'otp'>('credentials');
  loginForm = { email: '', password: '', otp: '' };
  otpDigits = ['', '', '', '', ''];
  authLoading = signal(false);
  otpResending = signal(false);

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
  support = signal<any>({ contact_messages: [], feedbacks: [], Réservations: [] });
  contacts = signal<ContactMessage[]>([]);
  newsletterSubscribers = signal<NewsletterSubscriber[]>([]);
  auditEvents = signal<any[]>([]);
  contactSearch = signal('');
  contactEmail = signal('');
  contactDate = signal('');
  contactMonth = signal('');
  contactYear = signal('');
  contactPage = signal(1);
  contactPagination = signal({ current_page: 1, last_page: 1, total: 0 });
  newsletterSearch = signal('');
  newsletterEmail = signal('');
  newsletterDate = signal('');
  newsletterMonth = signal('');
  newsletterYear = signal('');
  newsletterPage = signal(1);
  newsletterPagination = signal({ current_page: 1, last_page: 1, total: 0 });

  restaurantModalOpen = signal(false);
  restaurantDetails = signal<Restaurant | null>(null);
  restaurantConfirmation = signal<{
    type: 'delete' | 'toggle';
    restaurant: Restaurant;
    title: string;
    message: string;
    confirmText: string;
    tone: 'danger' | 'warning';
  } | null>(null);
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

  metrics = computed(() => {
    const planCounts = this.overview()?.metrics?.plan_counts ?? {};

    return {
      total: this.overview()?.metrics?.restaurants ?? this.restaurants().length,
      starter: planCounts.starter ?? this.countRestaurantsByPlan('starter'),
      pro: planCounts.pro ?? this.countRestaurantsByPlan('pro'),
      business: planCounts.business ?? this.countRestaurantsByPlan('business'),
      revenue: this.overview()?.metrics?.monthly_revenue ?? 0,
    };
  });

  planDistribution = computed(() => {
    const metrics = this.metrics();
    const total = Math.max(metrics.starter + metrics.pro + metrics.business, 1);

    return [
      { label: 'Starter', value: metrics.starter, percent: Math.round((metrics.starter / total) * 100), tone: 'starter' },
      { label: 'Pro', value: metrics.pro, percent: Math.round((metrics.pro / total) * 100), tone: 'pro' },
      { label: 'Business', value: metrics.business, percent: Math.round((metrics.business / total) * 100), tone: 'business' },
    ];
  });

  chartBars = computed(() => {
    const values = this.planDistribution().map((item) => item.value);
    const max = Math.max(...values, 1);

    return this.planDistribution().map((item) => ({
      ...item,
      height: Math.max((item.value / max) * 100, item.value > 0 ? 8 : 0),
    }));
  });

  chartLinePoints = computed(() => {
    const bars = this.chartBars();
    const width = 300;
    const height = 130;
    const step = bars.length > 1 ? width / (bars.length - 1) : width;

    return bars.map((item, index) => `${index * step},${height - (item.height / 100) * height}`).join(' ');
  });

  segmentGradient = computed(() => {
    const distribution = this.planDistribution();
    let cursor = 0;
    const colors: Record<string, string> = { starter: '#ff7a1a', pro: '#d71920', business: '#0f172a' };
    const parts = distribution.map((item) => {
      const start = cursor;
      cursor += item.percent;
      return `${colors[item.tone] ?? '#64748b'} ${start}% ${cursor}%`;
    });

    return `conic-gradient(${parts.join(', ')})`;
  });

  restaurantStats = computed(() => {
    const restaurants = this.restaurants();
    const total = Math.max(restaurants.length, 1);
    const active = restaurants.filter((item) => ['active', 'trial'].includes(item.status)).length;
    const suspended = restaurants.filter((item) => ['suspended', 'cancelled'].includes(item.status)).length;
    const pastDue = restaurants.filter((item) => item.status === 'past_due').length;

    return [
      { label: 'Restaurants actifs ou en essai', value: active, percent: Math.round((active / total) * 100), tone: 'active' },
      { label: 'Restaurants en retard de paiement', value: pastDue, percent: Math.round((pastDue / total) * 100), tone: 'past_due' },
      { label: 'Restaurants suspendus ou annules', value: suspended, percent: Math.round((suspended / total) * 100), tone: 'suspended' },
    ];
  });

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    if (this.isTokenExpired()) {
      this.clearAdminSession();
      return;
    }

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
        this.showTemporaryMessage('Un code OTP a ete envoye a votre adresse email.');
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
        if (response.token_expires_at) {
          localStorage.setItem('admin_token_expires_at', response.token_expires_at);
        }
        localStorage.setItem('admin_user', JSON.stringify(response.user));
        this.token.set(response.token);
        this.currentUser.set(response.user);
        this.authLoading.set(false);
        this.loadAll();
      },
      error: (error) => this.authError(error),
    });
  }

  resendAdminOtp(): void {
    if (!this.loginForm.email) {
      this.error.set('Adresse email requise pour renvoyer le code OTP.');
      return;
    }

    this.otpResending.set(true);
    this.clearNotice();
    this.http.post<{ message?: string }>(`${this.apiRoot}/otp/request`, {
      email: this.loginForm.email,
    }).subscribe({
      next: (response) => {
        this.otpResending.set(false);
        this.otpDigits = ['', '', '', '', ''];
        this.loginForm.otp = '';
        this.showTemporaryMessage(response.message || 'Un nouveau code OTP a ete envoye a votre adresse email.');
      },
      error: (error) => {
        this.otpResending.set(false);
        this.authError(error);
      },
    });
  }

  setOtpDigit(event: Event, index: number): void {
    const input = event.target as HTMLInputElement;
    const digit = input.value.replace(/\D/g, '').slice(-1);
    this.otpDigits[index] = digit;
    input.value = digit;
    this.loginForm.otp = this.otpDigits.join('');

    if (digit && index < this.otpDigits.length - 1) {
      const next = input.parentElement?.children[index + 1] as HTMLInputElement | undefined;
      next?.focus();
    }
  }

  handleOtpKeydown(event: KeyboardEvent, index: number): void {
    const input = event.target as HTMLInputElement;
    if (event.key === 'Backspace' && !input.value && index > 0) {
      const previous = input.parentElement?.children[index - 1] as HTMLInputElement | undefined;
      previous?.focus();
    }
  }

  logout(): void {
    this.http.post(`${this.apiRoot}/auth/logout`, {}).subscribe({ error: () => undefined });
    this.clearAdminSession();
    this.loginStep.set('credentials');
    this.loginForm.otp = '';
    this.otpDigits = ['', '', '', '', ''];
  }

  setTab(tab: AdminTab): void {
    this.activeTab.set(tab);
    this.clearNotice();
    if (tab === 'users') this.loadUsers();
    if (tab === 'roles') this.loadRoles();
    if (tab === 'contacts') this.loadContacts();
    if (tab === 'newsletter') this.loadNewsletterSubscribers();
  }

  refreshCurrentView(): void {
    this.clearNotice();
    if (this.activeTab() === 'dashboard') {
      this.loadAll();
      return;
    }
    if (this.activeTab() === 'restaurants') {
      this.loadRestaurants();
      return;
    }
    if (this.activeTab() === 'payments') {
      this.loadPayments();
      return;
    }
    if (this.activeTab() === 'users') {
      this.loadUsers();
      return;
    }
    if (this.activeTab() === 'roles') {
      this.loadRoles();
      return;
    }
    if (this.activeTab() === 'contacts') {
      this.loadContacts();
      return;
    }
    if (this.activeTab() === 'newsletter') {
      this.loadNewsletterSubscribers();
      return;
    }
    if (this.activeTab() === 'support') {
      this.loadSupport();
      return;
    }
    if (this.activeTab() === 'audit') {
      this.loadAudit();
    }
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
    this.loadRestaurants();
    this.loadPayments();
    this.loadSupport();
    this.loadAudit();
    this.loadRoles();
  }

  loadRestaurants(): void {
    this.http.get<Restaurant[]>(`${this.saasUrl}/restaurants`).subscribe({
      next: (restaurants) => this.restaurants.set(restaurants),
      error: (error) => this.showError(error),
    });
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

  loadContacts(): void {
    this.http.get<Paginated<ContactMessage>>(`${this.saasUrl}/contact-messages`, {
      params: this.adminListingParams({
        page: this.contactPage(),
        search: this.contactSearch(),
        email: this.contactEmail(),
        date: this.contactDate(),
        month: this.contactMonth(),
        year: this.contactYear(),
      }),
    }).subscribe({
      next: (response) => {
        this.contacts.set(response.data ?? []);
        this.contactPagination.set({
          current_page: response.current_page || 1,
          last_page: response.last_page || 1,
          total: response.total || 0,
        });
      },
      error: (error) => this.showError(error),
    });
  }

  loadNewsletterSubscribers(): void {
    this.http.get<Paginated<NewsletterSubscriber>>(`${this.saasUrl}/newsletter-subscribers`, {
      params: this.adminListingParams({
        page: this.newsletterPage(),
        search: this.newsletterSearch(),
        email: this.newsletterEmail(),
        date: this.newsletterDate(),
        month: this.newsletterMonth(),
        year: this.newsletterYear(),
      }),
    }).subscribe({
      next: (response) => {
        this.newsletterSubscribers.set(response.data ?? []);
        this.newsletterPagination.set({
          current_page: response.current_page || 1,
          last_page: response.last_page || 1,
          total: response.total || 0,
        });
      },
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
    this.restaurantConfirmation.set({
      type: 'toggle',
      restaurant,
      title: status === 'active' ? 'Activer ce restaurant ?' : 'Desactiver ce restaurant ?',
      message: status === 'active'
        ? `${restaurant.name} pourra de nouveau acceder a son espace.`
        : `${restaurant.name} ne pourra plus utiliser son espace jusqu'a reactivation.`,
      confirmText: status === 'active' ? 'Activer' : 'Desactiver',
      tone: 'warning',
    });
  }

  confirmToggleRestaurant(restaurant: Restaurant): void {
    const status = restaurant.status === 'suspended' ? 'active' : 'suspended';
    this.http.put(`${this.saasUrl}/restaurants/${restaurant.id}`, { status }).subscribe({
      next: () => {
        this.restaurantConfirmation.set(null);
        this.message.set(`${restaurant.name} est maintenant ${status === 'active' ? 'actif' : 'suspendu'}.`);
        this.loadAll();
      },
      error: (error) => this.showError(error),
    });
  }

  deleteRestaurant(restaurant: Restaurant): void {
    this.restaurantConfirmation.set({
      type: 'delete',
      restaurant,
      title: 'Supprimer ce restaurant ?',
      message: `${restaurant.name} sera retire de la plateforme. Cette action est definitive.`,
      confirmText: 'Supprimer',
      tone: 'danger',
    });
  }

  confirmDeleteRestaurant(restaurant: Restaurant): void {
    this.http.delete(`${this.saasUrl}/restaurants/${restaurant.id}`).subscribe({
      next: () => {
        this.restaurantConfirmation.set(null);
        this.message.set('Restaurant supprime.');
        this.loadAll();
      },
      error: (error) => this.showError(error),
    });
  }

  confirmRestaurantAction(): void {
    const confirmation = this.restaurantConfirmation();
    if (!confirmation) return;

    if (confirmation.type === 'delete') {
      this.confirmDeleteRestaurant(confirmation.restaurant);
      return;
    }

    this.confirmToggleRestaurant(confirmation.restaurant);
  }

  showRestaurantDetails(restaurant: Restaurant): void {
    this.restaurantDetails.set(restaurant);
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
        this.message.set('Mot de passe propriétaire reinitialise.');
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

  changeContactPage(page: number): void {
    if (page < 1 || page > this.contactPagination().last_page) return;
    this.contactPage.set(page);
    this.loadContacts();
  }

  changeNewsletterPage(page: number): void {
    if (page < 1 || page > this.newsletterPagination().last_page) return;
    this.newsletterPage.set(page);
    this.loadNewsletterSubscribers();
  }

  applyContactFilters(): void {
    this.contactPage.set(1);
    this.loadContacts();
  }

  applyNewsletterFilters(): void {
    this.newsletterPage.set(1);
    this.loadNewsletterSubscribers();
  }

  resetContactFilters(): void {
    this.contactSearch.set('');
    this.contactEmail.set('');
    this.contactDate.set('');
    this.contactMonth.set('');
    this.contactYear.set('');
    this.applyContactFilters();
  }

  resetNewsletterFilters(): void {
    this.newsletterSearch.set('');
    this.newsletterEmail.set('');
    this.newsletterDate.set('');
    this.newsletterMonth.set('');
    this.newsletterYear.set('');
    this.applyNewsletterFilters();
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

  private countRestaurantsByPlan(planSlug: string): number {
    const needle = planSlug.toLowerCase();
    return this.restaurants().filter((restaurant) => {
      const slug = String(restaurant.plan?.slug || '').toLowerCase();
      const name = String(restaurant.plan?.name || '').toLowerCase();
      return slug.includes(needle) || name.includes(needle);
    }).length;
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

  private adminListingParams(filters: Record<string, string | number>): HttpParams {
    let params = new HttpParams().set('per_page', '10');
    Object.entries(filters).forEach(([key, value]) => {
      const normalized = String(value ?? '').trim();
      if (normalized) {
        params = params.set(key, normalized);
      }
    });
    return params;
  }

  private readStoredUser(): AdminUser | null {
    try {
      return JSON.parse(localStorage.getItem('admin_user') || 'null');
    } catch {
      return null;
    }
  }

  private isTokenExpired(): boolean {
    const expiresAt = localStorage.getItem('admin_token_expires_at');
    return Boolean(expiresAt && new Date(expiresAt).getTime() <= Date.now());
  }

  private clearAdminSession(): void {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_token_expires_at');
    localStorage.removeItem('admin_user');
    this.token.set('');
    this.currentUser.set(null);
  }

  private authError(error: any): void {
    this.authLoading.set(false);
    this.showError(error);
  }

  private showError(error: any): void {
    if (error?.status === 0) {
      this.error.set("Impossible de joindre l'API. Verifiez le domaine https://api.restaurascan.com, le certificat SSL et la configuration CORS du backend.");
      return;
    }

    if (error?.status === 401) {
      this.logout();
      this.error.set('Votre session a expire. Connectez-vous de nouveau.');
      return;
    }
    const errors = error?.error?.errors;
    const validation = errors ? Object.values(errors).flat().join(' ') : '';
    this.error.set(validation || error?.error?.message || error?.message || 'Une erreur est survenue.');
  }

  private showTemporaryMessage(message: string, delay = 3500): void {
    this.message.set(message);
    window.setTimeout(() => {
      if (this.message() === message) this.message.set('');
    }, delay);
  }

  private clearNotice(): void {
    this.message.set('');
    this.error.set('');
  }
}
