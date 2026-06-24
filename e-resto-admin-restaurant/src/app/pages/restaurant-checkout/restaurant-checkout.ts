import { CommonModule } from '@angular/common';
import { Component, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize, timeout } from 'rxjs';
import { SaasService } from '../../services/saas/saas-service';

@Component({
  selector: 'app-restaurant-checkout',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './restaurant-checkout.html',
  styleUrl: './restaurant-checkout.scss',
})
export class RestaurantCheckout implements OnDestroy {
  selectedPlan = JSON.parse(localStorage.getItem('selected_plan') || '{}');
  restaurant = JSON.parse(localStorage.getItem('pending_restaurant') || localStorage.getItem('restaurant_session') || '{}');
  mobile = { provider: 'MPESA', wallet_id: '+24383' };
  message = '';
  messageType: 'info' | 'success' | 'error' = 'info';
  paying = false;
  waitingConfirmation = false;
  paymentResponse: any = null;
  paymentReference = '';
  private paymentStatusTimer?: ReturnType<typeof setInterval>;
  private paymentStatusAttempts = 0;

  constructor(private router: Router, private saas: SaasService) {}

  get planName(): string {
    return this.restaurant.plan?.name || this.selectedPlan.name || 'Plan Restaurant Scan';
  }

  get monthlyPrice(): number {
    return Number(this.restaurant.plan?.monthly_price ?? this.selectedPlan.monthly_price ?? this.selectedPlan.price ?? 0);
  }

  get currency(): string {
    return this.restaurant.plan?.currency || this.selectedPlan.currency || 'USD';
  }

  get billingCycle(): 'monthly' | 'yearly' {
    return this.selectedPlan.cycle === 'yearly' ? 'yearly' : 'monthly';
  }

  get paymentAmount(): number {
    return this.billingCycle === 'yearly' ? this.annualMonthlyPrice * 12 : this.monthlyPrice;
  }

  get monthlyEquivalent(): number {
    return this.billingCycle === 'yearly' ? this.annualMonthlyPrice : this.monthlyPrice;
  }

  get installationFee(): number {
    const slug = String(this.restaurant.plan?.slug || this.planName).toLowerCase();
    return Number(this.selectedPlan.installation_fee ?? (slug.includes('business') ? 30_000 : 20_000));
  }

  private get annualMonthlyPrice(): number {
    if (Number(this.selectedPlan.annual_monthly_price) > 0) {
      return Number(this.selectedPlan.annual_monthly_price);
    }

    const slug = String(this.restaurant.plan?.slug || this.selectedPlan.slug || this.planName).toLowerCase();

    if (slug.includes('starter')) return 12;
    if (slug.includes('pro')) return 20;
    if (slug.includes('business')) return 25;

    return this.monthlyPrice;
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
    return ['past_due', 'expired', 'suspended'].includes(status);
  }

  ngOnDestroy(): void {
    this.stopPaymentStatusPolling();
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

    if (!this.restaurant.id) {
      this.router.navigate(['/restaurant/signup']);
      return;
    }

    const walletId = this.normalizedWalletId(this.mobile.wallet_id);
    this.mobile.wallet_id = walletId;

    if (!walletId || walletId === '+243') {
      this.showMessage("Entrez le numéro Mobile Money qui va payer l'abonnement.", 'error');
      return;
    }

    if (!this.isValidWalletForProvider(walletId)) {
      this.showMessage(this.walletHint + '. Vérifiez le numéro avant de continuer.', 'error');
      return;
    }

    this.paying = true;
    this.stopPaymentStatusPolling();
    this.showMessage('Envoi de la demande de paiement vers votre téléphone...', 'info');
    this.saas.checkoutMobileMoney({
      restaurant_id: this.restaurant.id,
      provider: this.mobile.provider,
      wallet_id: walletId,
      billing_cycle: this.billingCycle,
    }).pipe(
      timeout(60000),
      finalize(() => this.paying = false),
    ).subscribe({
      next: (response) => {
        this.paymentResponse = response.maishapay;
        this.paymentReference = response.payment?.reference || '';
        this.handlePaymentState(response);
      },
      error: (error) => {
        this.showMessage(this.errorMessage(error), 'error');
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

  private handlePaymentState(response: any): void {
    const status = response.payment?.status;

    if (status === 'paid' && response.session?.token) {
      this.completePaidSession(response);
      this.showMessage(response.message || 'Paiement confirmé. Ouverture de votre espace restaurant...', 'success');
      setTimeout(() => this.router.navigate(['/dashboard']), 700);
      return;
    }

    if (status === 'pending') {
      this.waitingConfirmation = true;
      this.showMessage(response.message || 'Confirmez le paiement sur votre téléphone. Nous attendons le retour opérateur.', 'info');
      this.startPaymentStatusPolling(response.payment?.id);
      return;
    }

    this.showMessage(response.message || "Le paiement n'a pas été confirmé. Vérifiez le numéro et réessayez.", 'error');
  }

  private startPaymentStatusPolling(paymentId?: string): void {
    if (!paymentId) {
      return;
    }

    this.stopPaymentStatusPolling();
    this.paymentStatusAttempts = 0;
    this.paymentStatusTimer = setInterval(() => {
      this.paymentStatusAttempts++;

      if (this.paymentStatusAttempts > 60) {
        this.stopPaymentStatusPolling();
        this.waitingConfirmation = false;
        this.showMessage('La confirmation opérateur prend trop de temps. Si vous avez validé sur le téléphone, contactez le support avec la référence paiement.', 'error');
        return;
      }

      this.saas.checkoutMobileMoneyStatus(paymentId).pipe(timeout(15000)).subscribe({
        next: (response) => {
          if (response.payment?.status === 'paid') {
            this.stopPaymentStatusPolling();
            this.waitingConfirmation = false;
            this.completePaidSession(response);
            this.showMessage(response.message || 'Paiement confirmé. Ouverture de votre espace restaurant...', 'success');
            setTimeout(() => this.router.navigate(['/dashboard']), 700);
            return;
          }

          if (response.payment?.status === 'failed') {
            this.stopPaymentStatusPolling();
            this.waitingConfirmation = false;
            this.showMessage(response.message || 'Paiement refusé ou expiré. Vérifiez le numéro puis réessayez.', 'error');
          }
        },
        error: () => {
          this.showMessage('Paiement envoyé. La confirmation opérateur prend du temps, nous continuons à vérifier.', 'info');
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

  private errorMessage(error: any): string {
    if (error?.status === 0) {
      return "Impossible de joindre le backend de paiement. Vérifiez que Laravel est démarré sur le port 8000.";
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

    return error?.error?.message || 'Paiement échoué. Vérifiez le numéro et réessayez.';
  }
}
