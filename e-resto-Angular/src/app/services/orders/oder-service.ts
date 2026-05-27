import { Injectable } from "@angular/core";
import {HttpClient, HttpParams} from "@angular/common/http";
import {map, Observable} from "rxjs";
import {Order} from "../../models/orders/OrderDto";

@Injectable({
  providedIn: "root",
})
export class OderService {
    private apiUrl = "http://localhost:8000/api/orders";

    constructor(private http: HttpClient) {
    }

    // list(): Observable<CategoryDto[]> {
    //     return this.http.get<CategoryDto[]>(`${this.apiUrl}/orders`);
    // }

    list(filters: { day?: string, month?: string, year?: string }): Observable<Order[]> {
        let params = new HttpParams();

        if (filters.day) params = params.set('day', filters.day);
        if (filters.month) params = params.set('month', filters.month);
        if (filters.year) params = params.set('year', filters.year);

        return this.http.get<any>(this.apiUrl, { params }).pipe(
            map(response => {
                if (Array.isArray(response)) return response;
                if (Array.isArray(response.data)) return response.data;
                if (Array.isArray(response.orders)) return response.orders;
                return [];
            })
        );
    }

    updateStatus(id: string, status: Order["status"]): Observable<Order> {
        return this.http.patch<any>(`${this.apiUrl}/${id}/status`, { status }).pipe(
            map(response => response.order ? response.order : response)
        );
    }

    // delete(id: string): Observable<any> {
    //     return this.http.delete(`${this.apiUrl}/category/${id}`);
    // }
    //
    // create(formData: FormData): Observable<any> {
    //     return this.http.post(`${this.apiUrl}/category/create`, formData);
    // }
    //
    // update(id: string, data: CategoryInput): Observable<any> {
    //     return this.http.put(`${this.apiUrl}/category/${id}`, data);
    // }
    //
    // show(id: string): Observable<CategoryDto> {
    //     return this.http.get<CategoryDto>(`${this.apiUrl}/category/${id}`);
    // }
}
