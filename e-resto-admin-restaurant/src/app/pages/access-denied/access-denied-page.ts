import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth/auth-service';

@Component({
  selector: 'app-access-denied-page',
  standalone: true,
  template: `
    <main class="access-denied-page">
      <section>
        <img src="assets/logo/e-resto-logo.png" alt="Restaurant Scan">
        <span>ACCÈS RESTREINT</span>
        <h1>Aucune permission disponible</h1>
        <p>Votre compte existe, mais aucun accès ne lui a encore été attribué. Contactez le responsable du restaurant pour qu'il configure votre rôle et vos permissions.</p>
        <button type="button" (click)="logout()">Retour à la connexion</button>
      </section>
    </main>
  `,
  styles: [`
    .access-denied-page { min-height: 100vh; display: grid; place-items: center; padding: 24px; color: #111827; background: #f8fafc; }
    section { width: min(100%, 560px); padding: 42px; border: 1px solid #e5e7eb; border-radius: 18px; text-align: center; background: #fff; box-shadow: 0 24px 70px rgba(15, 23, 42, .12); }
    img { width: 92px; height: 72px; margin-bottom: 20px; object-fit: contain; }
    span { display: block; color: #ff7a1a; font-size: 12px; font-weight: 900; letter-spacing: .14em; }
    h1 { margin: 10px 0 14px; font-size: clamp(28px, 5vw, 40px); font-weight: 950; }
    p { margin: 0 auto 24px; color: #64748b; line-height: 1.7; }
    button { min-height: 48px; border: 0; border-radius: 10px; padding: 0 20px; color: #fff; background: linear-gradient(135deg, #ff7a1a, #d71920); font-weight: 900; }
  `],
})
export class AccessDeniedPageComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  logout(): void {
    this.auth.clearLocalSession();
    this.router.navigate(['/restaurant/login'], { replaceUrl: true });
  }
}
