import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import { ApiPagination } from "../../models/shared/ApiPagination";
import { RoleDto } from "../../models/roles/RoleDto";
import { RoleInput } from "../../models/roles/RoleInput";
import { API_ROOT } from "../api-url";

@Injectable({
  providedIn: "root",
})
export class RoleService {
  private apiUrl = API_ROOT;

  constructor(private http: HttpClient) {}

  list(): Observable<ApiPagination<RoleDto>> {
    return this.http.get<ApiPagination<RoleDto>>(`${this.apiUrl}/roles`, {
      params: { per_page: 1000 },
    });
  }

  search(query: string): Observable<ApiPagination<RoleDto>> {
    return this.http.get<ApiPagination<RoleDto>>(`${this.apiUrl}/roles/search`, {
      params: { query },
    });
  }

  show(id: number): Observable<RoleDto> {
    return this.http.get<RoleDto>(`${this.apiUrl}/roles/${id}`);
  }

  create(data: RoleInput): Observable<{ message: string; data: RoleDto }> {
    return this.http.post<{ message: string; data: RoleDto }>(`${this.apiUrl}/roles`, data);
  }

  update(id: number, data: RoleInput): Observable<{ message: string; data: RoleDto }> {
    return this.http.put<{ message: string; data: RoleDto }>(`${this.apiUrl}/roles/${id}`, data);
  }

  syncPermissions(id: number, permissions: string[]): Observable<{ message: string; data: RoleDto }> {
    return this.http.put<{ message: string; data: RoleDto }>(`${this.apiUrl}/roles/${id}/permissions`, {
      permissions,
    });
  }

  delete(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/roles/${id}`);
  }
}
