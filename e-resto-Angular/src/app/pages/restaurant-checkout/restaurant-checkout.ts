import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { SaasService } from '../../services/saas/saas-service';

@Component({
  selector: 'app-restaurant-checkout',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './restaurant-checkout.html',
  styleUrl: './restaurant-checkout.scss',
})
export class RestaurantCheckout {
  selectedPlan = JSON.parse(localStorage.getItem('selected_plan') || '{}');
  restaurant = JSON.parse(localStorage.getItem('pending_restaurant') || localStorage.getItem('restaurant_session') || '{}');
  mobile = { provider: 'MPESA', wallet_id: '' };
  message = '';
  paying = false;
  paymentResponse: any = null;

  constructor(private router: Router, private saas: SaasService) {}

  pay(): void {
    if (!this.restaurant.id) {
      this.router.navigate(['/restaurant/signup']);
      return;
    }

    if (!this.mobile.wallet_id) {
      this.message = 'Entrez le numero Mobile Money qui va payer l abonnement.';
      return;
    }

    this.paying = true;
    this.saas.checkoutMobileMoney({
      restaurant_id: this.restaurant.id,
      provider: this.mobile.provider,
      wallet_id: this.mobile.wallet_id,
    }).subscribe({
      next: (response) => {
        this.paymentResponse = response.maishapay;
        if (response.session?.token) {
          localStorage.setItem('restaurant_token', response.session.token);
          localStorage.setItem('auth_token', response.session.token);
          localStorage.setItem('user_data', JSON.stringify(response.session.user));
          localStorage.setItem('restaurant_session', JSON.stringify(response.session.restaurant));
          localStorage.removeItem('pending_restaurant');
        }
        this.message = response.payment?.status === 'paid'
          ? 'Paiement confirme. Ouverture de votre espace restaurant...'
          : 'Paiement envoye. Votre espace sera active apres confirmation.';
        setTimeout(() => this.router.navigate(['/restaurant/dashboard']), 700);
      },
      error: () => {
        this.message = 'Le paiement Mobile Money a echoue. Verifiez le numero et reessayez.';
        this.paying = false;
      },
    });
  }
}
