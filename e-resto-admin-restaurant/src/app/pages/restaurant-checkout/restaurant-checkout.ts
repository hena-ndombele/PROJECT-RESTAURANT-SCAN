import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize, timeout } from 'rxjs';
import Swal from 'sweetalert2';
import { SaasPlan } from '../../models/saas/saas.models';
import { SaasService } from '../../services/saas/saas-service';
import { AuthService } from '../../services/auth/auth-service';

@Component({
  selector: 'app-restaurant-checkout',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './restaurant-checkout.html',
  styleUrl: './restaurant-checkout.scss',
})
export class RestaurantCheckout implements OnInit, OnDestroy {
  selectedPlan = JSON.parse(localStorage.getItem('selected_plan') || '{}');
  restaurant = JSON.parse(localStorage.getItem('pending_restaurant') || localStorage.getItem('restaurant_session') || '{}');
  mobile = { provider: 'MPESA', wallet_id: '+24383' };
  message = '';
  messageType: 'info' | 'success' | 'error' = 'info';
  paying = false;
  waitingConfirmation = false;
  paymentResponse: any = null;
  paymentReference = '';
  planSyncing = true;
  planSyncError = '';
  paymentStep: 'idle' | 'sending' | 'waiting' | 'success' | 'failed' = 'idle';
  loggingOut = false;
  retryingPush = false;
  private paymentStatusTimer?: ReturnType<typeof setInterval>;
  private paymentStatusAttempts = 0;
  private paymentAttemptId = 0;
  private paymentClosedByUser = false;
  private readonly preventCheckoutBack = () => {
    if (this.subscriptionExpired) {
      history.pushState(null, '', window.location.href);
    }
  };

  constructor(
    private router: Router,
    private saas: SaasService,
    private auth: AuthService,
    private cdr: ChangeDetectorRef,
  ) {}

  get planName(): string {
    return this.restaurant.plan?.name || this.selectedPlan.name || 'Plan Restaurant Scan';
  }

  get monthlyPrice(): number {
    return this.canonicalMonthlyPrice();
  }

  get currency(): string {
    return this.restaurant.plan?.currency || this.selectedPlan.currency || 'USD';
  }

  get billingCycle(): 'monthly' | 'yearly' {
    return this.selectedPlan.cycle === 'yearly' ? 'yearly' : 'monthly';
  }

  get paymentAmount(): number {
    return this.billingCycle === 'yearly' ? this.yearlyPrice() : this.monthlyPrice;
  }

  get isProcessingPayment(): boolean {
    return this.paymentStep === 'sending' || this.paymentStep === 'waiting';
  }

  get providerLabel(): string {
    if (this.mobile.provider === 'AIRTEL') return 'AIRTEL_COD';
    if (this.mobile.provider === 'ORANGE') return 'ORANGE_COD';
    return 'MPESA_COD';
  }

  get transactionReference(): string {
    return this.paymentReference || 'Generation...';
  }

  get monthlyEquivalent(): number {
    return this.billingCycle === 'yearly' ? this.annualMonthlyPrice() : this.monthlyPrice;
  }

  get installationFee(): number {
    return Number(this.selectedPlan.installation_fee ?? 0);
  }

  get checkoutPrimary(): string {
    const theme = this.restaurant?.settings?.theme || this.restaurant?.theme || {};
    return this.normalizeColor(theme.primary_color || theme.primary || theme.accent, '#ff7a1a');
  }

  get checkoutPrimaryRgb(): string {
    return this.hexToRgb(this.checkoutPrimary);
  }

  ngOnInit(): void {
    if (this.hasActiveSession() && !this.subscriptionExpired) {
      this.router.navigate(['/dashboard'], { replaceUrl: true });
      return;
    }

    if (this.subscriptionExpired) {
      history.pushState(null, '', window.location.href);
      window.addEventListener('popstate', this.preventCheckoutBack);
    }

    this.syncSelectedPlanFromApi();
  }

  get walletHint(): string {
    if (this.mobile.provider === 'AIRTEL') {
      return 'Airtel Money doit commencer par +2439';
    }

    if (this.mobile.provider === 'ORANGE') {
      return 'Orange Money doit commencer par +24384 ou +24385';
    }

    return 'M-Pesa doit commencer par +24381, +24382 ou +24383';
  }

