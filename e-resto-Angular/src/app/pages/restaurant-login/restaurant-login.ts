import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { SaasService } from '../../services/saas/saas-service';

@Component({
  selector: 'app-restaurant-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './restaurant-login.html',
  styleUrl: './restaurant-login.scss',
})
export class RestaurantLogin {
  email = '';
  password = '';
  message = '';
  loading = false;

  constructor(private router: Router, private saas: SaasService) {}

  login(): void {
    this.loading = true;
    this.saas.login({ email: this.email, password: this.password }).subscribe({
      next: (response) => {
        localStorage.setItem('restaurant_token', response.token);
        localStorage.setItem('auth_token', response.token);
        localStorage.setItem('user_data', JSON.stringify(response.user));
        localStorage.setItem('restaurant_session', JSON.stringify(response.restaurant));
        this.router.navigate(['/restaurant/dashboard']);
      },
      error: (error) => {
        this.message = error?.error?.message || 'Compte introuvable ou abonnement non actif.';
        if (error?.status === 402 && error.error?.restaurant) {
          localStorage.setItem('pending_restaurant', JSON.stringify(error.error.restaurant));
          this.router.navigate(['/restaurant/checkout']);
          return;
        }
        this.loading = false;
      },
    });
  }

  googleLogin(): void {
    this.message = 'Google pourra etre branche plus tard. Pour ce MVP, utilisez email et mot de passe.';
  }
}
