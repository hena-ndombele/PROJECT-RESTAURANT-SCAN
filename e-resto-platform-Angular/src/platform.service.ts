import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class PlatformService {
  private apiUrl = 'http://localhost:8000/api/saas';

  constructor(private http: HttpClient) {}

  overview() {
    return this.http.get<any>(`${this.apiUrl}/overview`);
  }

  restaurants() {
    return this.http.get<any[]>(`${this.apiUrl}/restaurants`);
  }

  createRestaurant(payload: any) {
    return this.http.post<any>(`${this.apiUrl}/restaurants`, payload);
  }

  updateRestaurant(id: string, payload: any) {
    return this.http.put<any>(`${this.apiUrl}/restaurants/${id}`, payload);
  }

  deleteRestaurant(id: string) {
    return this.http.delete<any>(`${this.apiUrl}/restaurants/${id}`);
  }
}
