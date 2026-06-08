import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize, timeout } from 'rxjs';
import { SaasPlan } from '../../models/saas/saas.models';
import { SaasService } from '../../services/saas/saas-service';

@Component({
  selector: 'app-restaurant-signup',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './restaurant-signup.html',
  styleUrl: './restaurant-signup.scss',
})
export class RestaurantSignup implements OnInit {
  currentStep: 1 | 2 = 1;
  showPassword = false;
  showPasswordConfirmation = false;
  planLoading = true;

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
  private createAccountSafetyTimer?: ReturnType<typeof setTimeout>;
  accountCreated = false;
  createdRestaurant: any = null;
  publicMenuUrl = '';
  selectedPlan = JSON.parse(localStorage.getItem('selected_plan') || '{}');

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private saas: SaasService,
  ) {}

  ngOnInit(): void {
    this.saas.plans().pipe(timeout(30000)).subscribe({
      next: (plans) => {
        this.resolveSelectedPlan(plans);
        this.planLoading = false;
      },
      error: () => {
        this.planLoading = false;
        if (this.hasSelectedPlanFallback()) {
          this.message = '';
          return;
        }

        this.message = 'Impossible de charger les plans. Verifiez que le serveur et la base de donnees sont demarres.';
      },
    });
  }

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
    if (this.planLoading) {
      this.message = 'Chargement du plan en cours. Patientez un instant.';
      return;
    }

    if (!this.account.restaurant_name || !this.account.owner_name || !this.account.owner_email || !this.account.owner_phone || !this.account.password) {
      this.message = 'Completez les champs obligatoires pour creer le compte.';
      return;
    }

    if (this.account.password !== this.account.password_confirmation) {
      this.message = 'Les mots de passe ne correspondent pas.';
      return;
    }

    const planId = this.selectedPlan.id;
    if (!planId) {
      this.message = 'Choisissez un plan avant de creer le compte restaurant.';
      return;
    }

    this.creating = true;
    this.clearCreateAccountSafetyTimer();
    this.createAccountSafetyTimer = setTimeout(() => {
      if (!this.creating) {
        return;
      }

      this.creating = false;
      localStorage.setItem('restaurant_owner_email', this.account.owner_email);
      this.message = 'Le compte semble avoir ete cree. Redirection vers la verification OTP...';
      setTimeout(() => this.router.navigate(['/auth/otp'], {
        queryParams: {
          source: 'signup',
          email: this.account.owner_email,
        },
      }), 1200);
    }, 15000);
    this.saas.signup({
      ...this.account,
      saas_plan_id: planId,
    }).pipe(
      timeout(30000),
      finalize(() => {
        this.creating = false;
        this.clearCreateAccountSafetyTimer();
      }),
    ).subscribe({
      next: (response) => {
        this.creating = false;
        this.clearCreateAccountSafetyTimer();
        const restaurant = response.restaurant;
        if (restaurant) {
          localStorage.setItem('pending_signup_restaurant', JSON.stringify(restaurant));
        }

        localStorage.setItem('restaurant_owner_email', this.account.owner_email);
        this.message = response.message || 'Compte cree. Entrez le code OTP envoye par email.';
        this.router.navigate(['/auth/otp'], {
          queryParams: {
            source: 'signup',
            email: this.account.owner_email,
          },
        });
      },
      error: (error) => {
        this.message = this.validationMessage(error);
      },
    });
  }

  goToCheckout(): void {
    this.router.navigate(['/restaurant/checkout']);
  }

  goToDashboard(): void {
    this.router.navigate(['/dashboard']);
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
    const slug = restaurant?.slug || this.slugify(this.account.restaurant_name) || 'mon-restaurant';
    return `${base}/?restaurant_slug=${slug}`;
  }

  private slugify(value: string): string {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private resolveSelectedPlan(plans: SaasPlan[]): void {
    const requestedPlan = this.route.snapshot.queryParamMap.get('plan');
    const storedId = this.selectedPlan.id;
    const storedSlug = this.selectedPlan.slug;
    const storedName = String(this.selectedPlan.name || '').toLowerCase();

    const selected = plans.find((plan) => plan.id === requestedPlan || plan.slug === requestedPlan)
      ?? plans.find((plan) => plan.id === storedId || plan.slug === storedSlug || plan.name.toLowerCase() === storedName)
      ?? plans.find((plan) => plan.slug === 'starter')
      ?? plans[0];

    if (!selected) {
      this.message = 'Aucun plan actif n est disponible pour le moment.';
      return;
    }

    this.selectedPlan = {
      ...this.selectedPlan,
      id: selected.id,
      name: selected.name,
      slug: selected.slug,
      monthly_price: Number(selected.monthly_price),
      currency: selected.currency,
    };
    localStorage.setItem('selected_plan', JSON.stringify(this.selectedPlan));
  }

  private hasSelectedPlanFallback(): boolean {
    const planKey = this.selectedPlan.id || this.selectedPlan.slug || this.route.snapshot.queryParamMap.get('plan');

    if (!planKey) {
      return false;
    }

    this.selectedPlan = {
      ...this.selectedPlan,
      id: this.selectedPlan.id || planKey,
      slug: this.selectedPlan.slug || String(planKey).toLowerCase(),
      name: this.selectedPlan.name || this.planNameFromKey(String(planKey)),
    };
    localStorage.setItem('selected_plan', JSON.stringify(this.selectedPlan));

    return true;
  }

  private planNameFromKey(planKey: string): string {
    const normalized = planKey.toLowerCase();

    if (normalized === 'pro') return 'Pro';
    if (normalized === 'business') return 'Business';

    return 'Starter';
  }

  private validationMessage(error: any): string {
    if (error?.name === 'TimeoutError') {
      return 'La creation prend trop de temps. Si vous avez recu le code par email, ouvrez la page OTP pour verifier votre compte.';
    }

    const errors = error?.error?.errors;
    if (errors && typeof errors === 'object') {
      const messages = Object.values(errors).flat().filter((message) => typeof message === 'string');
      if (messages.length) {
        return messages.join(' ');
      }
    }

    return error?.error?.message || 'Creation impossible. Verifiez les informations.';
  }

  private clearCreateAccountSafetyTimer(): void {
    if (this.createAccountSafetyTimer) {
      clearTimeout(this.createAccountSafetyTimer);
      this.createAccountSafetyTimer = undefined;
    }
  }
}