  get subscriptionExpired(): boolean {
    const status = String(this.restaurant.status || this.restaurant.subscription?.status || '').toLowerCase();
    return ['past_due', 'expired', 'suspended', 'trial_expired', 'trial-ended', 'trial_ended'].includes(status)
      || this.trialEnded;
  }

  get trialEnded(): boolean {
    const trialEnd = this.restaurant.trial_ends_at || this.restaurant.subscription?.trial_ends_at;
    if (!trialEnd) {
      return false;
    }

    const endDate = new Date(trialEnd);
    return !Number.isNaN(endDate.getTime()) && endDate.getTime() < Date.now();
  }

  get subscriptionExpiredMessage(): string {
    if (this.trialEnded) {
      return "Votre essai gratuit est terminé. Abonnez-vous pour continuer à accéder à votre espace restaurant.";
    }

    return "Votre abonnement est expire. Payez votre abonnement pour reactiver l'acces a votre espace restaurant.";
  }

  ngOnDestroy(): void {
    this.stopPaymentStatusPolling();
    window.removeEventListener('popstate', this.preventCheckoutBack);
  }

  logout(): void {
    if (this.loggingOut) {
      return;
    }

    this.loggingOut = true;
    this.clearPaymentState();
    this.auth.logout().pipe(finalize(() => this.loggingOut = false)).subscribe({
      next: () => this.router.navigate(['/restaurant/login'], { replaceUrl: true }),
      error: () => this.router.navigate(['/restaurant/login'], { replaceUrl: true }),
    });
  }

  retryPaymentPush(): void {
    if (this.retryingPush) {
      return;
    }

    this.retryingPush = true;
    this.stopPaymentStatusPolling();
    this.paying = false;
    this.waitingConfirmation = false;
    this.paymentClosedByUser = false;
    this.paymentStep = 'sending';
    setTimeout(() => {
      this.pay();
      setTimeout(() => this.retryingPush = false, 600);
    });
  }

  onProviderChange(provider: string): void {
    this.mobile.provider = provider;
    const normalized = this.normalizedWalletId(this.mobile.wallet_id);

    if (!this.isValidWalletForProvider(normalized)) {
      this.mobile.wallet_id = this.defaultWalletPrefix(provider);
      return;
    }

    this.mobile.wallet_id = normalized;
  }

  onWalletChange(value: string): void {
    this.mobile.wallet_id = this.normalizedWalletId(value);
  }

  pay(): void {
    if (this.paying || this.waitingConfirmation) {
      return;
    }

    if (this.planSyncing) {
      this.planSyncing = false;
    }

    if (!this.restaurant.id) {
      this.router.navigate(['/pricing'], { fragment: 'plans' });
      return;
    }

    const walletId = this.normalizedWalletId(this.mobile.wallet_id);
    this.mobile.wallet_id = walletId;

    if (!walletId || walletId === '+243') {
      this.showValidationAlert("Entrez le numero Mobile Money qui va payer l'abonnement.");
      return;
    }

    if (!this.isValidWalletForProvider(walletId)) {
      this.showValidationAlert('Verifiez le numero avant de continuer.');
      return;
    }

    this.paying = true;
    this.paymentStep = 'sending';
    this.paymentClosedByUser = false;
    const attemptId = ++this.paymentAttemptId;
    this.paymentReference = this.generatePaymentReference();
    this.stopPaymentStatusPolling();
    this.message = '';
    this.saas.checkoutMobileMoney({
      restaurant_id: this.restaurant.id,
      provider: this.mobile.provider,
      wallet_id: walletId,
      billing_cycle: this.billingCycle,
      saas_plan_id: this.selectedPlan.id || this.restaurant.plan?.id || this.restaurant.saas_plan_id,
      reference: this.paymentReference,
    }).pipe(
      timeout(60000),
      finalize(() => this.paying = false),
    ).subscribe({
      next: (response) => {
        if (this.shouldIgnorePaymentAttempt(attemptId)) {
          return;
        }

        this.paymentResponse = response.maishapay;
        this.paymentReference = this.extractPaymentReference(response);
        this.handlePaymentState(response, attemptId);
      },
      error: (error) => {
        if (this.shouldIgnorePaymentAttempt(attemptId)) {
          return;
        }

        if (error?.error?.payment) {
          this.paymentReference = this.extractPaymentReference(error.error);
          this.handlePaymentState(error.error, attemptId);
          return;
        }

        const message = this.errorMessage(error);
        this.paymentStep = 'failed';
        this.showPaymentAlert('failed', message);
      },
    });
  }

