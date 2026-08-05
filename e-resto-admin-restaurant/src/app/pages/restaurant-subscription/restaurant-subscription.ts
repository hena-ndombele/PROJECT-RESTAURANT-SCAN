import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize, timeout } from 'rxjs';
import Swal from 'sweetalert2';
import { Restaurant, SaasPlan, SubscriptionPayment } from '../../models/saas/saas.models';
import { SaasService } from '../../services/saas/saas-service';
import { AppPermissionService } from '../../services/auth/permission-service';

@Component({
  selector: 'app-restaurant-subscription',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './restaurant-subscription.html',
  styleUrl: './restaurant-subscription.scss',
})
export class RestaurantSubscription implements OnInit, OnDestroy {
  private readonly saas = inject(SaasService);
  private readonly permissions = inject(AppPermissionService);
  private paymentStatusTimer?: ReturnType<typeof setInterval>;
  private paymentStatusAttempts = 0;

  restaurant: any = JSON.parse(localStorage.getItem('restaurant_session') || 'null');
  plans: SaasPlan[] = this.localPlans();
  payments: SubscriptionPayment[] = [];
  paymentStatsPayments: SubscriptionPayment[] = [];
  currentPaymentPage = 1;
  readonly paymentPageSize = 10;
  selectedPlan: SaasPlan | null = null;
  billingCycle: 'monthly' | 'yearly' = 'monthly';
  paymentFilter = 'all';
  mobile = { provider: 'MPESA', wallet_id: '+24383' };
  plansLoading = false;
  loading = true;
  refreshing = false;
  payingPlanId = '';
  waitingConfirmation = false;
  paymentStep: 'idle' | 'sending' | 'waiting' | 'success' | 'failed' = 'idle';
  activePaymentReference = '';
  message = '';
  messageType: 'info' | 'success' | 'error' = 'info';

  ngOnInit(): void {
    this.loadRestaurant();
    this.loadPlans();
    this.loadPayments();
  }

  ngOnDestroy(): void {
    this.stopPaymentStatusPolling();
  }

  get currentPlanName(): string {
    return this.restaurant?.plan?.name || 'Plan non renseigné';
  }

  get statusTitle(): string {
    const status = String(this.restaurant?.status || '').toLowerCase();
    const days = this.daysRemaining();
    if (status === 'trial') return `Essai gratuit - ${days ?? 0} jours restants`;
    if (status === 'active') return days === null ? 'Abonnement actif' : `Abonnement actif - ${days} jours restants`;
    if (status === 'past_due') return 'Abonnement expiré';
    if (status === 'pending_payment') return 'Paiement en attente';
    return 'Abonnement';
  }

