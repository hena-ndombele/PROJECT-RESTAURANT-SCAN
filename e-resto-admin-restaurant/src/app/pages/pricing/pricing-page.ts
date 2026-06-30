import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { SaasPlan } from '../../models/saas/saas.models';
import { SaasService } from '../../services/saas/saas-service';

type PricingPlan = SaasPlan & {
  installation_fee: number;
  installation_fee_label: string;
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
  plans: PricingPlan[] = this.defaultPlans().map((plan) => this.decoratePlan(plan));
  errorMessage = '';
  selectingPlanSlug = '';
  billingCycle: 'monthly' | 'yearly' = 'monthly';
  loadingPlans = false;

  constructor(private router: Router, private saas: SaasService) {}

  ngOnInit(): void {
    localStorage.removeItem('selected_plan');
    this.setBillingCycle('monthly');
    this.loadingPlans = true;
    this.saas.plans().subscribe({
      next: (plans) => {
        const syncedPlans = plans
          .filter((plan) => plan.is_active !== false)
          .sort((left, right) => this.planOrder(left) - this.planOrder(right))
          .map((plan) => this.decoratePlan(plan));

        if (syncedPlans.length) {
          this.plans = syncedPlans;
        }
        this.errorMessage = '';
        this.loadingPlans = false;
      },
      error: () => {
        this.loadingPlans = false;
        this.errorMessage = '';
      },
    });
  }

  setBillingCycle(cycle: 'monthly' | 'yearly'): void {
    this.billingCycle = cycle;
  }

  trackPlan(_: number, plan: PricingPlan): string {
    return plan.id || plan.slug;
  }

  choosePlan(plan: PricingPlan): void {
    this.errorMessage = '';
    this.selectingPlanSlug = plan.slug;

    localStorage.setItem('selected_plan', JSON.stringify({
      id: plan.id,
      name: plan.name,
      slug: plan.slug,
      price: this.paymentAmount(plan),
      monthly_price: this.monthlyPriceForPlan(plan),
      yearly_price: this.yearlyPrice(plan),
      annual_monthly_price: this.annualMonthlyPrice(plan),
      currency: plan.currency,
      installation_fee: plan.installation_fee,
      installation_fee_label: plan.installation_fee_label,
      cycle: this.billingCycle,
    }));

    this.router.navigate(['/restaurant/signup'], {
      queryParams: { plan: plan.slug, cycle: this.billingCycle },
    });
  }

  displayPrice(plan: SaasPlan): number {
    return this.billingCycle === 'yearly' ? this.effectiveAmount(plan, 'yearly') / 12 : this.effectiveAmount(plan, 'monthly');
  }

  paymentAmount(plan: SaasPlan): number {
    return this.effectiveAmount(plan, this.billingCycle);
  }

  originalPaymentAmount(plan: SaasPlan): number {
    return this.billingCycle === 'yearly' ? this.yearlyPrice(plan) : this.monthlyPriceForPlan(plan);
  }

  hasActivePromo(plan: SaasPlan): boolean {
    return !!plan.has_active_promo && Number(plan.promo_percent || 0) > 0;
  }

  displayCurrency(plan: SaasPlan): string {
    return plan.currency === 'CDF' ? 'CDF' : plan.currency === 'USD' ? '$' : plan.currency || 'CDF';
  }

  installationFeeDisplay(plan: PricingPlan): string {
    return plan.installation_fee_label || `${plan.installation_fee.toLocaleString('fr-FR')} ${this.displayCurrency(plan)}`;
  }

  limitLabel(value: number | null, singular: string, unlimited: string): string {
    return value === null ? unlimited : `${value} ${singular}`;
  }

  dishLimitLabel(plan: SaasPlan): string {
    const value = plan.max_dishes ?? null;
    return this.limitLabel(value, 'plats', 'Plats illimités');
  }

  orderLimitLabel(plan: SaasPlan): string {
    return this.limitLabel(plan.max_orders_per_month ?? null, 'commandes/mois', 'Commandes illimitées');
  }

  visibleFeatures(plan: SaasPlan): string[] {
    return (plan.features || []).filter((feature) => {
      const normalized = this.normalizeLabel(feature);

      return !normalized.includes('tables illimitees')
        && !normalized.includes('utilisateurs illimites')
        && !normalized.includes('utilisateurs illimitees')
        && !normalized.includes('employes illimites')
        && !normalized.includes('employes illimitees')
        && !normalized.includes('5 employes')
        && !normalized.includes('plats illimites')
        && !normalized.includes('commandes illimitees')
        && !normalized.includes('installation')
        && !/^\s*\d+\s+plats\s*$/i.test(normalized)
        && !/^\s*\d+\s+commandes/i.test(normalized);
    });
  }

  planDetails(plan: SaasPlan): string[] {
    return [
      this.limitLabel(plan.max_tables, 'tables QR', 'Tables QR illimitées'),
      this.limitLabel(plan.max_users, 'employés', 'Employés illimités'),
      this.dishLimitLabel(plan),
      this.orderLimitLabel(plan),
      ...this.visibleFeatures(plan),
    ];
  }

  private decoratePlan(plan: SaasPlan): PricingPlan {
    const slug = String(plan.slug || plan.name).toLowerCase();
    const rawFeatures = plan.features || [];
    const features = this.cleanFeatureList(rawFeatures);

    if (slug.includes('starter')) {
      const withoutOldDishLimit = features.filter((feature) => !/^\s*\d+\s+plats\s*$/i.test(this.normalizeLabel(feature)));
      features.splice(0, features.length, '15 plats', ...withoutOldDishLimit);
      if (!features.some((feature) => this.normalizeLabel(feature).includes('templates qr standard'))) {
        features.splice(5, 0, 'Templates QR Standard');
      }
    }

    if (slug.includes('starter') && !features.some((feature) => this.normalizeLabel(feature).includes('dashboard'))) {
      features.splice(2, 0, 'Dashboard et statistiques');
    }
    if ((slug.includes('pro') || slug.includes('business')) && !features.some((feature) => this.normalizeLabel(feature).includes('templates qr premium'))) {
      features.splice(slug.includes('business') ? 1 : Math.max(features.length - 1, 0), 0, 'Templates QR premium');
    }

    return {
      ...plan,
      monthly_price: this.monthlyPriceForPlan(plan),
      features,
      installation_fee: this.installationFeeFromFeatures(rawFeatures),
      installation_fee_label: this.installationFeeLabelFromFeatures(rawFeatures),
      limitations: this.limitationsForPlan(slug),
    };
  }

  private installationFeeFromFeatures(features: string[]): number {
    const installation = features.find((feature) => this.normalizeLabel(feature).includes('installation'));
    const amount = installation?.match(/\d[\d\s.]*/)?.[0]?.replace(/\s/g, '');

    return amount ? Number(amount) : 0;
  }

  private installationFeeLabelFromFeatures(features: string[]): string {
    const installation = features.find((feature) => this.normalizeLabel(feature).includes('installation'));
    const label = installation?.split(':').slice(1).join(':').trim();

    return label || '';
  }

  private limitationsForPlan(slug: string): string[] {
    if (slug.includes('starter')) {
      return ['Pas de réservations', 'Pas de feedback client', 'Pas de personnalisation'];
    }

    if (slug.includes('pro')) {
      return ['Pas de multi-restaurant', 'Assistant de tableau de bord avancé réservé à l’offre Business.'];
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
    return this.yearlyPrice(plan) / 12;
  }

  private yearlyPrice(plan: SaasPlan): number {
    const yearly = Number(plan.yearly_price ?? 0);
    return yearly > 0 ? yearly : this.monthlyPriceForPlan(plan) * 12;
  }

  private monthlyPriceForPlan(plan: SaasPlan): number {
    return Number(plan.monthly_price ?? 0);
  }

  private effectiveAmount(plan: SaasPlan, cycle: 'monthly' | 'yearly'): number {
    if (!this.hasActivePromo(plan)) {
      return cycle === 'yearly' ? this.yearlyPrice(plan) : this.monthlyPriceForPlan(plan);
    }

    const promoPrice = cycle === 'yearly' ? plan.promo_yearly_price : plan.promo_monthly_price;
    return promoPrice !== null && promoPrice !== undefined
      ? Number(promoPrice)
      : this.discountedAmount(cycle === 'yearly' ? this.yearlyPrice(plan) : this.monthlyPriceForPlan(plan), plan);
  }

  private discountedAmount(amount: number, plan: SaasPlan): number {
    return Math.round(amount * (1 - Number(plan.promo_percent || 0) / 100) * 100) / 100;
  }

  private cleanFeatureList(features: string[]): string[] {
    const seen = new Set<string>();

    return features.filter((feature) => {
      const normalized = this.normalizeLabel(feature);
      if (!normalized || normalized.includes('installation')) return false;
      if (/^\s*\d+\s+plats\s*$/i.test(normalized)) return false;
      if (seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    });
  }

  private defaultPlans(): SaasPlan[] {
    return [
      {
        id: 'starter',
        name: 'Starter',
        slug: 'starter',
        description: 'Pour lancer un service digital simple, rapide et professionnel.',
        monthly_price: 15,
        yearly_price: 144,
        currency: 'USD',
        max_restaurants: 1,
        max_tables: 6,
        max_users: 5,
        max_dishes: 15,
        max_orders_per_month: 150,
        features: ['Gestion des commandes', 'Templates QR Standard', 'Cash uniquement', 'Sur place / Emporter', 'Support standard', 'Installation : 20 000 FC'],
        is_popular: false,
        is_active: true,
      },
      {
        id: 'pro',
        name: 'Pro',
        slug: 'pro',
        description: 'Pour automatiser le service et piloter un restaurant en croissance.',
        monthly_price: 35,
        yearly_price: 360,
        currency: 'USD',
        max_restaurants: 1,
        max_tables: null,
        max_users: null,
        max_dishes: null,
        max_orders_per_month: null,
        features: ['Commandes illimitées', 'Plats illimités', 'Réservations', 'Feedback client', 'Statistiques détaillées', 'Couleurs personnalisées', 'Support prioritaire', 'Installation : 20 000 FC'],
        is_popular: true,
        is_active: true,
      },
      {
        id: 'business',
        name: 'Business',
        slug: 'business',
        description: 'Pour les équipes structurées et les restaurants multi-sites.',
        monthly_price: 50,
        yearly_price: 480,
        currency: 'USD',
        max_restaurants: 5,
        max_tables: null,
        max_users: null,
        max_dishes: null,
        max_orders_per_month: null,
        features: ['Tout le plan Pro', 'Assistant intelligent dashboard', 'Statistiques avancées', 'Rôles et permissions', 'Support dédié', 'Onboarding personnalisé', 'Installation : 30 000 FC', 'Multi-restaurants'],
        is_popular: false,
        is_active: true,
      },
    ];
  }
}
