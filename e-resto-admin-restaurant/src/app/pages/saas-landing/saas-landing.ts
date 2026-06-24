import { CommonModule } from '@angular/common';
import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize, timeout } from 'rxjs';
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
  isContactSubmitting = false;
  message = '';
  newsletterEmail = '';
  newsletterMessage = '';
  newsletterStatus: 'idle' | 'success' | 'error' = 'idle';
  contactMessage = '';
  contactStatus: 'idle' | 'success' | 'error' = 'idle';
  billingCycle: 'monthly' | 'yearly' = 'yearly';
  statsLoaded = true;
  ctaStats = [
    { label: 'Restaurants inscrits', value: 20 },
    { label: 'Commandes traitées', value: 800 },
    { label: 'QR codes générés', value: 60 },
  ];
  animatedStats = [0, 0, 0];
  private ctaObserver?: IntersectionObserver;
  private revealObserver?: IntersectionObserver;
  private ctaAnimationStarted = false;
  private ctaStatsTimer?: ReturnType<typeof setInterval>;
  private newsletterMessageTimer?: ReturnType<typeof setTimeout>;
  private contactMessageTimer?: ReturnType<typeof setTimeout>;

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

  contactForm = {
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: '',
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
        this.message = "Impossible de charger les données SaaS pour le moment.";
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
    this.clearNewsletterMessageTimer();
    this.clearContactMessageTimer();
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
        this.message = 'Abonnement initialisé. Redirection vers votre espace restaurant...';
        this.lead = { name: '', owner_name: '', owner_email: '', owner_phone: '', city: '', saas_plan_id: this.lead.saas_plan_id };
        this.isSubmitting = false;
        setTimeout(() => this.router.navigate(['/dashboard']), 700);
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
      this.newsletterMessage = 'Ajoutez votre email pour recevoir les nouveautés.';
      this.newsletterStatus = 'error';
      this.hideNewsletterMessageAfterDelay(12000);
      return;
    }

    if (!this.isValidEmail(email)) {
      this.newsletterMessage = 'Adresse e-mail invalide. Vérifiez le format, puis réessayez.';
      this.newsletterStatus = 'error';
      this.hideNewsletterMessageAfterDelay(12000);
      return;
    }

    this.isNewsletterSubmitting = true;
    this.newsletterMessage = '';
    this.newsletterStatus = 'idle';

    this.saas.subscribeNewsletter(email).pipe(
      timeout(10000),
      finalize(() => this.isNewsletterSubmitting = false),
    ).subscribe({
      next: (response) => {
        this.newsletterMessage = response.message || 'Votre adresse e-mail a été enregistrée dans la newsletter.';
        this.newsletterStatus = 'success';
        this.newsletterEmail = '';
        this.cdr.detectChanges();
        this.hideNewsletterMessageAfterDelay(7000);
      },
      error: (error) => {
        this.newsletterMessage = this.publicErrorMessage(error, "Impossible d'inscrire cet email pour le moment.");
        this.newsletterStatus = 'error';
        this.cdr.detectChanges();
        this.hideNewsletterMessageAfterDelay(12000);
      },
    });
  }

  submitContact(): void {
    const payload = {
      name: this.contactForm.name.trim(),
      email: this.contactForm.email.trim(),
      phone: this.contactForm.phone.trim(),
      subject: this.contactForm.subject.trim() || 'Contact restaurant',
      message: this.contactForm.message.trim(),
    };

    if (!payload.name || !payload.email || !payload.message) {
      this.contactMessage = 'Completez votre nom, email et message.';
      this.contactStatus = 'error';
      this.hideContactMessageAfterDelay(12000);
      return;
    }

    if (!this.isValidEmail(payload.email)) {
      this.contactMessage = 'Adresse e-mail invalide. Vérifiez le format, puis réessayez.';
      this.contactStatus = 'error';
      this.hideContactMessageAfterDelay(12000);
      return;
    }

    this.isContactSubmitting = true;
    this.contactMessage = '';
    this.contactStatus = 'idle';

    this.saas.sendContactMessage(payload).pipe(
      timeout(8000),
      finalize(() => this.isContactSubmitting = false),
    ).subscribe({
      next: (response) => {
        this.contactMessage = response.message || 'Message envoyé. Nous reviendrons vers vous rapidement.';
        this.contactStatus = 'success';
        this.contactForm = {
          name: '',
          email: '',
          phone: '',
          subject: '',
          message: '',
        };
        this.cdr.detectChanges();
        this.hideContactMessageAfterDelay(7000);
      },
      error: (error) => {
        if (error?.name === 'TimeoutError') {
          this.contactMessage = 'Le serveur met trop de temps à répondre. Veuillez réessayer.';
          this.contactStatus = 'success';
        } else {
          this.contactMessage = this.publicErrorMessage(error, "Impossible d'envoyer le message pour le moment.");
          this.contactStatus = 'error';
        }
        this.cdr.detectChanges();
        this.hideContactMessageAfterDelay(12000);
      },
    });
  }

  displayPrice(plan: SaasPlan): number {
    const price = Number(plan.monthly_price ?? 0);
    if (this.billingCycle !== 'yearly') {
      return price;
    }

    const slug = String(plan.slug || plan.name).toLowerCase();
    if (slug.includes('starter')) return 12;
    if (slug.includes('pro')) return 20;
    if (slug.includes('business')) return 25;

    return price;
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

  private publicErrorMessage(error: any, fallback: string): string {
    if (error?.status === 0) {
      return "Impossible de joindre le serveur. Vérifiez que l'API Laravel est démarrée sur le port 8000.";
    }

    if (error?.name === 'TimeoutError') {
      return 'Le serveur met trop de temps a repondre. Reessayez dans un instant.';
    }

    const errors = error?.error?.errors;
    if (errors && typeof errors === 'object') {
      const messages = Object.values(errors).flat().filter((message) => typeof message === 'string');
      if (messages.length) {
        return messages.join(' ');
      }
    }

    return error?.error?.message || fallback;
  }

  private isValidEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  private hideNewsletterMessageAfterDelay(delay = 5000): void {
    this.clearNewsletterMessageTimer();
    this.newsletterMessageTimer = setTimeout(() => {
      this.newsletterMessage = '';
      this.newsletterStatus = 'idle';
      this.cdr.detectChanges();
    }, delay);
  }

  private clearNewsletterMessageTimer(): void {
    if (this.newsletterMessageTimer) {
      clearTimeout(this.newsletterMessageTimer);
      this.newsletterMessageTimer = undefined;
    }
  }

  private hideContactMessageAfterDelay(delay = 6000): void {
    this.clearContactMessageTimer();
    this.contactMessageTimer = setTimeout(() => {
      this.contactMessage = '';
      this.contactStatus = 'idle';
      this.cdr.detectChanges();
    }, delay);
  }

  private clearContactMessageTimer(): void {
    if (this.contactMessageTimer) {
      clearTimeout(this.contactMessageTimer);
      this.contactMessageTimer = undefined;
    }
  }
}
