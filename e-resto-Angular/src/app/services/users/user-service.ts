import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import { ApiPagination } from "../../models/shared/ApiPagination";
import { UserDto } from "../../models/users/UserDto";
import { UserInput } from "../../models/users/UserInput";

@Injectable({
  providedIn: "root",
})
export class UserService {
  private apiUrl = "http://localhost:8000/api";

  constructor(private http: HttpClient) {}

  list(): Observable<ApiPagination<UserDto>> {
    return this.http.get<ApiPagination<UserDto>>(`${this.apiUrl}/users/list`);
  }

  search(query: string): Observable<ApiPagination<UserDto>> {
    return this.http.get<ApiPagination<UserDto>>(`${this.apiUrl}/users/search`, {
      params: { query },
    });
  }

  show(id: string): Observable<UserDto> {
    return this.http.get<UserDto>(`${this.apiUrl}/users/${id}`);
  }

  create(data: UserInput): Observable<{ message: string; data: UserDto }> {
    return this.http.post<{ message: string; data: UserDto }>(`${this.apiUrl}/auth/register`, data);
  }

  update(id: string, data: UserInput): Observable<{ message: string; data: UserDto }> {
    return this.http.put<{ message: string; data: UserDto }>(`${this.apiUrl}/users/${id}`, data);
  }

  delete(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/users/${id}`);
  }
}
