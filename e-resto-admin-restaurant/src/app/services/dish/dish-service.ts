import { Injectable } from "@angular/core";
import {HttpClient} from "@angular/common/http";
import {map, Observable, timeout} from "rxjs";
import {DishDto} from "../../models/dish/DishDto";
import {DishInput} from "../../models/dish/DishInput";
import {CategoryInput} from "../../models/category/CategoryInput";
import {CategoryDto} from "../../models/category/CategoryDto";
import { API_ROOT } from "../api-url";

@Injectable({
  providedIn: "root",
})
export class DishService {
    private apiUrl = API_ROOT;

    constructor(private http: HttpClient) {
    }

    list(): Observable<DishDto[]> {
        return this.http.get<any>(`${this.apiUrl}/plats/list`).pipe(
            map(response => response.data)
        );
    }
    create(formData: FormData): Observable<any> {
        return this.http.post(`${this.apiUrl}/plats/create`, formData);
    }


    delete(id: string): Observable<any> {
        return this.http.delete(`${this.apiUrl}/plats/${id}`);
    }


    // update(id: string, data: CategoryInput): Observable<any> {
    //     return this.http.put(`${this.apiUrl}/category/${id}`, data);
    // }
    //
    show(id: string): Observable<DishDto> {
        return this.http.get<any>(`${this.apiUrl}/plats/${id}`).pipe(
            timeout(15000),
            map(response => response.data ? response.data : response)
        );
    }

    update(id: string, formData: FormData): Observable<any> {
        formData.append("_method", "PUT");
        return this.http.post(`${this.apiUrl}/plats/${id}`, formData).pipe(
            timeout(15000)
        );
    }

}
