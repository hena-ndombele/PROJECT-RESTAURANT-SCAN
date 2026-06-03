import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { GoogleIdentityService } from '../../services/google/google-identity-service';
import { SaasService } from '../../services/saas/saas-service';

@Component({
  selector: 'app-restaurant-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './restaurant-login.html',
  styleUrl: './restaurant-login.scss',
})
export class RestaurantLogin implements AfterViewInit {
  @ViewChild('googleButton') googleButton?: ElementRef<HTMLElement>;

  email = '';
  password = '';
  message = '';
  loading = false;
  googleLoading = false;
  googleEnabled = true;

  constructor(
    private router: Router,
    private saas: SaasService,
    private googleIdentity: GoogleIdentityService,
  ) {}

  ngAfterViewInit(): void {
    if (!this.googleButton) {
      return;
    }

    this.googleIdentity.renderButton(this.googleButton.nativeElement, (credential) => this.loginWithGoogle(credential))
      .then((enabled) => this.googleEnabled = enabled)
      .catch(() => this.googleEnabled = false);
  }

  login(): void {
    this.message = '';
    this.loading = true;
    this.saas.login({ email: this.email, password: this.password }).subscribe({
      next: (response) => this.completeLogin(response),
      error: (error) => this.handleLoginError(error, false),
    });
  }

  private loginWithGoogle(credential: string): void {
    this.message = '';
    this.googleLoading = true;
    this.saas.googleLogin(credential).subscribe({
      next: (response) => this.completeLogin(response),
      error: (error) => this.handleLoginError(error, true),
    });
  }

  private completeLogin(response: any): void {
    localStorage.setItem('restaurant_token', response.token);
    localStorage.setItem('auth_token', response.token);
    localStorage.setItem('user_data', JSON.stringify(response.user));
    localStorage.setItem('restaurant_session', JSON.stringify(response.restaurant));
    this.router.navigate(['/restaurant/dashboard']);
  }

  private handleLoginError(error: any, google: boolean): void {
    this.message = error?.error?.message || 'Compte introuvable ou abonnement non actif.';
    if (error?.status === 402 && error.error?.restaurant) {
      localStorage.setItem('pending_restaurant', JSON.stringify(error.error.restaurant));
      this.router.navigate(['/restaurant/checkout']);
      return;
    }

    this.loading = false;
    this.googleLoading = false;
    if (google && error?.status === 404) {
      this.message = 'Ce compte Google ne possede pas encore d espace restaurant. Creez votre compte pour continuer.';
    }
  }
}
