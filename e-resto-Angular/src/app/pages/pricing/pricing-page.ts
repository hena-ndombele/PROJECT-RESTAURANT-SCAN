import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { SaasPlan } from '../../models/saas/saas.models';

type PricingPlan = SaasPlan & {
  installation_fee: number;
  limitations: string[];
};

@Component({
  selector: 'app-pricing-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './pricing-page.html',
  styleUrl: './pricing-page.scss',
})
export class PricingPage {
  plans: PricingPlan[] = [
    {
      id: 'starter',
      name: 'Starter',
      slug: 'starter',
      description: 'Pour lancer un service digital simple, rapide et professionnel.',
      monthly_price: 15,
      currency: 'USD',
      max_restaurants: 1,
      max_tables: 8,
      max_users: 5,
      features: ['20 plats', '150 commandes/mois', 'Gestion des commandes', 'Sur place / Emporter', 'Support standard'],
      installation_fee: 20_000,
      limitations: ['Pas de statistiques', 'Pas de personnalisation', 'Pas de multi-restaurant'],
      is_popular: false,
    },
    {
      id: 'pro',
      name: 'Pro',
      slug: 'pro',
      description: 'Pour automatiser le service et piloter un restaurant en croissance.',
      monthly_price: 25,
      currency: 'USD',
      max_restaurants: 1,
      max_tables: 20,
      max_users: 15,
      features: ['Commandes illimitees', 'Plats illimites', 'Statistiques detaillees', 'Couleurs personnalisees', 'Support prioritaire'],
      installation_fee: 20_000,
      limitations: ['Pas de multi-etablissement'],
      is_popular: true,
    },
    {
      id: 'business',
      name: 'Business',
      slug: 'business',
      description: 'Pour les equipes structurees et les restaurants multi-sites.',
      monthly_price: 30,
      currency: 'USD',
      max_restaurants: 5,
      max_tables: 20,
      max_users: 15,
      features: ['Tout le plan Pro', 'Statistiques avancees', 'Multi-utilisateurs et roles', 'Support dedie', 'Onboarding personnalise', 'Multi-restaurants'],
      installation_fee: 30_000,
      limitations: [],
      is_popular: false,
    },
  ];
  errorMessage = '';
  selectingPlanSlug = '';
  billingCycle: 'monthly' | 'yearly' = 'monthly';

  constructor(private router: Router) {}

  choosePlan(plan: PricingPlan): void {
    this.errorMessage = '';
    this.selectingPlanSlug = plan.slug;

    localStorage.setItem('selected_plan', JSON.stringify({
      id: plan.id,
      name: plan.name,
      slug: plan.slug,
      price: this.paymentAmount(plan),
      monthly_price: Number(plan.monthly_price),
      currency: plan.currency,
      installation_fee: plan.installation_fee,
      cycle: this.billingCycle,
    }));

    this.router.navigate(['/restaurant/signup'], {
      queryParams: { plan: plan.slug, cycle: this.billingCycle },
    });
  }

  displayPrice(plan: SaasPlan): number {
    const monthlyPrice = Number(plan.monthly_price ?? 0);
    return this.billingCycle === 'yearly' ? monthlyPrice * 10 / 12 : monthlyPrice;
  }

  paymentAmount(plan: SaasPlan): number {
    const monthlyPrice = Number(plan.monthly_price ?? 0);
    return this.billingCycle === 'yearly' ? monthlyPrice * 10 : monthlyPrice;
  }

  displayCurrency(plan: SaasPlan): string {
    return plan.currency === 'CDF' ? 'CDF' : plan.currency === 'USD' ? '$' : plan.currency || 'FCFA';
  }
}
