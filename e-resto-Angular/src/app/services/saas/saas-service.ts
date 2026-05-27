import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Restaurant, SaasOverview, SaasPlan } from '../../models/saas/saas.models';

@Injectable({ providedIn: 'root' })
export class SaasService {
  private apiUrl = 'http://localhost:8000/api/saas';

  constructor(private http: HttpClient) {}

  overview(): Observable<SaasOverview> {
    return this.http.get<SaasOverview>(`${this.apiUrl}/overview`);
  }

  plans(): Observable<SaasPlan[]> {
    return this.http.get<SaasPlan[]>(`${this.apiUrl}/plans`);
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
}
