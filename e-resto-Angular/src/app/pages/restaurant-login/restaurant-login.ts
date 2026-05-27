import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

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

  constructor(private router: Router) {}

  login(): void {
    const account = JSON.parse(localStorage.getItem('restaurant_account') || '{}');
    if (account.email === this.email && account.password === this.password) {
      localStorage.setItem('restaurant_session', JSON.stringify({ email: this.email, paid: true }));
      this.router.navigate(['/restaurant/dashboard']);
      return;
    }
    this.message = 'Compte introuvable. Creez un compte restaurant puis payez votre plan.';
  }

  googleLogin(): void {
    const account = JSON.parse(localStorage.getItem('restaurant_account') || '{}');
    if (!account.email) {
      this.message = 'Google est disponible apres creation du compte restaurant.';
      return;
    }
    localStorage.setItem('restaurant_session', JSON.stringify({ email: account.email, provider: 'google', paid: true }));
    this.router.navigate(['/restaurant/dashboard']);
  }
}
