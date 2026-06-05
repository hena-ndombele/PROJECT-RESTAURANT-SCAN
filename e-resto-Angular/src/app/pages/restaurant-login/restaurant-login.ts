import { CommonModule } from '@angular/common';
import { Component, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize, timeout } from 'rxjs';
import { SaasService } from '../../services/saas/saas-service';

@Component({
  selector: 'app-restaurant-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './restaurant-login.html',
  styleUrl: './restaurant-login.scss',
})
export class RestaurantLogin implements OnDestroy {
  email = '';
  password = '';
  message = '';
  loading = false;
  private messageTimer?: ReturnType<typeof setTimeout>;

  constructor(
    private router: Router,
    private saas: SaasService,
  ) {}

  ngOnDestroy(): void {
    this.clearMessageTimer();
  }

  login(): void {
    if (this.loading) {
      return;
    }

    this.message = '';
    this.clearMessageTimer();

    const email = this.email.trim();
    const password = this.password;

    if (!email || !password) {
      this.message = 'Renseignez votre email et votre mot de passe.';
      this.hideMessageAfterDelay();
      return;
    }

    if (!this.isValidEmail(email)) {
      this.message = 'Adresse email invalide. Verifiez le format puis reessayez.';
      this.hideMessageAfterDelay();
      return;
    }

    this.loading = true;
    this.saas.login({ email, password }).pipe(
      timeout(10000),
      finalize(() => this.loading = false),
    ).subscribe({
      next: (response) => this.completeLogin(response),
      error: (error) => this.handleLoginError(error, false),
    });
  }

  private completeLogin(response: any): void {
    localStorage.setItem('restaurant_token', response.token);
    localStorage.setItem('auth_token', response.token);
    localStorage.setItem('user_data', JSON.stringify(response.user));
    localStorage.setItem('restaurant_session', JSON.stringify(response.restaurant));
    localStorage.setItem('restaurant_login_at', new Date().toISOString());
    this.router.navigate(['/restaurant/dashboard']);
  }

  private handleLoginError(error: any, google: boolean): void {
    this.message = this.validationMessage(error);
    this.hideMessageAfterDelay();

    if (error?.status === 402 && error.error?.restaurant) {
      localStorage.setItem('pending_restaurant', JSON.stringify(error.error.restaurant));
      this.router.navigate(['/restaurant/checkout']);
      return;
    }

    if (google && error?.status === 404) {
      this.message = 'Ce compte Google ne possede pas encore d espace restaurant. Creez votre compte pour continuer.';
    }
  }

  private validationMessage(error: any): string {
    if (error?.status === 0) {
      return "Impossible de joindre le serveur. Verifiez que l'API Laravel est demarree sur le port 8000.";
    }

    if (error?.name === 'TimeoutError') {
      return 'Le serveur met trop de temps a repondre. Verifiez votre connexion puis reessayez.';
    }

    const errors = error?.error?.errors;
    if (errors && typeof errors === 'object') {
      const messages = Object.values(errors).flat().filter((message) => typeof message === 'string');
      if (messages.length) {
        return messages.join(' ');
      }
    }

    if (error?.status === 401 || error?.status === 404) {
      return 'Aucun compte restaurant ne correspond a ces identifiants.';
    }

    return error?.error?.message || 'Connexion impossible. Verifiez vos identifiants puis reessayez.';
  }

  private isValidEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  private hideMessageAfterDelay(delay = 12000): void {
    this.clearMessageTimer();
    this.messageTimer = setTimeout(() => {
      this.message = '';
      this.messageTimer = undefined;
    }, delay);
  }

  private clearMessageTimer(): void {
    if (this.messageTimer) {
      clearTimeout(this.messageTimer);
      this.messageTimer = undefined;
    }
  }
}
