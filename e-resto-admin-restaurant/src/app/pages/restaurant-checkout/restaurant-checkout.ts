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
    return this.restaurant.plan?.name || this.selectedPlan.name || 'Plan Restaura Scan';
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
    return this.billingCycle === 'yearly' ? this.monthlyPrice * 10 : this.monthlyPrice;
  }

  get monthlyEquivalent(): number {
    return this.billingCycle === 'yearly' ? this.paymentAmount / 12 : this.monthlyPrice;
  }

  get installationFee(): number {
    const slug = String(this.restaurant.plan?.slug || this.planName).toLowerCase();
    return Number(this.selectedPlan.installation_fee ?? (slug.includes('business') ? 30_000 : 20_000));
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
      this.showMessage('Entrez le numero Mobile Money qui va payer l abonnement.', 'error');
      return;
    }

    if (!this.isValidWalletForProvider(walletId)) {
      this.showMessage(this.walletHint + '. Verifiez le numero avant de continuer.', 'error');
      return;
    }

    this.paying = true;
    this.stopPaymentStatusPolling();
    this.showMessage('Envoi de la demande de paiement vers votre telephone...', 'info');
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
      this.showMessage(response.message || 'Paiement confirme. Ouverture de votre espace restaurant...', 'success');
      setTimeout(() => this.router.navigate(['/dashboard']), 700);
      return;
    }

    if (status === 'pending') {
      this.waitingConfirmation = true;
      this.showMessage(response.message || 'Confirmez le paiement sur votre telephone. Nous attendons le retour operateur.', 'info');
      this.startPaymentStatusPolling(response.payment?.id);
      return;
    }

    this.showMessage(response.message || 'Le paiement n a pas ete confirme. Verifiez le numero et reessayez.', 'error');
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
        this.showMessage('La confirmation operateur prend trop de temps. Si vous avez valide sur le telephone, contactez le support avec la reference paiement.', 'error');
        return;
      }

      this.saas.checkoutMobileMoneyStatus(paymentId).pipe(timeout(15000)).subscribe({
        next: (response) => {
          if (response.payment?.status === 'paid') {
            this.stopPaymentStatusPolling();
            this.waitingConfirmation = false;
            this.completePaidSession(response);
            this.showMessage(response.message || 'Paiement confirme. Ouverture de votre espace restaurant...', 'success');
            setTimeout(() => this.router.navigate(['/dashboard']), 700);
            return;
          }

          if (response.payment?.status === 'failed') {
            this.stopPaymentStatusPolling();
            this.waitingConfirmation = false;
            this.showMessage(response.message || 'Paiement refuse ou expire. Verifiez le numero puis reessayez.', 'error');
          }
        },
        error: () => {
          this.showMessage('Paiement envoye. La confirmation operateur prend du temps, nous continuons a verifier.', 'info');
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
      return "Impossible de joindre le backend de paiement. Verifiez que Laravel est demarre sur le port 8000.";
    }

    if (error?.name === 'TimeoutError') {
      return 'Le gateway met trop de temps a repondre. Verifiez votre telephone avant de reessayer.';
    }

    const errors = error?.error?.errors;
    if (errors && typeof errors === 'object') {
      const messages = Object.values(errors).flat().filter((message) => typeof message === 'string');
      if (messages.length) {
        return messages.join(' ');
      }
    }

    return error?.error?.message || 'Paiement echoue. Verifiez le numero et reessayez.';
  }
}