  private defaultWalletPrefix(provider: string): string {
    if (provider === 'AIRTEL') return '+2439';
    if (provider === 'ORANGE') return '+24385';
    return '+24383';
  }

  private normalizedWalletId(value: string): string {
    let raw = String(value || '').trim().replace(/[\s\-.()]/g, '');

    if (!raw) {
      return '';
    }

    if (raw.startsWith('00')) {
      raw = `+${raw.slice(2)}`;
    }

    let digits = raw.startsWith('+')
      ? raw.slice(1).replace(/\D/g, '')
      : raw.replace(/\D/g, '');

    if (digits.startsWith('0')) {
      digits = `243${digits.slice(1)}`;
    }

    if (!digits.startsWith('243')) {
      digits = `243${digits}`;
    }

    return `+${digits.slice(0, 12)}`;
  }

  private isValidWalletForProvider(walletId: string): boolean {
    if (this.mobile.provider === 'AIRTEL') {
      return /^\+2439\d{8}$/.test(walletId);
    }

    if (this.mobile.provider === 'ORANGE') {
      return /^\+243(84|85)\d{7}$/.test(walletId);
    }

    return /^\+243(81|82|83)\d{7}$/.test(walletId);
  }

  private handlePaymentState(response: any, attemptId = this.paymentAttemptId): void {
    if (this.shouldIgnorePaymentAttempt(attemptId)) {
      return;
    }

    const status = response.payment?.status;
    this.paymentReference = this.extractPaymentReference(response);

    if (status === 'paid' && response.session?.token) {
      this.completePaidSession(response);
      this.paymentStep = 'success';
      this.showPaymentAlert('success', this.cleanPaymentMessage(response.message, 'Paiement confirme. Ouverture de votre espace restaurant...'));
      setTimeout(() => this.router.navigate(['/dashboard']), 700);
      return;
    }

    if (status === 'pending') {
      this.waitingConfirmation = true;
      this.paymentStep = 'waiting';
      this.startPaymentStatusPolling(response.payment?.id, attemptId);
      return;
    }

    this.waitingConfirmation = false;
    this.paymentStep = 'failed';
    const message = this.cleanPaymentMessage(response.message, "Le paiement n'a pas ete confirme. Verifiez le numero et reessayez.");
    this.stopPaymentStatusPolling();
    this.showPaymentAlert('failed', message);
  }
  private startPaymentStatusPolling(paymentId?: string, attemptId = this.paymentAttemptId): void {
    if (!paymentId) {
      return;
    }

    this.stopPaymentStatusPolling();
    this.paymentStatusAttempts = 0;
    this.paymentStatusTimer = setInterval(() => {
      if (this.shouldIgnorePaymentAttempt(attemptId)) {
        this.stopPaymentStatusPolling();
        return;
      }

      this.paymentStatusAttempts++;

      if (this.paymentStatusAttempts > 24) {
        this.stopPaymentStatusPolling();
        this.waitingConfirmation = false;
        this.paymentStep = 'failed';
        const message = 'Paiement non confirme. Si vous avez annule sur votre telephone, vous pouvez relancer le paiement.';
        this.showPaymentAlert('failed', message);
        return;
      }

      this.saas.checkoutMobileMoneyStatus(paymentId).pipe(timeout(15000)).subscribe({
        next: (response) => {
          if (this.shouldIgnorePaymentAttempt(attemptId)) {
            return;
          }

          if (response.payment?.status === 'paid') {
            this.stopPaymentStatusPolling();
            this.waitingConfirmation = false;
            this.completePaidSession(response);
            this.paymentStep = 'success';
            this.showPaymentAlert('success', this.cleanPaymentMessage(response.message, 'Paiement confirme. Ouverture de votre espace restaurant...'));
            setTimeout(() => this.router.navigate(['/dashboard']), 700);
            return;
          }

          if (response.payment?.status === 'failed') {
            this.stopPaymentStatusPolling();
            this.waitingConfirmation = false;
            this.paymentStep = 'failed';
            const message = this.cleanPaymentMessage(response.message, 'Paiement refuse ou expire. Verifiez le numero puis reessayez.');
            this.stopPaymentStatusPolling();
            this.showPaymentAlert('failed', message);
          }
        },
        error: () => {
          if (this.shouldIgnorePaymentAttempt(attemptId)) {
            return;
          }
        },
      });
    }, 5000);
  }

