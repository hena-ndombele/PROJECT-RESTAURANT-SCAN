import { CommonModule } from '@angular/common';
import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
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
export class SaasLanding implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('ctaSection') ctaSection?: ElementRef<HTMLElement>;

  overview?: SaasOverview;
  isLoading = true;
  isSubmitting = false;
  isNewsletterSubmitting = false;
  message = '';
  newsletterEmail = '';
  newsletterMessage = '';
  newsletterStatus: 'idle' | 'success' | 'error' = 'idle';
  billingCycle: 'monthly' | 'yearly' = 'yearly';
  statsLoaded = true;
  ctaStats = [
    { label: 'Restaurants inscrits', value: 20 },
    { label: 'Commandes traitees', value: 800 },
    { label: 'QR codes generes', value: 60 },
  ];
  animatedStats = [0, 0, 0];
  private ctaObserver?: IntersectionObserver;
  private revealObserver?: IntersectionObserver;
  private ctaAnimationStarted = false;
  private ctaStatsTimer?: ReturnType<typeof setInterval>;

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

  constructor(private saas: SaasService, private router: Router, private cdr: ChangeDetectorRef) {}

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

  ngAfterViewInit(): void {
    if (this.ctaSection?.nativeElement) {
      this.ctaObserver = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting && !this.ctaAnimationStarted) {
            this.startCtaStatsAnimation();
            this.ctaObserver?.disconnect();
          }
        },
        { threshold: 0.35 }
      );
      this.ctaObserver.observe(this.ctaSection.nativeElement);

      setTimeout(() => {
        const box = this.ctaSection?.nativeElement.getBoundingClientRect();
        if (box && box.top < window.innerHeight && box.bottom > 0) {
          this.startCtaStatsAnimation();
        }
      }, 300);
    }

    this.revealObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            this.revealObserver?.unobserve(entry.target);
          }
        }
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.12 }
    );
    document.querySelectorAll('.landing-reveal').forEach((element) => this.revealObserver?.observe(element));
  }

  ngOnDestroy(): void {
    this.ctaObserver?.disconnect();
    this.revealObserver?.disconnect();
    if (this.ctaStatsTimer) {
      clearInterval(this.ctaStatsTimer);
    }
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

  submitNewsletter(): void {
    const email = this.newsletterEmail.trim();
    if (!email) {
      this.newsletterMessage = 'Ajoutez votre email pour recevoir les nouveautes.';
      this.newsletterStatus = 'error';
      return;
    }

    this.isNewsletterSubmitting = true;
    this.newsletterMessage = '';
    this.newsletterStatus = 'idle';

    this.saas.subscribeNewsletter(email).subscribe({
      next: (response) => {
        this.newsletterMessage = response.message || 'Inscription confirmee.';
        this.newsletterStatus = 'success';
        this.newsletterEmail = '';
        this.isNewsletterSubmitting = false;
      },
      error: (error) => {
        this.newsletterMessage = error?.error?.message ?? "Impossible d'inscrire cet email pour le moment.";
        this.newsletterStatus = 'error';
        this.isNewsletterSubmitting = false;
      },
    });
  }

  displayPrice(plan: SaasPlan): number {
    const price = Number(plan.monthly_price ?? 0);
    return this.billingCycle === 'yearly' ? Math.round(price * 0.75) : price;
  }

  private startCtaStatsAnimation(): void {
    if (this.ctaAnimationStarted) {
      return;
    }

    this.ctaAnimationStarted = true;
    this.animateCtaStats();
  }

  private animateCtaStats(): void {
    if (this.ctaStatsTimer) {
      clearInterval(this.ctaStatsTimer);
    }

    const duration = 850;
    const start = Date.now();
    const targets = this.ctaStats.map((stat) => stat.value);

    this.ctaStatsTimer = setInterval(() => {
      const progress = Math.min((Date.now() - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      this.animatedStats = targets.map((target) => Math.round(target * eased));
      this.cdr.detectChanges();

      if (progress >= 1 && this.ctaStatsTimer) {
        clearInterval(this.ctaStatsTimer);
        this.ctaStatsTimer = undefined;
      }
    }, 16);
  }
}
