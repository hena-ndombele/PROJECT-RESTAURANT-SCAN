import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Restaurant, RestaurantPlanUsage, SaasOverview, SaasPlan, SubscriptionPayment } from '../../models/saas/saas.models';
import { API_ROOT } from '../api-url';

@Injectable({ providedIn: 'root' })
export class SaasService {
  private apiUrl = `${API_ROOT}/saas`;

  constructor(private http: HttpClient) {}

  overview(): Observable<SaasOverview> {
    return this.http.get<SaasOverview>(`${this.apiUrl}/overview`);
  }

  plans(): Observable<SaasPlan[]> {
    return this.http.get<SaasPlan[]>(`${this.apiUrl}/plans`);
  }

  subscribeNewsletter(email: string): Observable<{ message: string; already_exists?: boolean }> {
    return this.http.post<{ message: string; already_exists?: boolean }>(`${this.apiUrl}/newsletter`, {
      email,
      source: 'saas_landing',
    });
  }

  sendContactMessage(payload: { name: string; email: string; phone?: string; subject: string; message: string }): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${API_ROOT}/public/contact`, payload);
  }

  restaurants(): Observable<Restaurant[]> {
    return this.http.get<Restaurant[]>(`${this.apiUrl}/restaurants`);
  }

  createRestaurant(payload: Partial<Restaurant>): Observable<Restaurant> {
    return this.http.post<Restaurant>(`${this.apiUrl}/restaurants`, payload);
  }

  updateRestaurant(id: string, payload: Partial<Restaurant>): Observable<Restaurant> {
    return this.http.put<Restaurant>(`${this.apiUrl}/restaurants/${id}`, payload);
  }

  deleteRestaurant(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/restaurants/${id}`);
  }

  registerInterest(payload: Partial<Restaurant>): Observable<Restaurant> {
    return this.http.post<Restaurant>(`${this.apiUrl}/register-interest`, payload);
  }

  signup(payload: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/signup`, payload);
  }

  checkoutMobileMoney(payload: { restaurant_id: string; provider: string; wallet_id: string; billing_cycle: 'monthly' | 'yearly'; saas_plan_id?: string }): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/checkout/mobile-money`, payload);
  }

  checkoutMobileMoneyStatus(paymentId: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/checkout/mobile-money/${paymentId}`);
  }

  login(payload: { email: string; password: string }): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/login`, payload);
  }

  googleConfig(): Observable<{ enabled: boolean; client_id: string | null }> {
    return this.http.get<{ enabled: boolean; client_id: string | null }>(`${this.apiUrl}/google/config`);
  }

  googleLogin(credential: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/google/login`, { credential });
  }

  currentRestaurant(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/me`);
  }

  restaurantUsage(): Observable<RestaurantPlanUsage> {
    return this.http.get<RestaurantPlanUsage>(`${this.apiUrl}/restaurant/usage`);
  }

  restaurantPayments(status?: string): Observable<SubscriptionPayment[]> {
    const suffix = status && status !== 'all' ? `?status=${encodeURIComponent(status)}` : '';
    return this.http.get<SubscriptionPayment[]>(`${this.apiUrl}/restaurant/payments${suffix}`);
  }

  updateRestaurantProfile(payload: any): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/restaurant/profile`, payload);
  }
}