  private stopPaymentStatusPolling(): void {
    if (this.paymentStatusTimer) {
      clearInterval(this.paymentStatusTimer);
      this.paymentStatusTimer = undefined;
    }
  }

  private syncSelectedPlanFromApi(): void {
    const selectedIdentifier = String(this.selectedPlan.id || this.selectedPlan.slug || this.restaurant.plan?.id || this.restaurant.plan?.slug || '');
    if (!selectedIdentifier) {
      this.planSyncing = false;
      return;
    }

    this.planSyncing = true;
    this.planSyncError = '';
    this.saas.plans().pipe(
      timeout(8000),
      finalize(() => this.planSyncing = false),
    ).subscribe({
      next: (plans) => {
        const plan = plans.find((item) => item.id === selectedIdentifier || item.slug === selectedIdentifier);
        if (!plan) {
          this.planSyncError = 'Tarif non actualise. Le prix affiche localement sera utilise.';
          return;
        }

        this.selectedPlan = {
          ...this.selectedPlan,
          ...plan,
          price: this.billingCycle === 'yearly' ? this.yearlyPrice(plan) : this.monthlyPriceForPlan(plan),
          monthly_price: this.monthlyPriceForPlan(plan),
          yearly_price: this.yearlyPrice(plan),
          annual_monthly_price: this.yearlyPrice(plan) / 12,
          cycle: this.billingCycle,
        };
        this.restaurant = {
          ...this.restaurant,
          plan: this.restaurant.plan ? { ...this.restaurant.plan, ...plan } : plan,
          saas_plan_id: plan.id,
        };
        localStorage.setItem('selected_plan', JSON.stringify(this.selectedPlan));
      },
      error: () => {
        this.planSyncError = 'Tarif non actualise. Le prix affiche localement sera utilise.';
      },
    });
  }

  private canonicalMonthlyPrice(): number {
    return this.monthlyPriceForPlan(this.currentPlan());
  }

  private annualMonthlyPrice(): number {
    return this.yearlyPrice() / 12;
  }

  private yearlyPrice(plan = this.currentPlan()): number {
    const yearly = Number(plan?.yearly_price ?? 0);
    return yearly > 0 ? yearly : this.monthlyPriceForPlan(plan) * 12;
  }

  private monthlyPriceForPlan(plan: Partial<SaasPlan> | any): number {
    return Number(plan?.monthly_price ?? plan?.price ?? 0);
  }

  private currentPlan(): Partial<SaasPlan> | any {
    return this.restaurant.plan || this.selectedPlan || {};
  }

  private hasActiveSession(): boolean {
    return !!(localStorage.getItem('auth_token') || localStorage.getItem('restaurant_token'));
  }

