import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { catchError, EMPTY, finalize, timeout } from 'rxjs';
import { SaasService } from '../../services/saas/saas-service';
import { API_ROOT } from '../../services/api-url';

@Component({
  selector: 'app-restaurant-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './restaurant-login.html',
  styleUrl: './restaurant-login.scss',
})
export class RestaurantLogin implements OnInit, OnDestroy {
  email = '';
  password = '';
  showPassword = false;
  message = '';
  loading = false;
  private messageTimer?: ReturnType<typeof setTimeout>;

  constructor(
    private router: Router,
    private saas: SaasService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.loading = false;
    this.cleanupBlockingOverlays();
  }

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
    const password = this.password.trim();

    if (!email || !password) {
      this.message = 'Renseignez votre email et votre mot de passe.';
      this.hideMessageAfterDelay();
      return;
    }

    if (!this.isValidEmail(email)) {
      this.message = 'Adresse e-mail invalide. Vérifiez le format, puis réessayez.';
      this.hideMessageAfterDelay();
      return;
    }

    this.setLoading(true);
    this.saas.login({ email, password }).pipe(
      timeout(15000),
      catchError((error) => {
        this.handleLoginError(error, false);
        return EMPTY;
      }),
      finalize(() => this.setLoading(false)),
    ).subscribe({
      next: (response) => this.completeLogin(response),
    });
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  private completeLogin(response: any): void {
    localStorage.setItem('restaurant_token', response.token);
    localStorage.setItem('auth_token', response.token);
    if (response.token_expires_at) {
      localStorage.setItem('auth_token_expires_at', response.token_expires_at);
    }
    localStorage.setItem('user_data', JSON.stringify(response.user));
    localStorage.setItem('restaurant_session', JSON.stringify(response.restaurant));
    localStorage.setItem('restaurant_login_at', new Date().toISOString());
    this.cleanupBlockingOverlays();
    this.router.navigate(['/dashboard'], { replaceUrl: true });
  }

  private cleanupBlockingOverlays(): void {
    document.body.classList.remove('modal-open', 'swal2-shown', 'swal2-height-auto');
    document.body.style.removeProperty('overflow');
    document.body.style.removeProperty('padding-right');
    document.body.style.removeProperty('pointer-events');
    document.querySelectorAll('.modal-backdrop, .offcanvas-backdrop, .swal2-container').forEach((element) => element.remove());
  }

  private handleLoginError(error: any, google: boolean): void {
    this.setLoading(false);
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

    this.cdr.detectChanges();
  }

  private validationMessage(error: any): string {
    if (error?.status === 0) {
      return `Impossible de joindre le serveur (${API_ROOT}). Verifiez que l'API Laravel est demarree sur le port 8000.`;
    }

    if (error?.name === 'TimeoutError') {
      return 'Le serveur met trop de temps a repondre. Verifiez que Docker, Laravel et MySQL sont bien demarres puis reessayez.';
    }

    const errors = error?.error?.errors;
    if (errors && typeof errors === 'object') {
      const messages = Object.values(errors).flat().filter((message) => typeof message === 'string');
      if (messages.length) {
        return messages.join(' ');
      }
    }

    if (error?.status === 401 || error?.status === 404) {
      return 'Identifiants incorrects. Verifiez votre email et votre mot de passe.';
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
      this.cdr.detectChanges();
    }, delay);
  }

  private clearMessageTimer(): void {
    if (this.messageTimer) {
      clearTimeout(this.messageTimer);
      this.messageTimer = undefined;
    }
  }

  private setLoading(value: boolean): void {
    this.loading = value;
    this.cdr.detectChanges();
  }
}
