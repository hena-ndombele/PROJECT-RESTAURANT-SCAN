import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SaasService } from '../../services/saas/saas-service';
import { ThemeService } from '../../services/theme/theme-service';
import { AppPermissionService } from '../../services/auth/permission-service';
import { RestaurantPlanUsage } from '../../models/saas/saas.models';

@Component({
  selector: 'app-restaurant-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './restaurant-settings.html',
  styleUrl: './restaurant-settings.scss',
})
export class RestaurantSettings implements OnInit {
  private readonly saas = inject(SaasService);
  private readonly permissions = inject(AppPermissionService);
  readonly theme = inject(ThemeService);

  loading = signal(false);
  saving = signal(false);
  message = signal('');
  error = signal('');
  logoPreview = signal<string | null>(null);
  planUsage = signal<RestaurantPlanUsage | null>(null);
  logoData: string | null = null;
  readonly defaultRestaurantLogo = 'assets/logo/e-resto-logo.png';

  displayLogoUrl(): string {
    return this.logoPreview() || this.defaultRestaurantLogo;
  }

  canCustomize(): boolean {
    if (!this.canUpdateSettings()) {
      return false;
    }

    if (this.restaurant?.features) {
      return this.restaurant.features.customization === true;
    }

    const slug = String(this.restaurant?.plan?.slug || '').toLowerCase();
    const name = String(this.restaurant?.plan?.name || '').toLowerCase();
    return ['pro', 'business'].some((plan) => slug.includes(plan) || name.includes(plan));
  }

