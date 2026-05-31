import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { SaasService } from '../../services/saas/saas-service';

@Component({
  selector: 'app-restaurant-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './restaurant-dashboard.html',
  styleUrl: './restaurant-dashboard.scss',
})
export class RestaurantDashboard {
  restaurant: any = {
    name: 'E-RESTO Demo',
    appName: 'E-RESTO Menu',
    logo: 'assets/logo/e-resto-logo.png',
    currency: 'CDF',
    primary: '#ff7a1a',
    secondary: '#d71920',
  };

  plan: any = {
    name: 'Pro',
    tables: 80,
    users: 12,
    features: ['Menu QR', 'Commandes temps reel', 'Reservations', 'Mobile money', 'Rapports avances'],
  };

  modules = [
    ['bi-speedometer2', 'Dashboard', 'Revenus, commandes et activite du jour'],
    ['bi-qr-code', 'Tables QR', 'Creation de tables et QR codes'],
    ['bi-card-list', 'Menu', 'Categories, plats, images et disponibilite'],
    ['bi-bag-check', 'Commandes', 'Cuisine, service, statut et paiement'],
    ['bi-calendar-check', 'Reservations', 'Planning et confirmation client'],
    ['bi-people', 'Equipe', 'Agents, roles et permissions'],
    ['bi-phone', 'Paiements', 'Cash et mobile money cote client'],
    ['bi-palette', 'Branding', 'Logo, nom app, couleurs et devise'],
  ];

  metrics = { orders_today: 0, revenue_today: 0, tables: 0, active_tables: 0, team: 0 };
  recentOrders: any[] = [];
  message = '';
  loading = true;

  constructor(private saas: SaasService, private router: Router) {
    this.load();
  }

  load(): void {
    this.saas.restaurantDashboard().subscribe({
      next: (dashboard) => {
        const restaurant = dashboard.restaurant;
        this.restaurant = {
          ...restaurant,
          appName: restaurant.settings?.app_name || restaurant.name,
          logo: restaurant.logo || 'assets/logo/e-resto-logo.png',
          primary: restaurant.settings?.theme?.primary || '#ff7a1a',
          secondary: restaurant.settings?.theme?.secondary || '#d71920',
        };
        this.plan = {
          name: restaurant.plan?.name || 'Starter',
          tables: restaurant.limits?.tables || restaurant.plan?.max_tables || 0,
          users: restaurant.limits?.users || restaurant.plan?.max_users || 0,
          features: restaurant.plan?.features || [],
        };
        this.metrics = dashboard.metrics;
        this.recentOrders = dashboard.recent_orders || [];
        this.loading = false;
      },
      error: () => {
        const session = localStorage.getItem('restaurant_session');
        if (session) {
          localStorage.setItem('pending_restaurant', session);
        }
        localStorage.removeItem('restaurant_token');
        localStorage.removeItem('restaurant_session');
        this.router.navigate(['/restaurant/checkout']);
      },
    });
  }

  saveBranding(): void {
    this.saas.updateRestaurantProfile({
      name: this.restaurant.name,
      currency: this.restaurant.currency,
      settings: {
        app_name: this.restaurant.appName,
        theme: {
          primary: this.restaurant.primary,
          secondary: this.restaurant.secondary,
        },
      },
    }).subscribe({
      next: (restaurant) => {
        this.message = 'Profil restaurant mis a jour.';
        localStorage.setItem('restaurant_session', JSON.stringify(restaurant));
      },
      error: () => this.message = 'Mise a jour impossible pour le moment.',
    });
  }

  logout(): void {
    localStorage.removeItem('restaurant_token');
    localStorage.removeItem('restaurant_session');
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_data');
    this.router.navigate(['/restaurant/login']);
  }
}
