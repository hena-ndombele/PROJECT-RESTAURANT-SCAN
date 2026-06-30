import { Routes } from '@angular/router';
import { DashboardLayoutComponent } from './layouts/dashboard-layout/dashboard-layout';
import { CreateProductPageComponent } from './pages/create-product/create-product-page';
import { DocsPageComponent } from './pages/docs/docs-page';
import { NotFoundPageComponent } from './pages/not-found/not-found-page';
import { ReportsPageComponent } from './pages/reports/reports-page';
import {ListAgent} from "./features/agents/list-agent/list-agent";
import {ListDish} from "./features/dish/list-dish/list-dish";
import {ListCategory} from "./features/category/list-category/list-category";
import {ListRole} from "./features/identity/roles/list-role/list-role";
import {Dashboard} from "./features/dashboard/dashboard";
import {AuthGuard} from "./guards/auth/auth-guard-guard";
import {ListTable} from "./features/tables/list-table/list-table";
import {CreateDish} from "./features/dish/create-dish/create-dish";
import {ListFeedback} from "./features/feedback/list-feedback/list-feedback";
import {ListOrders} from "./features/orders/list-orders/list-orders";
import {Profile} from "./features/auth/profile/profile";
import {FloorTable} from "./features/tables/floor-table/floor-table";
import {Reservation} from "./features/tables/reservation/reservation";
import {ShowDish} from "./features/dish/show-dish/show-dish";
import {UpdateDish} from "./features/dish/update-dish/update-dish";
import {ListUser} from "./features/identity/users/list-user/list-user";
import {SaasLanding} from "./pages/saas-landing/saas-landing";
import {PricingPage} from "./pages/pricing/pricing-page";
import {RestaurantSignup} from "./pages/restaurant-signup/restaurant-signup";
import {RestaurantCheckout} from "./pages/restaurant-checkout/restaurant-checkout";
import {RestaurantLogin} from "./pages/restaurant-login/restaurant-login";
import {RestaurantSettings} from "./pages/restaurant-settings/restaurant-settings";
import {RestaurantSubscription} from "./pages/restaurant-subscription/restaurant-subscription";
import {Otp} from "./features/auth/otp/otp";
import {EmployeeVerify} from "./pages/employee-verify/employee-verify";

export const routes: Routes = [

  { path: '', component: SaasLanding, title: 'Restaurant Scan- Plateforme restaurant' },
  { path: 'pricing', component: PricingPage, title: 'Pricing Restaurant Scan' },
  { path: 'restaurant/signup', component: RestaurantSignup, title: 'Création compte restaurant - Restaurant Scan' },
  { path: 'restaurant/checkout', component: RestaurantCheckout, title: 'Paiement abonnement - Restaurant Scan' },
  { path: 'restaurant/login', component: RestaurantLogin, title: 'Connexion restaurant - Restaurant Scan' },
  { path: 'auth/otp', component: Otp, title: 'Vérification OTP - Restaurant Scan' },
  { path: 'employee/verify/:id', component: EmployeeVerify, title: 'Vérification badge employé - Restaurant Scan' },

  {
    path: '',
    component: DashboardLayoutComponent,
    children: [
      { path: 'dashboard', component: Dashboard, title: 'Dashboard - Restaurant Scan', canActivate: [AuthGuard], data: { permission: 'dashboard.view' } },
      { path: 'agents/list-agent', component: ListAgent, title: 'Agents - Restaurant Scan', canActivate: [AuthGuard], data: { permission: 'agents.list' } },
      { path: 'category/list-category', component: ListCategory, title: 'Category', canActivate: [AuthGuard], data: { permission: 'categories.list' } },
      { path: 'tables/list-table', component: ListTable, title: 'Tables - Restaurant Scan', canActivate: [AuthGuard], data: { permission: ['tables.list', 'tables.view', 'tables.create', 'tables.update', 'tables.delete'] } },
      { path: 'table/list-table', redirectTo: 'tables/list-table', pathMatch: 'full' },
      { path: 'auth/profile', component: Profile, title: 'Profile', canActivate: [AuthGuard], data: { permission: 'profile.view' } },
      { path: 'feedback/list', component: ListFeedback, title: 'FeedBack', canActivate: [AuthGuard], data: { permission: 'feedback.list' } },
      { path: 'orders/list', component: ListOrders, title: 'Orders', canActivate: [AuthGuard], data: { permission: 'orders.list' } },
      { path: 'restaurant/settings', component: RestaurantSettings, title: 'Paramètres restaurant - Restaurant Scan', canActivate: [AuthGuard], data: { permission: 'settings.view' } },
      { path: 'restaurant/subscription', component: RestaurantSubscription, title: 'Abonnement - Restaurant Scan', canActivate: [AuthGuard] },
      { path: 'dish/list-dish', component: ListDish, title: 'Dish - Restaurant Scan', canActivate: [AuthGuard], data: { permission: 'plats.list' } },
      { path: 'dish/show/:id', component: ShowDish, title: 'Dish - Restaurant Scan', canActivate: [AuthGuard], data: { permission: 'plats.view' } },
      { path: 'dish/edit/:id', component: UpdateDish, title: 'Update Dish - Restaurant Scan', canActivate: [AuthGuard], data: { permission: 'plats.update' } },
      { path: 'dish/create', component: CreateDish, title: 'Dish - Restaurant Scan', canActivate: [AuthGuard], data: { permission: 'plats.create' } },
      { path: 'identity/list-roles', component: ListRole, title: 'Role - Restaurant Scan', canActivate: [AuthGuard], data: { permission: 'roles.list' } },
      { path: 'identity/list-users', component: ListUser, title: 'Users - Restaurant Scan', canActivate: [AuthGuard], data: { permission: 'users.list' } },
      { path: 'table/floor-table', component: FloorTable, title: 'Floor Table - Restaurant Scan', canActivate: [AuthGuard], data: { permission: 'tables.list' } },
      { path: 'table/reservation-table', component: Reservation, title: 'Réservations - Restaurant Scan', canActivate: [AuthGuard], data: { permission: 'reservations.list' } },
      { path: 'create-product', component: CreateProductPageComponent, title: 'Create Product - InApp Inventory Dashboard' },
      { path: 'reports', component: ReportsPageComponent, title: 'Reports - InApp Inventory Dashboard' },
      { path: 'docs', component: DocsPageComponent, title: 'Documentation - InApp Inventory Dashboard' }
    ]
  },

  { path: 'auth/login', redirectTo: '/restaurant/login' },


  { path: '404-error', component: NotFoundPageComponent, title: '404 Error' },
  { path: '**', redirectTo: '/404-error' }
];
