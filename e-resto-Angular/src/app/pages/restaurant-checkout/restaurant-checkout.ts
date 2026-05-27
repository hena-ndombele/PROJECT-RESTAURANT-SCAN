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
  account = JSON.parse(localStorage.getItem('restaurant_account') || '{}');
  card = { number: '', name: '', expiry: '', cvc: '' };
  message = '';
  paying = false;

  constructor(private router: Router, private saas: SaasService) {}

  pay(): void {
    if (!this.account.email) {
      this.router.navigate(['/restaurant/signup']);
      return;
    }

    if (!this.card.number || !this.card.name || !this.card.expiry || !this.card.cvc) {
      this.message = 'Entrez les informations Visa/Mastercard pour activer le plan.';
      return;
    }

    this.paying = true;
    this.saas.registerInterest({
      name: this.account.restaurant_name,
      owner_name: this.account.owner_name,
      owner_email: this.account.email,
      owner_phone: this.account.phone,
      saas_plan_id: this.selectedPlan.id,
    }).subscribe({
      next: () => {
        localStorage.setItem('restaurant_session', JSON.stringify({ email: this.account.email, plan: this.selectedPlan, paid: true }));
        this.message = 'Paiement accepte. Ouverture de votre espace restaurant...';
        setTimeout(() => this.router.navigate(['/restaurant/dashboard']), 700);
      },
      error: () => {
        this.message = 'Le paiement de test a echoue. Reessayez.';
        this.paying = false;
      },
    });
  }
}