  get statusDescription(): string {
    const status = String(this.restaurant?.status || '').toLowerCase();
    const endDate = this.subscriptionEndDate();
    const formatted = endDate ? endDate.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) : null;
    if (status === 'trial') return `Vous pouvez payer ou changer de plan maintenant. Votre essai expire le ${formatted || 'bientôt'}.`;
    if (status === 'active') return `Vous pouvez renouveler ou changer de plan à tout moment. Fin prévue le ${formatted || 'non renseignée'}.`;
    return 'Réglez votre abonnement pour garder votre espace restaurant actif.';
  }

  get progressPercent(): number {
    const status = String(this.restaurant?.status || '').toLowerCase();
    if (status === 'trial') {
      const trialStart = this.dateValue(this.restaurant?.created_at || this.restaurant?.subscription?.starts_at);
      const trialEnd = this.dateValue(this.restaurant?.trial_ends_at);
      if (trialStart && trialEnd) return this.periodProgress(trialStart, trialEnd);

      const remaining = this.daysRemaining() ?? 0;
      return Math.min(100, Math.max(0, ((14 - remaining) / 14) * 100));
    }

    const startDate = this.subscriptionStartDate();
    const endDate = this.subscriptionEndDate();
    if (startDate && endDate) return this.periodProgress(startDate, endDate);

    return status === 'active' ? 0 : 100;
  }

  get checkoutPlan(): SaasPlan | null {
    return this.selectedPlan
      || this.plans.find((plan) => this.isCurrentPlan(plan))
      || this.plans.find((plan) => plan.is_popular)
      || this.plans[0]
      || null;
  }

  get paymentStatusText(): string {
    if (this.paymentStep === 'sending') return 'Connexion a la passerelle de paiement...';
    if (this.paymentStep === 'waiting') return 'Demande envoyee. Confirmez ou annulez sur votre telephone.';
    if (this.paymentStep === 'success') return 'Paiement confirme. Votre abonnement est actif.';
    if (this.paymentStep === 'failed') return 'Paiement non confirme. Vous pouvez réessayer.';
    return 'Pret pour lancer la demande Mobile Money.';
  }

  payCheckoutPlan(): void {
    const plan = this.checkoutPlan;
    if (!plan) return;
    this.pay(plan);
  }

  selectPlan(plan: SaasPlan): void {
    this.selectedPlan = plan;
    this.message = '';
  }

  canPaySubscription(): boolean {
    return this.permissions.has('subscription.pay');
  }

  pay(plan: SaasPlan): void {
    if (this.payingPlanId || this.waitingConfirmation || !this.restaurant?.id) return;
    if (!this.canPaySubscription()) {
      this.showValidationAlert("Vous n'avez pas la permission de payer l'abonnement.");
      return;
    }

    const walletId = this.normalizedWalletId(this.mobile.wallet_id);
    this.mobile.wallet_id = walletId;
    if (!this.isValidWalletForProvider(walletId)) {
      this.showValidationAlert(this.walletHint());
      return;
    }

    this.selectedPlan = plan;
    this.payingPlanId = plan.id;
    this.paymentStep = 'sending';
    this.activePaymentReference = '';
    this.stopPaymentStatusPolling();
    this.showPaymentLoadingAlert(
      'Chargement en cours...',
      'Nous envoyons la demande Mobile Money. Gardez votre téléphone a proximité.'
    );

    this.saas.checkoutMobileMoney({
      restaurant_id: this.restaurant.id,
      saas_plan_id: plan.id,
      provider: this.mobile.provider,
      wallet_id: walletId,
      billing_cycle: this.billingCycle,
    }).pipe(
      timeout(60000),
      finalize(() => this.payingPlanId = ''),
    ).subscribe({
      next: (response) => this.handlePaymentState(response),
      error: (error) => {
        if (error?.error?.payment) {
          this.handlePaymentState(error.error);
          return;
        }

        const message = this.errorMessage(error);
        this.paymentStep = 'failed';
        this.showPaymentAlert('failed', message);
      },
    });
  }

  loadPayments(resetPage = true): void {
    if (resetPage) {
      this.currentPaymentPage = 1;
    }
    this.saas.restaurantPayments(this.paymentFilter).subscribe({
      next: (payments) => {
        this.payments = payments;
        if (this.paymentFilter === 'all') {
          this.paymentStatsPayments = payments;
        } else {
          this.loadPaymentStats();
        }
        this.loading = false;
      },
      error: () => {
        this.payments = [];
        if (this.paymentFilter === 'all') {
          this.paymentStatsPayments = [];
        }
        this.loading = false;
      },
    });
  }

  get paginatedPayments(): SubscriptionPayment[] {
    const start = (this.currentPaymentPage - 1) * this.paymentPageSize;
    return this.payments.slice(start, start + this.paymentPageSize);
  }

  get totalPaymentPages(): number {
    return Math.max(1, Math.ceil(this.payments.length / this.paymentPageSize));
  }

  get paymentPages(): number[] {
    return Array.from({ length: this.totalPaymentPages }, (_, index) => index + 1);
  }

  get paidPaymentsCount(): number {
    return this.paymentStatsPayments.filter((payment) => payment.status === 'paid').length;
  }

  get failedPaymentsCount(): number {
    return this.paymentStatsPayments.filter((payment) => payment.status === 'failed').length;
  }

  get pendingPaymentsCount(): number {
    return this.paymentStatsPayments.filter((payment) => payment.status === 'pending').length;
  }

  goToPaymentPage(page: number): void {
    if (page < 1 || page > this.totalPaymentPages) return;
    this.currentPaymentPage = page;
  }

  refreshPage(): void {
    if (this.refreshing) return;
    this.refreshing = true;
    this.message = '';
    this.loadRestaurant();
    this.loadPlans();
    this.saas.restaurantPayments(this.paymentFilter).pipe(
      finalize(() => this.refreshing = false),
    ).subscribe({
      next: (payments) => {
        this.payments = payments;
        if (this.paymentFilter === 'all') {
          this.paymentStatsPayments = payments;
        } else {
          this.loadPaymentStats();
        }
        this.loading = false;
      },
      error: () => {
        this.payments = [];
        if (this.paymentFilter === 'all') {
          this.paymentStatsPayments = [];
        }
        this.loading = false;
      },
    });
  }

  planPrice(plan: SaasPlan): number {
    return this.billingCycle === 'yearly' ? this.paymentAmount(plan) / 12 : this.paymentAmount(plan);
  }

  paymentAmount(plan: SaasPlan): number {
    return this.effectiveAmount(plan, this.billingCycle);
  }

  originalPaymentAmount(plan: SaasPlan): number {
    return this.billingCycle === 'yearly' ? this.yearlyPrice(plan) : this.monthlyPrice(plan);
  }

  hasActivePromo(plan: SaasPlan): boolean {
    return !!plan.has_active_promo && Number(plan.promo_percent || 0) > 0;
  }

  dailyPrice(plan: SaasPlan): number {
    return this.planPrice(plan) / 30;
  }

  displayCurrency(plan: SaasPlan | SubscriptionPayment): string {
    return plan.currency === 'USD' ? '$' : plan.currency || 'USD';
  }

  formatMoney(amount: number | string, currency = 'USD'): string {
    return `${Number(amount || 0).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} ${currency === 'USD' ? '$' : currency}`;
  }

  statusLabel(status: string): string {
    return ({ paid: 'Payé', pending: 'En attente', failed: 'Échoué', refunded: 'Remboursé' } as Record<string, string>)[status] || status;
  }

  planTone(plan: SaasPlan): string {
    const slug = String(plan.slug || plan.name).toLowerCase();
    if (slug.includes('business')) return 'business';
    if (slug.includes('pro')) return 'pro';
    return 'starter';
  }

  providerLogo(provider = this.mobile.provider): string {
    if (provider === 'AIRTEL') return 'assets/logo/airel%20money.png';
    if (provider === 'ORANGE') return 'assets/logo/orange.jpg';
    return 'assets/logo/mpse.png';
  }

  providerLabel(provider = this.mobile.provider): string {
    if (provider === 'AIRTEL') return 'Airtel Money';
    if (provider === 'ORANGE') return 'Orange Money';
    return 'M-Pesa';
  }

  isCurrentPlan(plan: SaasPlan): boolean {
    return String(this.restaurant?.plan?.slug || '').toLowerCase() === String(plan.slug || '').toLowerCase();
  }

  onProviderChange(provider: string): void {
    this.mobile.provider = provider;
    this.mobile.wallet_id = this.defaultWalletPrefix(provider);
  }

  private loadRestaurant(): void {
    this.saas.currentRestaurant().subscribe({
      next: (restaurant) => {
        this.restaurant = restaurant;
        localStorage.setItem('restaurant_session', JSON.stringify(restaurant));
      },
      error: () => {},
    });
  }

  private loadPlans(): void {
    this.plansLoading = this.plans.length === 0;
    this.saas.plans().pipe(
      timeout(15000),
    ).subscribe({
      next: (plans) => {
        const syncedPlans = this.sortedActivePlans(plans);
        if (syncedPlans.length) {
          this.plans = syncedPlans;
        }
        this.plansLoading = false;
      },
      error: () => {
        if (!this.plans.length) {
          this.plans = this.localPlans();
        }
        this.plansLoading = false;
      },
    });
  }

  private sortedActivePlans(plans: SaasPlan[]): SaasPlan[] {
    return plans
      .filter((plan) => plan.is_active !== false)
      .sort((left, right) => this.planOrder(left) - this.planOrder(right));
  }

  private handlePaymentState(response: any): void {
    const status = response.payment?.status;
    this.activePaymentReference = response.payment?.reference || this.activePaymentReference;
    this.upsertPayment(response.payment);

    if (response.restaurant) {
      this.restaurant = response.restaurant;
      localStorage.setItem('restaurant_session', JSON.stringify(response.restaurant));
    }

    this.loadPayments(false);
    if (status === 'paid') {
      this.completePaidSession(response);
      this.paymentStep = 'success';
      this.showPaymentAlert('success', response.message || 'Paiement confirme. Votre abonnement est actif.');
      this.waitingConfirmation = false;
      return;
    }

    if (status === 'pending') {
      this.waitingConfirmation = true;
      this.paymentStep = 'waiting';
      this.showPaymentLoadingAlert('Verifiez votre telephone', 'Une demande de paiement vient d etre envoyee. Validez-la sur votre telephone pour activer l abonnement.');
      this.startPaymentStatusPolling(response.payment?.id);
      return;
    }

    if (status === 'failed') {
      this.waitingConfirmation = false;
      this.paymentStep = 'failed';
      this.showPaymentAlert('failed', response.message || 'Paiement echoue. La transaction a ete annulee ou refusee.');
      return;
    }

    this.paymentStep = 'failed';
    this.showPaymentAlert('failed', response.message || 'Paiement non confirme. Verifiez le numero puis réessayez.');
  }

  private upsertPayment(payment?: SubscriptionPayment): void {
    if (!payment?.id) return;

    this.paymentStatsPayments = this.upsertPaymentInList(this.paymentStatsPayments, payment);
    const existingIndex = this.payments.findIndex((item) => item.id === payment.id);
    if (existingIndex >= 0) {
      if (this.paymentMatchesCurrentFilter(payment)) {
        this.payments = this.payments.map((item, index) => index === existingIndex ? { ...item, ...payment } : item);
      } else {
        this.payments = this.payments.filter((item) => item.id !== payment.id);
      }
      return;
    }

    if (!this.paymentMatchesCurrentFilter(payment)) {
      return;
    }

    this.payments = [payment, ...this.payments];
    this.currentPaymentPage = 1;
    this.loading = false;
  }

  private loadPaymentStats(): void {
    this.saas.restaurantPayments('all').subscribe({
      next: (payments) => this.paymentStatsPayments = payments,
      error: () => {},
    });
  }

  private upsertPaymentInList(payments: SubscriptionPayment[], payment: SubscriptionPayment): SubscriptionPayment[] {
    const existingIndex = payments.findIndex((item) => item.id === payment.id);
    if (existingIndex >= 0) {
      return payments.map((item, index) => index === existingIndex ? { ...item, ...payment } : item);
    }

    return [payment, ...payments].slice(0, 100);
  }

  private paymentMatchesCurrentFilter(payment: SubscriptionPayment): boolean {
    return this.paymentFilter === 'all' || payment.status === this.paymentFilter;
  }

  private startPaymentStatusPolling(paymentId?: string): void {
    if (!paymentId) return;
    this.paymentStatusAttempts = 0;
    this.stopPaymentStatusPolling();
    this.paymentStatusTimer = setInterval(() => {
      this.paymentStatusAttempts++;
      if (this.paymentStatusAttempts > 24) {
        this.stopPaymentStatusPolling();
        this.waitingConfirmation = false;
        this.paymentStep = 'failed';
        const message = 'Paiement non confirme. Si vous avez annule sur votre telephone, relancez simplement le paiement.';
        this.showPaymentAlert('failed', message);
        return;
      }

      this.saas.checkoutMobileMoneyStatus(paymentId).pipe(timeout(15000)).subscribe({
        next: (response) => {
          this.handlePaymentState(response);
          if (['paid', 'failed'].includes(response.payment?.status)) {
            this.stopPaymentStatusPolling();
            this.waitingConfirmation = false;
          }
        },
        error: () => this.showPaymentLoadingAlert('Verification en cours', 'La confirmation operateur prend du temps. Verifiez votre telephone, nous continuons a verifier.'),
      });
    }, 5000);
  }

  private stopPaymentStatusPolling(): void {
    if (this.paymentStatusTimer) {
      clearInterval(this.paymentStatusTimer);
      this.paymentStatusTimer = undefined;
    }
  }

  private completePaidSession(response: any): void {
    if (response.session?.token) {
      localStorage.setItem('restaurant_token', response.session.token);
      localStorage.setItem('auth_token', response.session.token);
      localStorage.setItem('user_data', JSON.stringify(response.session.user));
    }
    if (response.session?.restaurant || response.restaurant) {
      const restaurant = response.session?.restaurant || response.restaurant;
      this.restaurant = restaurant;
      localStorage.setItem('restaurant_session', JSON.stringify(restaurant));
    }
  }

  private subscriptionEndDate(): Date | null {
    const value = this.restaurant?.status === 'trial'
      ? this.restaurant?.trial_ends_at
      : this.restaurant?.subscription_ends_at || this.restaurant?.subscription?.ends_at || this.restaurant?.subscription?.current_period_end;
    const date = value ? new Date(value) : null;
    return date && !Number.isNaN(date.getTime()) ? date : null;
  }

  private subscriptionStartDate(): Date | null {
    const status = String(this.restaurant?.status || '').toLowerCase();
    const endDate = this.subscriptionEndDate();

    if (status === 'active' && endDate) {
      const startDate = new Date(endDate);
      if (this.currentBillingCycle() === 'yearly') {
        startDate.setFullYear(startDate.getFullYear() - 1);
      } else {
        startDate.setMonth(startDate.getMonth() - 1);
      }

      return startDate;
    }

    return this.dateValue(
      this.restaurant?.subscription?.starts_at ||
      this.restaurant?.subscription?.created_at ||
      this.restaurant?.created_at
    );
  }

  private dateValue(value: unknown): Date | null {
    const date = value ? new Date(String(value)) : null;
    return date && !Number.isNaN(date.getTime()) ? date : null;
  }

  private periodProgress(start: Date, end: Date): number {
    const total = end.getTime() - start.getTime();
    if (total <= 0) return 100;
    const elapsed = Date.now() - start.getTime();
    return Math.round(Math.min(100, Math.max(0, (elapsed / total) * 100)));
  }

  private daysRemaining(): number | null {
    const date = this.subscriptionEndDate();
    if (!date) return null;
    return Math.max(0, Math.ceil((date.getTime() - Date.now()) / 86400000));
  }

  private annualMonthlyPrice(plan: SaasPlan): number {
    return this.yearlyPrice(plan) / 12;
  }

  private yearlyPrice(plan: SaasPlan): number {
    const yearly = Number(plan.yearly_price ?? 0);
    return yearly > 0 ? yearly : this.monthlyPrice(plan) * 12;
  }

  private monthlyPrice(plan: SaasPlan): number {
    return Number(plan.monthly_price ?? 0);
  }

  private effectiveAmount(plan: SaasPlan, cycle: 'monthly' | 'yearly'): number {
    if (!this.hasActivePromo(plan)) {
      return cycle === 'yearly' ? this.yearlyPrice(plan) : this.monthlyPrice(plan);
    }

    const promoPrice = cycle === 'yearly' ? plan.promo_yearly_price : plan.promo_monthly_price;
    if (promoPrice !== null && promoPrice !== undefined) {
      return Number(promoPrice);
    }

    const base = cycle === 'yearly' ? this.yearlyPrice(plan) : this.monthlyPrice(plan);
    return Math.round(base * (1 - Number(plan.promo_percent || 0) / 100) * 100) / 100;
  }

  private currentBillingCycle(): 'monthly' | 'yearly' {
    const paidPayment = this.payments
      .filter((payment) => payment.status === 'paid' && payment.metadata?.billing_cycle)
      .sort((left, right) => new Date(right.paid_at || right.created_at || 0).getTime() - new Date(left.paid_at || left.created_at || 0).getTime())[0];

    return paidPayment?.metadata?.billing_cycle === 'yearly' ? 'yearly' : 'monthly';
  }

  private normalizedWalletId(value: string): string {
    let raw = String(value || '').trim().replace(/[\s\-.()]/g, '');
    if (!raw) return '';
    if (raw.startsWith('00')) raw = `+${raw.slice(2)}`;
    let digits = raw.startsWith('+') ? raw.slice(1).replace(/\D/g, '') : raw.replace(/\D/g, '');
    if (digits.startsWith('0')) digits = `243${digits.slice(1)}`;
    if (!digits.startsWith('243')) digits = `243${digits}`;
    return `+${digits.slice(0, 12)}`;
  }

  private isValidWalletForProvider(walletId: string): boolean {
    if (this.mobile.provider === 'AIRTEL') return /^\+2439\d{8}$/.test(walletId);
    if (this.mobile.provider === 'ORANGE') return /^\+243(84|85)\d{7}$/.test(walletId);
    return /^\+243(81|82|83)\d{7}$/.test(walletId);
  }

  walletHint(): string {
    if (this.mobile.provider === 'AIRTEL') return 'Airtel Money doit commencer par +2439.';
    if (this.mobile.provider === 'ORANGE') return 'Orange Money doit commencer par +24384 ou +24385.';
    return 'M-Pesa doit commencer par +24381, +24382 ou +24383.';
  }

  private defaultWalletPrefix(provider: string): string {
    if (provider === 'AIRTEL') return '+2439';
    if (provider === 'ORANGE') return '+24385';
    return '+24383';
  }

  private showMessage(message: string, type: 'info' | 'success' | 'error'): void {
    this.message = message;
    this.messageType = type;
  }

  private showValidationAlert(message: string): void {
    Swal.fire({
      icon: 'warning',
      title: 'Vérification requise',
      text: message,
      confirmButtonText: 'Fermer',
      confirmButtonColor: '#dc2626',
      allowOutsideClick: false,
    });
  }

  private showPaymentLoadingAlert(title: string, message: string): void {
    const safeTitle = this.escapeHtml(title);
    const safeMessage = this.escapeHtml(message);
    const safeReference = this.escapeHtml(this.activePaymentReference);
    const html = `
      <div class="subscription-swal">
        <div class="subscription-swal-icon loading"><i class="ti ti-device-mobile"></i></div>
        <p>${safeMessage}</p>
        <small>Ne fermez pas cette fenêtre. Confirmez ou annulez directement sur votre téléphone.</small>
        ${safeReference ? `<small>Référence: <strong>${safeReference}</strong></small>` : ''}
      </div>
    `;

    if (Swal.isVisible()) {
      Swal.update({
        title: safeTitle,
        html,
        showConfirmButton: false,
      });
      Swal.showLoading();
      return;
    }

    Swal.fire({
      title: safeTitle,
      html,
      showConfirmButton: false,
      showCloseButton: false,
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => Swal.showLoading(),
    });
  }

  private showPaymentAlert(type: 'success' | 'failed', message: string): void {
    const safeMessage = this.escapeHtml(this.cleanPaymentMessage(message, type === 'success'
      ? 'Paiement confirme. Votre abonnement est actif.'
      : 'Paiement echoue. Verifiez le numero et reessayez.'));
    const safeReference = this.escapeHtml(this.activePaymentReference);

    Swal.fire({
      icon: type === 'success' ? 'success' : 'error',
      title: type === 'success' ? 'Paiement reussi' : 'Echec du paiement',
      html: `
        <div class="subscription-swal">
          <div class="subscription-swal-icon"><i class="ti ti-credit-card"></i></div>
          <p>${safeMessage}</p>
          ${safeReference ? `<small>Référence: <strong>${safeReference}</strong></small>` : ''}
        </div>
      `,
      confirmButtonText: type === 'success' ? 'Continuer' : 'Réessayer',
      confirmButtonColor: type === 'success' ? '#16a34a' : '#dc2626',
      allowOutsideClick: false,
      allowEscapeKey: false,
    });
  }

  private errorMessage(error: any): string {
    if (error?.name === 'TimeoutError') {
      return 'Le paiement est en cours de confirmation. Consultez votre téléphone pour vérifier si une demande de validation est en attente avant de réessayer.';
    }

    return this.cleanPaymentMessage(error?.error?.message, 'Paiement échoué. Vérifiez le numéro et réessayez.');
  }

  private cleanPaymentMessage(message: any, fallback: string): string {
    const value = String(message || '').trim();
    if (!value) return fallback;

    if (/undefined array key|exception|stack trace|curl|timed out|timeout|operation timed|maishapay|collect\/v2|libcurl/i.test(value)) {
      return 'La passerelle de paiement ne répond pas correctement pour le moment. Vérifiez votre téléphone, puis réessayez.';
    }

    return value;
  }

  private escapeHtml(value: string): string {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
  private planOrder(plan: SaasPlan): number {
    const slug = String(plan.slug).toLowerCase();
    return slug === 'starter' ? 1 : slug === 'pro' ? 2 : slug === 'business' ? 3 : 99;
  }

  private localPlans(): SaasPlan[] {
    return [
      { id: 'starter', name: 'Starter', slug: 'starter', description: 'Pour démarrer simplement.', monthly_price: 15, yearly_price: 144, currency: 'USD', max_restaurants: 1, max_tables: 6, max_users: 5, max_dishes: 15, features: [], is_popular: false },
      { id: 'pro', name: 'Pro', slug: 'pro', description: 'Pour automatiser le service.', monthly_price: 35, yearly_price: 360, currency: 'USD', max_restaurants: 1, max_tables: null, max_users: null, features: [], is_popular: true },
      { id: 'business', name: 'Business', slug: 'business', description: 'Pour les restaurants multi-sites.', monthly_price: 50, yearly_price: 480, currency: 'USD', max_restaurants: 5, max_tables: null, max_users: null, features: [], is_popular: false },
    ];
  }
}

