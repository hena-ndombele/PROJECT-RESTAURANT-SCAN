import { Component, inject, OnInit, signal, computed } from "@angular/core";
import { RouterLink } from "@angular/router";
import { DishService } from "../../../services/dish/dish-service";
import { DishDto } from "../../../models/dish/DishDto";
import { DecimalPipe } from "@angular/common";
import { DeleteDish } from "../delete-dish/delete-dish";

@Component({
    selector: "app-list-dish",
    standalone: true,
    imports: [RouterLink, DecimalPipe, DeleteDish],
    templateUrl: "./list-dish.html",
    styleUrl: "./list-dish.scss"
})
export class ListDish implements OnInit {
    private dishService = inject(DishService);

    // État des données
    allDishes = signal<DishDto[]>([]);
    searchTerm = signal<string>('');
    currentPage = signal<number>(1);
    pageSize = 8; // Changez à 4 pour voir la pagination plus vite si vous avez peu de données
    totalCount = computed(() => this.allDishes().length);

    // Filtrage par recherche
    filteredDishes = computed(() => {
        const term = this.searchTerm().toLowerCase().trim();
        if (!term) return this.allDishes();

        return this.allDishes().filter(dish =>
            dish.name.toLowerCase().includes(term) ||
            dish.description?.toLowerCase().includes(term)
        );
    });

    // Calcul du nombre total de pages
    totalPages = computed(() => Math.ceil(this.filteredDishes().length / this.pageSize));

    // Génération du tableau de pages pour le @for du HTML
    get pagesArray(): number[] {
        const total = this.totalPages();
        return Array.from({ length: total }, (_, i) => i + 1);
    }

    // Plats à afficher sur la page actuelle
    paginatedDishes = computed(() => {
        const startIndex = (this.currentPage() - 1) * this.pageSize;
        return this.filteredDishes().slice(startIndex, startIndex + this.pageSize);
    });

    ngOnInit(): void {
        this.loadDish();
    }
    isLoading = signal<boolean>(false);

    loadDish(): void {
        this.isLoading.set(true); // Début du chargement
        this.dishService.list().subscribe({
            next: (response: any) => {
                console.log("response/****", response);
                const data = response.data ? response.data : response;
                this.allDishes.set(data);
                this.isLoading.set(false); // Fin du chargement
            },
            error: (err) => {
                console.error("Erreur", err);
                this.isLoading.set(false); // Fin même si erreur
            }
        });
    }
    // loadDish(): void {
    //     this.dishService.list().subscribe({
    //         next: (response: any) => {
    //             const data = response.data ? response.data : response;
    //             this.allDishes.set(data);
    //         },
    //         error: (err) => console.error("Erreur lors du chargement", err)
    //     });
    // }

    onSearch(event: Event): void {
        const value = (event.target as HTMLInputElement).value;
        this.searchTerm.set(value);
        this.currentPage.set(1); // Reset à la page 1 quand on cherche
    }

    goToPage(page: number): void {
        if (page >= 1 && page <= this.totalPages()) {
            this.currentPage.set(page);
        }
    }
}