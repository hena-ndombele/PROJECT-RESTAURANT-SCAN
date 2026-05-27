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
  billingCycle: 'monthly' | 'yearly' = 'yearly';

  constructor(private saas: SaasService, private router: Router) {}

  ngOnInit(): void {
    this.saas.overview().subscribe((overview) => this.overview = overview);
  }

  choosePlan(plan: SaasPlan): void {
    localStorage.setItem('selected_plan', JSON.stringify({ id: plan.id, name: plan.name, price: this.displayPrice(plan), cycle: this.billingCycle }));
    const hasAccount = !!localStorage.getItem('restaurant_account');
    this.router.navigate([hasAccount ? '/restaurant/checkout' : '/restaurant/signup'], { queryParams: { plan: plan.id, cycle: this.billingCycle } });
  }

  displayPrice(plan: SaasPlan): number {
    const price = Number(plan.monthly_price ?? 0);
    return this.billingCycle === 'yearly' ? Math.round(price * 0.75) : price;
  }
}
