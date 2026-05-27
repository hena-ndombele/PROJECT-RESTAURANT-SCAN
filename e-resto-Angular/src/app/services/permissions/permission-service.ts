import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import { ApiPagination } from "../../models/shared/ApiPagination";
import { PermissionDto } from "../../models/permissions/PermissionDto";

@Injectable({
  providedIn: "root",
})
export class PermissionService {
  private apiUrl = "http://localhost:8000/api";

  constructor(private http: HttpClient) {}

  list(): Observable<ApiPagination<PermissionDto>> {
    return this.http.get<ApiPagination<PermissionDto>>(`${this.apiUrl}/permissions`, {
      params: { per_page: 1000 },
    });
  }

  search(query: string): Observable<ApiPagination<PermissionDto>> {
    return this.http.get<ApiPagination<PermissionDto>>(`${this.apiUrl}/permissions/search`, {
      params: { query },
    });
  }

  show(id: number): Observable<PermissionDto> {
    return this.http.get<PermissionDto>(`${this.apiUrl}/permissions/${id}`);
  }

}
