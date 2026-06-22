import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { SaasPlan } from '../../models/saas/saas.models';
import { SaasService } from '../../services/saas/saas-service';

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
export class PricingPage implements OnInit {
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
      features: ['20 plats', '150 commandes/mois', 'Gestion des commandes', 'Cash uniquement', 'Sur place / Emporter', 'Support standard','Rôles limités'],
      installation_fee: 10,
      limitations: [ 'Pas de statistiques détaillées', 'Pas de réservations', 'Pas de feedback client', 'Pas de personnalisation'],
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
      max_tables: null,
      max_users: null,
      features: ['Tables illimitées', 'Commandes illimitées', 'Plats illimités', 'Réservations', 'Feedback client', 'Statistiques détaillées', 'Couleurs personnalisées', 'Support prioritaire'],
      installation_fee: 10,
      limitations: ['Pas de multi-restaurant', 'Assistant de tableau de bord avancé réservé à l’offre Business.'],
      is_popular: true,
    },
    {
      id: 'business',
      name: 'Business',
      slug: 'business',
      description: 'Pour les équipes structurées et les restaurants multi-sites.',
      monthly_price: 30,
      currency: 'USD',
      max_restaurants: 5,
      max_tables: null,
      max_users: null,
      max_dishes: null,
      features: ['Tout le plan Pro', 'Assistant intelligent dashboard', 'Statistiques avancées', 'Rôles et permissions', 'Support dedié', 'Onboarding personnalisé', 'Multi-restaurants'],
      installation_fee: 15,
      limitations: [],
      is_popular: false,
    },
  ];
  errorMessage = '';
  selectingPlanSlug = '';
  billingCycle: 'monthly' | 'yearly' = 'monthly';

  constructor(private router: Router, private saas: SaasService) {}

  ngOnInit(): void {
    this.saas.plans().subscribe({
      next: (plans) => {
        if (plans.length) {
          this.plans = plans
            .filter((plan) => ['starter', 'pro', 'business'].includes(String(plan.slug).toLowerCase()))
            .sort((left, right) => this.planOrder(left) - this.planOrder(right))
            .map((plan) => this.decoratePlan(plan));
          this.errorMessage = '';
        }
      },
      error: () => {
        this.errorMessage = 'Plans locaux affiches. Demarrez Laravel sur le port 8000 pour synchroniser les tarifs.';
      },
    });
  }

  choosePlan(plan: PricingPlan): void {
    this.errorMessage = '';
    this.selectingPlanSlug = plan.slug;

    localStorage.setItem('selected_plan', JSON.stringify({
      id: plan.id,
      name: plan.name,
      slug: plan.slug,
      price: this.paymentAmount(plan),
      monthly_price: Number(plan.monthly_price),
      annual_monthly_price: this.annualMonthlyPrice(plan),
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
    return this.billingCycle === 'yearly' ? this.annualMonthlyPrice(plan) : monthlyPrice;
  }

  paymentAmount(plan: SaasPlan): number {
    const monthlyPrice = Number(plan.monthly_price ?? 0);
    return this.billingCycle === 'yearly' ? this.annualMonthlyPrice(plan) * 12 : monthlyPrice;
  }

  displayCurrency(plan: SaasPlan): string {
    return plan.currency === 'CDF' ? 'CDF' : plan.currency === 'USD' ? '$' : plan.currency || 'CDF';
  }

  limitLabel(value: number | null, singular: string, unlimited: string): string {
    return value === null ? unlimited : `${value} ${singular}`;
  }

  dishLimitLabel(plan: SaasPlan): string {
    const value = plan.max_dishes ?? (plan.slug === 'starter' ? 20 : null);
    return this.limitLabel(value, 'plats', 'Plats illimités');
  }

  visibleFeatures(plan: SaasPlan): string[] {
    return (plan.features || []).filter((feature) => {
      const normalized = this.normalizeLabel(feature);

      return !normalized.includes('tables illimitées')
        && !normalized.includes('utilisateurs illimitées')
        && !normalized.includes('plats illimités')
        && !normalized.includes('20 plats');
    });
  }

  planDetails(plan: SaasPlan): string[] {
    return [
      this.limitLabel(plan.max_tables, 'tables QR', 'Tables QR illimitées'),
      this.limitLabel(plan.max_users, 'utilisateurs et équipe', 'Utilisateurs illimités'),
      this.dishLimitLabel(plan),
      ...this.visibleFeatures(plan),
    ];
  }

  private decoratePlan(plan: SaasPlan): PricingPlan {
    const slug = String(plan.slug || plan.name).toLowerCase();

    return {
      ...plan,
      features: plan.features || [],
      installation_fee: slug.includes('business') ? 15 : 10,
      limitations: this.limitationsForPlan(slug),
    };
  }

  private limitationsForPlan(slug: string): string[] {
    if (slug.includes('starter')) {
      return ['Pas de statistiques detaillees', 'Pas de reservations', 'Pas de feedback client', 'Pas de personnalisation'];
    }

    if (slug.includes('pro')) {
      return ['Pas de multi-restaurant', 'Assistant de tableau de bord avance reserve a l offre Business.'];
    }

    return [];
  }

  private normalizeLabel(value: string): string {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  private planOrder(plan: SaasPlan): number {
    const slug = String(plan.slug).toLowerCase();
    return slug === 'starter' ? 1 : slug === 'pro' ? 2 : slug === 'business' ? 3 : 99;
  }

  private annualMonthlyPrice(plan: SaasPlan): number {
    const slug = String(plan.slug || plan.name).toLowerCase();

    if (slug.includes('starter')) return 12;
    if (slug.includes('pro')) return 20;
    if (slug.includes('business')) return 25;

    return Number(plan.monthly_price ?? 0);
  }
}
