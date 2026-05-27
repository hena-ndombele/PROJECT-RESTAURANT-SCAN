import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-restaurant-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './restaurant-dashboard.html',
  styleUrl: './restaurant-dashboard.scss',
})
export class RestaurantDashboard {
  restaurant = {
    name: 'E-RESTO Demo',
    appName: 'E-RESTO Menu',
    logo: 'assets/logo/e-resto-logo.png',
    currency: 'CDF',
    primary: '#ff7a1a',
    secondary: '#d71920',
  };

  plan = {
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
}
