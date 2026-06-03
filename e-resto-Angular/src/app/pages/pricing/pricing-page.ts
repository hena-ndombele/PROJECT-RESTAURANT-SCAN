import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { SaasOverview, SaasPlan } from '../../models/saas/saas.models';
import { SaasService } from '../../services/saas/saas-service';

@Component({
  selector: 'app-pricing-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './pricing-page.html',
  styleUrl: './pricing-page.scss',
})
export class PricingPage implements OnInit {
  overview?: SaasOverview;
  plans: SaasPlan[] = [
    {
      id: 'starter-preview',
      name: 'Starter',
      slug: 'starter',
      description: 'Ideal pour les petits restaurants qui demarrent',
      monthly_price: 9_900,
      currency: 'FCFA',
      max_restaurants: 1,
      max_tables: 10,
      max_users: 2,
      features: ['Menu digital QR code', "Jusqu'a 30 plats", '200 commandes/mois', 'Gestion des commandes', 'Sur place / Emporter'],
      is_popular: false,
    },
    {
      id: 'pro-preview',
      name: 'Pro',
      slug: 'pro',
      description: 'Le plan complet pour les restaurants etablis',
      monthly_price: 14_900,
      currency: 'FCFA',
      max_restaurants: 1,
      max_tables: 40,
      max_users: 6,
      features: ['Tout le plan Starter', 'Plats illimites', 'Commandes illimitees', 'Statistiques detaillees', 'Couleurs personnalisees', 'Feedback clients'],
      is_popular: true,
    },
    {
      id: 'business-preview',
      name: 'Business',
      slug: 'business',
      description: 'Pour les restaurants qui veulent une equipe performante',
      monthly_price: 19_900,
      currency: 'FCFA',
      max_restaurants: 1,
      max_tables: 100,
      max_users: 12,
      features: ['Tout le plan Pro', 'Analytiques avancees', 'Multi-utilisateurs et roles', 'Rapports PDF et Excel', 'Support dedie'],
      is_popular: false,
    },
  ];
  loadingPlans = false;
  errorMessage = '';
  billingCycle: 'monthly' | 'yearly' = 'yearly';

  constructor(private saas: SaasService, private router: Router) {}

  ngOnInit(): void {
    this.loadPlans();
    this.saas.overview().subscribe({
      next: (overview) => {
        this.overview = overview;
        if (!this.plans.length) {
          this.plans = overview.plans ?? [];
        }
      },
      error: () => undefined,
    });
  }

  loadPlans(): void {
    this.loadingPlans = false;
    this.errorMessage = '';

    this.saas.plans().subscribe({
      next: (plans) => {
        if (plans.length) {
          this.plans = plans;
        }
        this.loadingPlans = false;
      },
      error: () => {
        this.errorMessage = "Les plans exacts seront synchronises des que l'API sera disponible.";
        this.loadingPlans = false;
      },
    });
  }

  choosePlan(plan: SaasPlan): void {
    if (plan.id.endsWith('-preview')) {
      this.errorMessage = "Demarrez l'API backend pour selectionner ce plan.";
      return;
    }

    localStorage.setItem('selected_plan', JSON.stringify({ id: plan.id, name: plan.name, price: this.displayPrice(plan), cycle: this.billingCycle }));
    const hasAccount = !!localStorage.getItem('restaurant_account');
    this.router.navigate([hasAccount ? '/restaurant/checkout' : '/restaurant/signup'], { queryParams: { plan: plan.id, cycle: this.billingCycle } });
  }

  displayPrice(plan: SaasPlan): number {
    const price = Number(plan.monthly_price ?? 0);
    return this.billingCycle === 'yearly' ? Math.round(price * 0.75) : price;
  }

  displayCurrency(plan: SaasPlan): string {
    return plan.currency === 'CDF' ? 'CDF' : plan.currency === 'USD' ? '$' : plan.currency || 'FCFA';
  }
}
