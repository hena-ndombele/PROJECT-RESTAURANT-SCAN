import { Injectable } from "@angular/core";
import {HttpClient} from "@angular/common/http";
import {Observable} from "rxjs";
import {AgentDto} from "../../models/agents/AgentDto";
import { API_ROOT } from "../api-url";


@Injectable({
  providedIn: "root",
})
export class AgentService
{
  private apiUrl = API_ROOT;

  constructor(private http: HttpClient) {}

  list(): Observable<AgentDto[]> {
    return this.http.get<AgentDto[]>(`${this.apiUrl}/agents/list`);
  }

  delete(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/agents/delete/${id}`);
  }

  create(formData: AgentInput | FormData): Observable<any> {
    return this.http.post(`${this.apiUrl}/agents/create`, formData);
  }

  update(id: string, data: AgentInput | FormData): Observable<any> {
    if (data instanceof FormData) {
      data.append('_method', 'PUT');
      return this.http.post(`${this.apiUrl}/agents/update/${id}`, data);
    }

    return this.http.put(`${this.apiUrl}/agents/update/${id}`, data);
  }

  show(id: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/agents/show/${id}`);
  }
}
