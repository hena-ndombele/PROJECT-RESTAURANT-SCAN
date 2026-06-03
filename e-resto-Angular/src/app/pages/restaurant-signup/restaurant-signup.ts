import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { SaasPlan } from '../../models/saas/saas.models';
import { GoogleIdentityService } from '../../services/google/google-identity-service';
import { SaasService } from '../../services/saas/saas-service';

@Component({
  selector: 'app-restaurant-signup',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './restaurant-signup.html',
  styleUrl: './restaurant-signup.scss',
})
export class RestaurantSignup implements OnInit, AfterViewInit {
  @ViewChild('googleButton') googleButton?: ElementRef<HTMLElement>;

  currentStep: 1 | 2 = 1;
  showPassword = false;
  showPasswordConfirmation = false;
  googleCredential = '';
  googleEnabled = true;
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
  accountCreated = false;
  createdRestaurant: any = null;
  publicMenuUrl = '';
  selectedPlan = JSON.parse(localStorage.getItem('selected_plan') || '{}');

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private saas: SaasService,
    private googleIdentity: GoogleIdentityService,
  ) {}

  ngOnInit(): void {
    this.saas.plans().subscribe({
      next: (plans) => {
        this.resolveSelectedPlan(plans);
        this.planLoading = false;
      },
      error: () => {
        this.planLoading = false;
        this.message = 'Impossible de charger les plans. Revenez depuis la page Tarifs.';
      },
    });
  }

  ngAfterViewInit(): void {
    this.renderGoogleButton();
  }

  goNext(): void {
    this.message = '';

    if (!this.account.owner_email || (!this.googleCredential && (!this.account.password || !this.account.password_confirmation))) {
      this.message = 'Completez votre email et votre mot de passe.';
      return;
    }

    if (!this.googleCredential && this.account.password.length < 6) {
      this.message = 'Le mot de passe doit contenir au minimum 6 caracteres.';
      return;
    }

    if (!this.googleCredential && this.account.password !== this.account.password_confirmation) {
      this.message = 'Les mots de passe ne correspondent pas.';
      return;
    }

    this.currentStep = 2;
  }

  goBack(): void {
    this.message = '';
    this.currentStep = 1;
    setTimeout(() => this.renderGoogleButton());
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

    if (!this.account.restaurant_name || !this.account.owner_name || !this.account.owner_email || !this.account.owner_phone || (!this.googleCredential && !this.account.password)) {
      this.message = 'Completez les champs obligatoires pour creer le compte.';
      return;
    }

    if (!this.googleCredential && this.account.password !== this.account.password_confirmation) {
      this.message = 'Les mots de passe ne correspondent pas.';
      return;
    }

    const planId = this.selectedPlan.id;
    if (!planId) {
      this.message = 'Choisissez un plan avant de creer le compte restaurant.';
      return;
    }

    this.creating = true;
    this.saas.signup({
      ...this.account,
      saas_plan_id: planId,
      google_credential: this.googleCredential || undefined,
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
        this.message = this.validationMessage(error);
        this.creating = false;
      },
    });
  }

  goToCheckout(): void {
    this.router.navigate(['/restaurant/checkout']);
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

  private renderGoogleButton(): void {
    if (!this.googleButton) {
      return;
    }

    this.googleIdentity.renderButton(this.googleButton.nativeElement, (credential) => this.continueWithGoogle(credential))
      .then((enabled) => this.googleEnabled = enabled)
      .catch(() => this.googleEnabled = false);
  }

  private continueWithGoogle(credential: string): void {
    const profile = this.decodeGoogleCredential(credential);
    if (!profile?.email) {
      this.message = 'Impossible de lire les informations du compte Google.';
      return;
    }

    this.googleCredential = credential;
    this.account.owner_email = profile.email;
    this.account.owner_name = profile.name || this.account.owner_name;
    this.message = '';
    this.currentStep = 2;
  }

  private decodeGoogleCredential(credential: string): { email?: string; name?: string } | null {
    try {
      const payload = credential.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const paddedPayload = payload.padEnd(Math.ceil(payload.length / 4) * 4, '=');
      const bytes = Uint8Array.from(atob(paddedPayload), (character) => character.charCodeAt(0));
      return JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      return null;
    }
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

  private validationMessage(error: any): string {
    const errors = error?.error?.errors;
    if (errors && typeof errors === 'object') {
      const messages = Object.values(errors).flat().filter((message) => typeof message === 'string');
      if (messages.length) {
        return messages.join(' ');
      }
    }

    return error?.error?.message || 'Creation impossible. Verifiez les informations.';
  }
}
