import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SaasService } from '../../services/saas/saas-service';
import { ThemeService } from '../../services/theme/theme-service';

@Component({
  selector: 'app-restaurant-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './restaurant-settings.html',
  styleUrl: './restaurant-settings.scss',
})
export class RestaurantSettings implements OnInit {
  private readonly saas = inject(SaasService);
  readonly theme = inject(ThemeService);

  loading = signal(false);
  saving = signal(false);
  message = signal('');
  error = signal('');
  logoPreview = signal<string | null>(null);
  logoData: string | null = null;

  canCustomize(): boolean {
    if (this.restaurant?.features) {
      return this.restaurant.features.customization === true;
    }

    const slug = String(this.restaurant?.plan?.slug || '').toLowerCase();
    const name = String(this.restaurant?.plan?.name || '').toLowerCase();
    return ['pro', 'business'].some((plan) => slug.includes(plan) || name.includes(plan));
  }

  restaurant: any = {
    name: '',
    owner_name: '',
    owner_phone: '',
    address: '',
    city: '',
    currency: 'CDF',
    slug: '',
    logo_url: '',
    settings: {
      app_name: '',
      slogan: '',
      description: '',
      google_maps_url: '',
      theme: {
        primary: '#ff9f1a',
        secondary: '#d71920',
        background: '#fff7ef',
      },
    },
  };

  readonly primaryColors = ['#d99a16', '#ef3340', '#2296e3', '#45b34a', '#ff7133', '#9c27b0', '#00bcd4', '#ec407a', '#8bc34a', '#ff9800', '#607d8b', '#f44336'];
  readonly backgroundColors = ['#1a1008', '#0f172a', '#151429', '#181818', '#111827', '#141414', '#080b10', '#2d1773', '#14331f', '#351b18', '#ffffff', '#f8fafc'];

  ngOnInit(): void {
    this.loadRestaurant();
  }

  loadRestaurant(): void {
    this.loading.set(true);
    this.saas.currentRestaurant().subscribe({
      next: (restaurant) => {
        this.restaurant = this.normalizeRestaurant(restaurant);
        this.logoPreview.set(this.restaurant.logo_url || null);
        this.loading.set(false);
      },
      error: () => {
        const cached = localStorage.getItem('restaurant_session');
        if (cached) {
          this.restaurant = this.normalizeRestaurant(JSON.parse(cached));
          this.logoPreview.set(this.restaurant.logo_url || null);
        } else {
          this.error.set('Impossible de charger les parametres du restaurant.');
        }
        this.loading.set(false);
      },
    });
  }

  onLogoSelected(event: Event): void {
    if (!this.canCustomize()) return;
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      this.error.set('Choisissez une image valide pour le logo.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      this.logoData = String(reader.result || '');
      this.logoPreview.set(this.logoData);
    };
    reader.readAsDataURL(file);
  }

  selectPrimary(color: string): void {
    if (!this.canCustomize()) return;
    this.restaurant.settings.theme.primary = color;
  }

  selectBackground(color: string): void {
    if (!this.canCustomize()) return;
    this.restaurant.settings.theme.background = color;
  }

  save(): void {
    this.saving.set(true);
    this.message.set('');
    this.error.set('');

    const payload: any = {
      name: this.restaurant.name,
      owner_name: this.restaurant.owner_name,
      owner_phone: this.restaurant.owner_phone,
      address: this.restaurant.address,
      city: this.restaurant.city,
      currency: this.restaurant.currency,
    };

    if (this.canCustomize()) {
      payload.slug = this.slugify(this.restaurant.slug || this.restaurant.name);
      payload.logo_data = this.logoData;
      payload.settings = {
        app_name: this.restaurant.name,
        slogan: this.restaurant.settings.slogan,
        description: this.restaurant.settings.description,
        google_maps_url: this.restaurant.settings.google_maps_url,
        theme: {
          primary: this.restaurant.settings.theme.primary,
          secondary: this.restaurant.settings.theme.secondary,
          background: this.restaurant.settings.theme.background,
        },
      };
    }

    this.saas.updateRestaurantProfile(payload).subscribe({
      next: (restaurant) => {
        this.restaurant = this.normalizeRestaurant(restaurant);
        this.logoPreview.set(this.restaurant.logo_url || null);
        this.logoData = null;
        localStorage.setItem('restaurant_session', JSON.stringify(this.restaurant));
        this.message.set('Parametres sauvegardes. Le menu client utilisera ces informations au prochain chargement.');
        this.saving.set(false);
      },
      error: (error) => {
        this.error.set(error?.error?.message || 'Impossible de sauvegarder les parametres.');
        this.saving.set(false);
      },
    });
  }

  menuUrl(): string {
    const base = window.location.origin.replace(':4200', ':5173');
    return `${base}/?restaurant_slug=${this.restaurant.slug || 'mon-restaurant'}`;
  }

  private normalizeRestaurant(restaurant: any): any {
    const settings = restaurant?.settings || {};
    const theme = settings.theme || {};

    return {
      ...restaurant,
      owner_name: restaurant?.owner_name || '',
      owner_phone: restaurant?.owner_phone || '',
      address: restaurant?.address || '',
      city: restaurant?.city || '',
      currency: restaurant?.currency || 'CDF',
      settings: {
        app_name: restaurant?.name || settings.app_name || 'Menu digital',
        slogan: settings.slogan || '',
        description: settings.description || 'Menu digital QR code',
        google_maps_url: settings.google_maps_url || '',
        theme: {
          primary: theme.primary || '#ff9f1a',
          secondary: theme.secondary || '#d71920',
          background: theme.background || '#fff7ef',
        },
      },
    };
  }

  private slugify(value: string): string {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);
  }
}
