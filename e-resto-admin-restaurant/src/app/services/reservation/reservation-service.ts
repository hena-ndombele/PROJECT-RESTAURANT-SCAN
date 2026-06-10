import { HttpClient, HttpParams } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { map, Observable } from "rxjs";
import { API_ROOT } from "../api-url";

export type Réservationstatus = "pending" | "confirmed" | "seated" | "completed" | "cancelled" | "no_show";

export interface ReservationDto {
  id: string;
  restaurant_id?: string | null;
  table_id?: string | null;
  name: string;
  phone: string;
  email: string;
  guests: number;
  reservation_date: string;
  reservation_time: string;
  special_requests?: string | null;
  internal_note?: string | null;
  cancellation_reason?: string | null;
  status: Réservationstatus;
  source?: string;
  confirmed_at?: string | null;
  seated_at?: string | null;
  completed_at?: string | null;
  created_at?: string;
  table?: { id: string; name: string; status?: string } | null;
}

@Injectable({ providedIn: "root" })
export class Réservationservice {
  private readonly apiUrl = `${API_ROOT}/Réservations`;

  constructor(private http: HttpClient) {}

  list(filters: { status?: string; date?: string } = {}): Observable<ReservationDto[]> {
    let params = new HttpParams();
    if (filters.status && filters.status !== "all") params = params.set("status", filters.status);
    if (filters.date) params = params.set("date", filters.date);

    return this.http.get<any>(this.apiUrl, { params }).pipe(
      map((response) => Array.isArray(response) ? response : (response.data || []))
    );
  }

  updateStatus(id: string, payload: {
    status: Réservationstatus;
    internal_note?: string;
    cancellation_reason?: string;
  }): Observable<ReservationDto> {
    return this.http.patch<any>(`${this.apiUrl}/${id}/status`, payload).pipe(
      map((response) => response.data || response)
    );
  }

  delete(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }
}