  private completePaidSession(response: any): void {
    if (!response.session?.token) {
      return;
    }

    localStorage.setItem('restaurant_token', response.session.token);
    localStorage.setItem('auth_token', response.session.token);
    if (response.session.token_expires_at) {
      localStorage.setItem('auth_token_expires_at', response.session.token_expires_at);
    }
    localStorage.setItem('user_data', JSON.stringify(response.session.user));
    localStorage.setItem('restaurant_session', JSON.stringify(response.session.restaurant));
    localStorage.setItem('restaurant_login_at', new Date().toISOString());
    localStorage.removeItem('pending_restaurant');
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
      showCloseButton: true,
      allowOutsideClick: false,
    });
  }

  private showPaymentAlert(type: 'success' | 'failed', message: string): void {
    const safeMessage = this.escapeHtml(this.cleanPaymentMessage(message, type === 'success'
      ? 'Paiement confirme. Ouverture de votre espace restaurant...'
      : 'Paiement echoue. Verifiez le numero et reessayez.'));
    const safeReference = this.escapeHtml(this.paymentReference);

    Swal.fire({
      icon: type === 'success' ? 'success' : 'error',
      title: type === 'success' ? 'Paiement reussi' : 'Echec du paiement',
      html: `
        <div class="checkout-swal">
          <div class="checkout-swal-icon"><i class="bi bi-credit-card-2-front-fill"></i></div>
          <p>${safeMessage}</p>
          ${safeReference ? `<small>Référence: <strong>${safeReference}</strong></small>` : ''}
        </div>
      `,
      confirmButtonText: type === 'success' ? 'Continuer' : 'Fermer',
      confirmButtonColor: type === 'success' ? '#16a34a' : '#dc2626',
      showCloseButton: true,
      allowOutsideClick: false,
      allowEscapeKey: false,
      didClose: () => {
        if (type === 'failed') {
          this.clearPaymentState(true);
        }
      },
    }).then(() => {
      if (type === 'failed') {
        this.clearPaymentState(true);
      }
    });
  }

  private clearPaymentState(userClosed = false): void {
    if (userClosed) {
      this.paymentClosedByUser = true;
      this.paymentAttemptId++;
    }

    this.stopPaymentStatusPolling();
    this.paying = false;
    this.waitingConfirmation = false;
    this.paymentStep = 'idle';
    this.paymentResponse = null;
    this.paymentReference = '';
    this.message = '';
    this.retryingPush = false;
    this.cdr.detectChanges();
  }

  private shouldIgnorePaymentAttempt(attemptId: number): boolean {
    return this.paymentClosedByUser || attemptId !== this.paymentAttemptId;
  }

  private extractPaymentReference(response: any): string {
    const payment = response?.payment || {};
    const maishapay = response?.maishapay || response?.maishapay_response || payment?.metadata?.maishapay_response || {};

    return String(
      payment.reference
      || maishapay.originatingTransactionId
      || maishapay.transactionReference
      || maishapay.data?.originatingTransactionId
      || maishapay.data?.transactionReference
      || this.paymentReference
      || ''
    );
  }

  private generatePaymentReference(): string {
    const now = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).slice(2, 7).toUpperCase();
    return `SUB-${now}${random}`;
  }

  private errorMessage(error: any): string {
    if (error?.status === 0) {
      return "Impossible de joindre le backend de paiement. Verifiez que Laravel est demarre sur le port 8000.";
    }

    if (error?.name === 'TimeoutError') {
      return 'La passerelle met trop de temps à répondre. Vérifiez votre téléphone avant de réessayer.';
    }

    const errors = error?.error?.errors;
    if (errors && typeof errors === 'object') {
      const messages = Object.values(errors).flat().filter((message) => typeof message === 'string');
      if (messages.length) {
        return messages.join(' ');
      }
    }

    return this.cleanPaymentMessage(error?.error?.message, 'Paiement echoue. Verifiez le numero et reessayez.');
  }

  private cleanPaymentMessage(message: any, fallback: string): string {
    const value = String(message || '').trim();

    if (!value) {
      return fallback;
    }

    if (/curl|timed out|timeout|operation timed|maishapay|collect\/v2|libcurl/i.test(value)) {
      return 'La passerelle de paiement est momentanément indisponible. Vérifiez votre téléphone, puis réessayez.';
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

  private normalizeColor(value: string | undefined, fallback: string): string {
    const color = String(value || '').trim();
    return /^#[0-9a-f]{6}$/i.test(color) ? color : fallback;
  }

  private hexToRgb(hex: string): string {
    const normalized = this.normalizeColor(hex, '#ff7a1a').replace('#', '');
    const value = parseInt(normalized, 16);
    return `${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}`;
  }
}

