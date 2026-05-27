import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Restaurant, SaasOverview, SaasPlan } from '../../models/saas/saas.models';
import { SaasService } from '../../services/saas/saas-service';

@Component({
  selector: 'app-saas-landing',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './saas-landing.html',
  styleUrl: './saas-landing.scss',
})
export class SaasLanding implements OnInit {
  overview?: SaasOverview;
  isLoading = true;
  isSubmitting = false;
  message = '';
  billingCycle: 'monthly' | 'yearly' = 'yearly';

  lead: Partial<Restaurant> = {
    name: '',
    owner_name: '',
    owner_email: '',
    owner_phone: '',
    city: '',
  };

  card = {
    number: '',
    name: '',
    expiry: '',
    cvc: '',
  };

  constructor(private saas: SaasService, private router: Router) {}

  ngOnInit(): void {
    this.saas.overview().subscribe({
      next: (overview) => {
        this.overview = overview;
        this.lead.saas_plan_id = overview.plans.find((plan) => plan.is_popular)?.id ?? overview.plans[0]?.id;
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
        this.message = "Impossible de charger les donnees SaaS pour le moment.";
      },
    });
  }

  selectPlan(plan: SaasPlan): void {
    this.lead.saas_plan_id = plan.id;
    document.getElementById('signup')?.scrollIntoView({ behavior: 'smooth' });
  }

  submitLead(): void {
    if (!this.lead.name || !this.lead.owner_name || !this.lead.owner_email || !this.card.number || !this.card.name) {
      this.message = 'Restaurant, responsable, email et carte bancaire sont requis.';
      return;
    }

    this.isSubmitting = true;
    this.saas.registerInterest(this.lead).subscribe({
      next: () => {
        this.message = 'Abonnement initialise. Redirection vers votre espace restaurant...';
        this.lead = { name: '', owner_name: '', owner_email: '', owner_phone: '', city: '', saas_plan_id: this.lead.saas_plan_id };
        this.isSubmitting = false;
        setTimeout(() => this.router.navigate(['/restaurant/dashboard']), 700);
      },
      error: (error) => {
        this.message = error?.error?.message ?? "L'inscription a echoue.";
        this.isSubmitting = false;
      },
    });
  }

  displayPrice(plan: SaasPlan): number {
    const price = Number(plan.monthly_price ?? 0);
    return this.billingCycle === 'yearly' ? Math.round(price * 0.75) : price;
  }
}
