import { Injectable } from "@angular/core";
import {HttpClient} from "@angular/common/http";
import {Observable} from "rxjs";
import {CategoryDto} from "../../models/category/CategoryDto";
import {TableDto} from "../../models/table/TableDto";
import {CategoryInput} from "../../models/category/CategoryInput";
import { API_ROOT } from "../api-url";

@Injectable({
  providedIn: "root",
})
export class CategoryService {
  private apiUrl = API_ROOT;

  constructor(private http: HttpClient) {
  }

  list(): Observable<CategoryDto[]> {
    return this.http.get<CategoryDto[]>(`${this.apiUrl}/category/list`);
  }

  delete(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/category/${id}`);
  }

  create(formData: FormData): Observable<any> {
    return this.http.post(`${this.apiUrl}/category/create`, formData);
  }
    update(id: string, data: CategoryInput): Observable<any> {
        const formData = new FormData();

        // On remplit le FormData avec les valeurs de CategoryInput
        formData.append('name', data.name);
        formData.append('description', data.description);

        /**
         * CRUCIAL POUR LARAVEL :
         * PHP ne traite pas les fichiers avec la méthode PUT.
         * On envoie donc en POST mais on ajoute le champ '_method' pour que
         * Laravel comprenne qu'il s'agit d'une mise à jour (PUT).
         */
        formData.append('_method', 'PUT');

        // On n'ajoute l'image que si l'utilisateur en a sélectionné une nouvelle
        if (data.image) {
            formData.append('image', data.image);
        }

        // Notez l'utilisation de .post() au lieu de .put() ici
        return this.http.post(`${this.apiUrl}/category/${id}`, formData);
    }
  //
  // update(id: string, data: CategoryInput): Observable<any> {
  //   return this.http.put(`${this.apiUrl}/category/${id}`, data);
  // }

  show(id: string): Observable<CategoryDto> {
    return this.http.get<CategoryDto>(`${this.apiUrl}/category/${id}`);
  }
}
