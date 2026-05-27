import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter, RouterLink, RouterOutlet } from '@angular/router';
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PlatformService } from './platform.service';

@Component({
  selector: 'platform-root',
  standalone: true,
  imports: [RouterOutlet],
  template: '<router-outlet></router-outlet>',
})
class App {}

@Component({
  selector: 'platform-console',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <main class="shell">
      <aside>
        <a class="brand" routerLink="/"><img src="assets/e-resto-logo.svg" alt="">E-RESTO Platform</a>
        <a class="active"><i class="bi bi-buildings"></i> Restaurants</a>
        <a><i class="bi bi-credit-card"></i> Abonnements</a>
        <a><i class="bi bi-graph-up"></i> Revenus</a>
        <a><i class="bi bi-shield-lock"></i> Controle interne</a>
      </aside>
      <section class="content">
        <header>
          <div>
            <span>Administration interne</span>
            <h1>Gestion des restaurants E-RESTO</h1>
            <p>Application separee pour notre equipe : validation, suspension, plans et suivi SaaS.</p>
          </div>
          <button (click)="load()"><i class="bi bi-arrow-clockwise"></i> Actualiser</button>
        </header>

        <div class="kpis">
          <article><small>Restaurants</small><strong>{{ overview?.metrics?.restaurants || 0 }}</strong></article>
          <article><small>Actifs / essai</small><strong>{{ overview?.metrics?.active_restaurants || 0 }}</strong></article>
          <article><small>En essai</small><strong>{{ overview?.metrics?.trial_restaurants || 0 }}</strong></article>
          <article><small>MRR</small><strong>\${{ overview?.metrics?.monthly_revenue || 0 }}</strong></article>
        </div>

        <section class="panel form">
          <h2>{{ editingId ? 'Modifier restaurant' : 'Creer restaurant' }}</h2>
          <form (ngSubmit)="save()">
            <input [(ngModel)]="form.name" name="name" placeholder="Restaurant">
            <input [(ngModel)]="form.owner_name" name="owner_name" placeholder="Responsable">
            <input [(ngModel)]="form.owner_email" name="owner_email" placeholder="Email">
            <input [(ngModel)]="form.owner_phone" name="owner_phone" placeholder="Telephone">
            <input [(ngModel)]="form.city" name="city" placeholder="Ville">
            <select [(ngModel)]="form.saas_plan_id" name="saas_plan_id">
              <option *ngFor="let plan of overview?.plans" [value]="plan.id">{{ plan.name }}</option>
            </select>
            <select [(ngModel)]="form.status" name="status">
              <option value="trial">Essai</option>
              <option value="active">Actif</option>
              <option value="suspended">Suspendu</option>
              <option value="cancelled">Annule</option>
            </select>
            <div class="actions">
              <button>{{ editingId ? 'Mettre a jour' : 'Creer' }}</button>
              <button type="button" class="ghost" *ngIf="editingId" (click)="cancel()">Annuler</button>
            </div>
          </form>
          <p class="message" *ngIf="message">{{ message }}</p>
        </section>

        <section class="panel">
          <div class="panel-head">
            <h2>Restaurants inscrits</h2>
            <span>{{ restaurants.length }} comptes</span>
          </div>
          <div class="row" *ngFor="let restaurant of restaurants">
            <div><strong>{{ restaurant.name }}</strong><span>{{ restaurant.owner_name }} - {{ restaurant.owner_email }}</span></div>
            <b>{{ restaurant.plan?.name || 'Sans plan' }}</b>
            <em [class.active]="restaurant.status === 'active'">{{ restaurant.status }}</em>
            <div class="row-actions">
              <button type="button" (click)="edit(restaurant)">Editer</button>
              <button type="button" class="danger" (click)="remove(restaurant)">Supprimer</button>
            </div>
          </div>
        </section>
      </section>
    </main>
  `,
})
class PlatformConsole {
  overview: any;
  restaurants: any[] = [];
  editingId = '';
  message = '';
  form: any = this.emptyForm();

  constructor(private api: PlatformService) {
    this.load();
  }

  load() {
    this.api.overview().subscribe((overview) => {
      this.overview = overview;
      this.form.saas_plan_id ||= overview.plans?.[0]?.id;
    });
    this.api.restaurants().subscribe((restaurants) => this.restaurants = restaurants);
  }

  save() {
    const request = this.editingId ? this.api.updateRestaurant(this.editingId, this.form) : this.api.createRestaurant(this.form);
    request.subscribe(() => {
      this.message = this.editingId ? 'Restaurant mis a jour.' : 'Restaurant cree.';
      this.cancel();
      this.load();
    });
  }

  edit(restaurant: any) {
    this.editingId = restaurant.id;
    this.form = { ...restaurant, saas_plan_id: restaurant.saas_plan_id || restaurant.plan?.id };
  }

  cancel() {
    this.editingId = '';
    this.form = this.emptyForm();
    this.form.saas_plan_id = this.overview?.plans?.[0]?.id;
  }

  remove(restaurant: any) {
    if (!confirm(`Supprimer ${restaurant.name} ?`)) return;
    this.api.deleteRestaurant(restaurant.id).subscribe(() => this.load());
  }

  emptyForm() {
    return { name: '', owner_name: '', owner_email: '', owner_phone: '', city: '', country: 'CD', currency: 'CDF', status: 'trial' };
  }
}

bootstrapApplication(App, {
  providers: [
    provideHttpClient(),
    provideRouter([{ path: '', component: PlatformConsole }]),
  ],
});
