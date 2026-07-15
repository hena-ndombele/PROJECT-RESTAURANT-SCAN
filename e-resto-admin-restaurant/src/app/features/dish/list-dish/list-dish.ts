import { Component, inject, OnInit, signal, computed } from "@angular/core";
import { RouterLink } from "@angular/router";
import { DishService } from "../../../services/dish/dish-service";
import { DishDto } from "../../../models/dish/DishDto";
import { DecimalPipe } from "@angular/common";
import { DeleteDish } from "../delete-dish/delete-dish";
import { STORAGE_ROOT } from "../../../services/api-url";
import { FormsModule } from "@angular/forms";
import { CategoryService } from "../../../services/category/category-service";
import { CategoryDto } from "../../../models/category/CategoryDto";
import { AppPermissionService } from "../../../services/auth/permission-service";
import { SaasService } from "../../../services/saas/saas-service";
import { RestaurantPlanUsage } from "../../../models/saas/saas.models";

@Component({
    selector: "app-list-dish",
    standalone: true,
    imports: [RouterLink, DecimalPipe, DeleteDish, FormsModule],
    templateUrl: "./list-dish.html",
    styleUrl: "./list-dish.scss"
})
export class ListDish implements OnInit {
    private dishService = inject(DishService);
    private categoryService = inject(CategoryService);
    private permissions = inject(AppPermissionService);
    private saasService = inject(SaasService);
    readonly storageRoot = STORAGE_ROOT;

    // État des données
    allDishes = signal<DishDto[]>([]);
    categories = signal<CategoryDto[]>([]);
    planUsage = signal<RestaurantPlanUsage | null>(null);
    searchTerm = signal<string>('');
    categoryFilter = signal<string>('all');
    currentPage = signal<number>(1);
    pageSize = 8; // Changez à 4 pour voir la pagination plus vite si vous avez peu de données
    totalCount = computed(() => this.allDishes().length);
    dishLimitReached = computed(() => this.planUsage()?.permissions?.can_create_dish === false);
    dishLimitMessage = computed(() => this.planUsage()?.messages?.dishes || "Votre plan ne permet pas de créer plus de plats.");

    // Filtrage par recherche
    filteredDishes = computed(() => {
        const term = this.searchTerm().toLowerCase().trim();
        const selectedCategory = this.categoryFilter();
        const categoryFiltered = selectedCategory === 'all'
            ? this.allDishes()
            : this.allDishes().filter((dish) => String(dish.category_id) === selectedCategory || String(dish.category?.id) === selectedCategory);

        if (!term) return categoryFiltered;

        return categoryFiltered.filter(dish =>
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
        this.loadCategories();
        this.loadDish();
        this.loadPlanUsage();
    }

    canAccess(permission: string): boolean {
        return this.permissions.has(permission);
    }
    isLoading = signal<boolean>(false);

    loadDish(): void {
        this.isLoading.set(true); // Début du chargement
        this.dishService.list().subscribe({
            next: (response: any) => {
                const data = response.data ? response.data : response;
                this.allDishes.set(data);
                this.isLoading.set(false); // Fin du chargement
            },
            error: (err) => {
                this.isLoading.set(false); // Fin même si erreur
            }
        });
    }

    onSearch(event: Event): void {
        const value = (event.target as HTMLInputElement).value;
        this.searchTerm.set(value);
        this.currentPage.set(1); // Reset à la page 1 quand on cherche
    }

    onCategoryChange(categoryId: string): void {
        this.categoryFilter.set(categoryId);
        this.currentPage.set(1);
    }

    loadCategories(): void {
        this.categoryService.list().subscribe({
            next: (categories) => this.categories.set(categories),
            error: () => this.categories.set([])
        });
    }

    loadPlanUsage(): void {
        this.saasService.restaurantUsage().subscribe({
            next: (usage) => this.planUsage.set(usage),
            error: () => this.planUsage.set(null),
        });
    }

    exportExcel(): void {
        const rows = this.filteredDishes();
        const body = rows.map((dish) => `
            <tr>
                <td>${this.escapeHtml(dish.name)}</td>
                <td>${this.escapeHtml(dish.category?.name || '')}</td>
                <td>${this.escapeHtml(dish.description || '')}</td>
                <td>${dish.price}</td>
                <td>${dish.currency}</td>
                <td>${dish.is_available ? 'Disponible' : 'Indisponible'}</td>
                <td>${dish.preparation_time || ''}</td>
            </tr>
        `).join('');

        const html = `
            <html>
            <head><meta charset="UTF-8"></head>
            <body>
                <table>
                    <thead>
                        <tr>
                            <th>Plat</th><th>Categorie</th><th>Description</th><th>Prix</th><th>Devise</th><th>Statut</th><th>Preparation</th>
                        </tr>
                    </thead>
                    <tbody>${body}</tbody>
                </table>
            </body>
            </html>
        `;

        const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = this.exportFilename();
        link.click();
        URL.revokeObjectURL(url);
    }

    private exportFilename(): string {
        const now = new Date();
        const date = now.toISOString().slice(0, 10);
        const time = now.toTimeString().slice(0, 5).replace(':', '-');

        return `export-plats-${date}-${time}.xls`;
    }

    private escapeHtml(value: string): string {
        const div = document.createElement('div');
        div.innerText = value;
        return div.innerHTML;
    }

    goToPage(page: number): void {
        if (page >= 1 && page <= this.totalPages()) {
            this.currentPage.set(page);
        }
    }
}