  canUpdateSettings(): boolean {
    return this.permissions.has('settings.update');
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
        whatsapp_order_phone: '',
        opening_time: '08:00',
        closing_time: '22:00',
        qr_template: '',
        theme: {
        primary: '#ff7a1a',
        secondary: '#d71920',
        background: '#fff7ef',
      },
    },
  };

  readonly primaryColors = ['#d99a16', '#ef3340', '#2296e3', '#45b34a', '#ff7133', '#9c27b0', '#00bcd4', '#ec407a', '#8bc34a', '#ff9800', '#607d8b', '#f44336'];
  readonly backgroundColors = ['#1a1008', '#0f172a', '#151429', '#181818', '#111827', '#141414', '#080b10', '#2d1773', '#14331f', '#351b18', '#ffffff', '#f8fafc'];

  ngOnInit(): void {
    this.loadRestaurant();
    this.loadUsage();
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
          this.error.set('Impossible de charger les paramètres du restaurant.');
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
    this.restaurant.settings.theme.customized = true;
    this.applyRestaurantTheme(this.restaurant);
  }

  selectBackground(color: string): void {
    if (!this.canCustomize()) return;
    this.restaurant.settings.theme.background = color;
    this.restaurant.settings.theme.customized = true;
    this.applyRestaurantTheme(this.restaurant);
  }

  save(): void {
    if (!this.canUpdateSettings()) {
      this.error.set("Vous n'avez pas la permission de modifier les parametres du restaurant.");
      return;
    }

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
      payload.logo_data = this.logoData;
      payload.settings = this.customizableSettingsPayload();
    } else {
      payload.settings = {
        whatsapp_order_phone: this.restaurant.settings.whatsapp_order_phone,
        opening_time: this.restaurant.settings.opening_time,
        closing_time: this.restaurant.settings.closing_time,
      };
    }

    this.saas.updateRestaurantProfile(payload).subscribe({
      next: (restaurant) => {
        this.restaurant = this.normalizeRestaurant(restaurant);
        this.logoPreview.set(this.restaurant.logo_url || null);
        this.logoData = null;
        localStorage.setItem('restaurant_session', JSON.stringify(this.restaurant));
        this.applyRestaurantTheme(this.restaurant);
        this.broadcastRestaurantSettings(this.restaurant);
        this.message.set('Paramètres sauvegardés. Les changements sont appliqués dans votre espace.');
        this.saving.set(false);
      },
      error: (error) => {
        this.error.set(error?.error?.message || 'Impossible de sauvegarder les paramètres.');
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
        whatsapp_order_phone: settings.whatsapp_order_phone || restaurant?.owner_phone || '',
        opening_time: settings.opening_time || '08:00',
        closing_time: settings.closing_time || '22:00',
        qr_template: ['poster', 'table_tent'].includes(settings.qr_template) ? settings.qr_template : '',
        theme: {
          primary: theme.primary || '#ff7a1a',
          secondary: theme.secondary || '#d71920',
          background: theme.background || '#fff7ef',
          customized: theme.customized === true || theme.is_customized === true,
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

  private customizableSettingsPayload(): any {
    return {
      app_name: this.restaurant.name,
      slogan: this.restaurant.settings.slogan,
      description: this.restaurant.settings.description,
      google_maps_url: this.restaurant.settings.google_maps_url,
      whatsapp_order_phone: this.restaurant.settings.whatsapp_order_phone,
      opening_time: this.restaurant.settings.opening_time,
      closing_time: this.restaurant.settings.closing_time,
      qr_template: this.restaurant.settings.qr_template,
      theme: {
        primary: this.restaurant.settings.theme.primary,
        secondary: this.restaurant.settings.theme.secondary,
        background: this.restaurant.settings.theme.background,
        customized: true,
      },
    };
  }

  onColorInput(): void {
    if (!this.canCustomize()) return;
    this.restaurant.settings.theme.customized = true;
    this.applyRestaurantTheme(this.restaurant);
  }

  private loadUsage(): void {
    this.saas.restaurantUsage().subscribe({
      next: (usage) => this.planUsage.set(usage),
      error: () => this.planUsage.set(null),
    });
  }

  private broadcastRestaurantSettings(restaurant: any): void {
    window.dispatchEvent(new CustomEvent('restaurant-settings-updated', {
      detail: restaurant,
    }));
  }

  private applyRestaurantTheme(restaurant: any): void {
    const theme = restaurant?.settings?.theme || restaurant?.theme || {};
    const canUseCustomTheme = this.canCustomize() && (theme.customized === true || theme.is_customized === true);
    const primary = this.normalizeColor(canUseCustomTheme ? theme.primary_color || theme.primary || theme.accent : null, '#ff7a1a');
    const secondary = this.normalizeColor(canUseCustomTheme ? theme.secondary_color || theme.secondary : null, '#d71920');
    const surface = this.normalizeColor(canUseCustomTheme ? theme.background_color || theme.background || theme.surface : null, '#fff7ef');
    const primaryRgb = this.hexToRgb(primary);
    const buttonBackground = canUseCustomTheme
      ? primary
      : 'linear-gradient(135deg, #ff7a1a, #d71920)';

    document.body.classList.add('restaurant-theme');
    document.documentElement.style.setProperty('--dashboard-primary', primary);
    document.documentElement.style.setProperty('--dashboard-primary-rgb', primaryRgb);
    document.documentElement.style.setProperty('--dashboard-button-accent', secondary);
    document.documentElement.style.setProperty('--dashboard-button-bg', buttonBackground);
    document.documentElement.style.setProperty('--dashboard-secondary', secondary);
    document.documentElement.style.setProperty('--dashboard-surface', surface);
    document.documentElement.style.setProperty('--bs-primary', primary);
    document.documentElement.style.setProperty('--bs-primary-rgb', primaryRgb);
    document.documentElement.style.setProperty('--bs-link-color', primary);
    document.documentElement.style.setProperty('--bs-link-hover-color', secondary);
  }

  private normalizeColor(value: any, fallback: string): string {
    const color = String(value || '').trim();
    return /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(color) ? color : fallback;
  }

  private hexToRgb(hex: string): string {
    let clean = hex.replace('#', '').trim();
    if (clean.length === 3) {
      clean = clean.split('').map((char) => char + char).join('');
    }

    const value = Number.parseInt(clean, 16);
    if (Number.isNaN(value)) {
      return '255, 122, 26';
    }

    return `${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}`;
  }
}
