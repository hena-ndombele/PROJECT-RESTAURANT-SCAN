import { Injectable } from "@angular/core";
import {HttpClient} from "@angular/common/http";
import {Observable} from "rxjs";
import {AgentDto} from "../../models/agents/AgentDto";


@Injectable({
  providedIn: "root",
})
export class AgentService
{
  private apiUrl = "http://localhost:8000/api";

  constructor(private http: HttpClient) {}

  list(): Observable<AgentDto[]> {
    return this.http.get<AgentDto[]>(`${this.apiUrl}/agents/list`);
  }

  delete(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/agents/delete/${id}`);
  }

  create(formData: AgentInput): Observable<any> {
    return this.http.post(`${this.apiUrl}/agents/create`, formData);
  }

  update(id: string, data: AgentInput): Observable<any> {
    return this.http.put(`${this.apiUrl}/agents/update/${id}`, data);
  }

  show(id: string): Observable<AgentDto> {
    return this.http.get<AgentDto>(`${this.apiUrl}/agents/show/${id}`);
  }
}
