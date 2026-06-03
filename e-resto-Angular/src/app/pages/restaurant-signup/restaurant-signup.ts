import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { SaasService } from '../../services/saas/saas-service';

@Component({
  selector: 'app-restaurant-signup',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './restaurant-signup.html',
  styleUrl: './restaurant-signup.scss',
})
export class RestaurantSignup {
  currentStep: 1 | 2 = 1;
  showPassword = false;
  showPasswordConfirmation = false;

  account = {
    restaurant_name: '',
    owner_name: '',
    owner_email: '',
    owner_phone: '',
    city: '',
    currency: 'CDF',
    password: '',
    password_confirmation: '',
  };
  message = '';
  creating = false;
  accountCreated = false;
  createdRestaurant: any = null;
  publicMenuUrl = '';
  selectedPlan = JSON.parse(localStorage.getItem('selected_plan') || '{}');

  constructor(private router: Router, private route: ActivatedRoute, private saas: SaasService) {}

  goNext(): void {
    this.message = '';

    if (!this.account.owner_email || !this.account.password || !this.account.password_confirmation) {
      this.message = 'Completez votre email et votre mot de passe.';
      return;
    }

    if (this.account.password.length < 6) {
      this.message = 'Le mot de passe doit contenir au minimum 6 caracteres.';
      return;
    }

    if (this.account.password !== this.account.password_confirmation) {
      this.message = 'Les mots de passe ne correspondent pas.';
      return;
    }

    this.currentStep = 2;
  }

  goBack(): void {
    this.message = '';
    this.currentStep = 1;
  }

  passwordStrengthScore(): number {
    const password = this.account.password || '';
    let score = 0;

    if (password.length >= 6) score++;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    if (password.length >= 12 && score < 4) score++;

    return Math.min(score, 4);
  }

  passwordStrengthLabel(): string {
    const labels = ['Trop court', 'Faible', 'Moyen', 'Fort', 'Tres fort'];
    return labels[this.passwordStrengthScore()];
  }

  passwordStrengthClass(): string {
    const score = this.passwordStrengthScore();
    if (score <= 1) return 'weak';
    if (score <= 3) return 'medium';
    return 'strong';
  }

  createAccount(): void {
    if (!this.account.restaurant_name || !this.account.owner_name || !this.account.owner_email || !this.account.password) {
      this.message = 'Completez les champs obligatoires pour creer le compte.';
      return;
    }

    if (this.account.password !== this.account.password_confirmation) {
      this.message = 'Les mots de passe ne correspondent pas.';
      return;
    }

    const planId = this.route.snapshot.queryParamMap.get('plan') || this.selectedPlan.id;
    if (!planId) {
      this.message = 'Choisissez un plan avant de creer le compte restaurant.';
      return;
    }

    this.creating = true;
    this.saas.signup({
      ...this.account,
      saas_plan_id: planId,
    }).subscribe({
      next: (response) => {
        if (response.session?.token) {
          localStorage.setItem('restaurant_token', response.session.token);
          localStorage.setItem('auth_token', response.session.token);
          localStorage.setItem('user_data', JSON.stringify(response.session.user));
          localStorage.setItem('restaurant_session', JSON.stringify(response.session.restaurant));
        }
        localStorage.setItem('pending_restaurant', JSON.stringify(response.restaurant));
        localStorage.setItem('restaurant_owner_email', this.account.owner_email);
        this.createdRestaurant = response.restaurant;
        this.publicMenuUrl = this.buildMenuUrl(response.restaurant);
        this.accountCreated = true;
        this.creating = false;
      },
      error: (error) => {
        this.message = error?.error?.message || 'Creation impossible. Verifiez les informations.';
        this.creating = false;
      },
    });
  }

  goToDashboard(): void {
    this.router.navigate(['/restaurant/dashboard']);
  }

  copyMenuUrl(): void {
    if (!this.publicMenuUrl) {
      return;
    }

    navigator.clipboard?.writeText(this.publicMenuUrl);
    this.message = 'URL du menu copiee.';
  }

  private buildMenuUrl(restaurant: any): string {
    const base = window.location.origin.replace(':4200', ':5173');
    return `${base}/?restaurant_slug=${restaurant?.slug || 'mon-restaurant'}`;
  }
}
