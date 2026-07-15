import {Injectable} from "@angular/core";
import {HttpClient} from "@angular/common/http";
import {Observable} from "rxjs";
import {TableDto} from "../../models/table/TableDto";
import { API_ROOT } from "../api-url";

@Injectable({
    providedIn: "root",
})
export class TableService {
    private apiUrl = API_ROOT;

    constructor(private http: HttpClient) {
    }

    list(): Observable<TableDto[]> {
        return this.http.get<TableDto[]>(`${this.apiUrl}/tables`);
    }
    show(id: number): Observable<TableDto> {
        return this.http.get<TableDto>(`${this.apiUrl}/tables/${id}`);
    }
    create(formData: FormData): Observable<any> {
        return this.http.post(`${this.apiUrl}/tables`, formData);
    }
    update(id: string | number, data: any): Observable<any> {
        return this.http.put(`${this.apiUrl}/tables/${id}`, data);
    }
    delete(id: string | number): Observable<any> {
        return this.http.delete(`${this.apiUrl}/tables/${id}`);
    }
}
