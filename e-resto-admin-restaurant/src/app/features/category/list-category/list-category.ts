import { Component, OnInit, inject, signal, computed } from "@angular/core";
import { CreateCategory } from "../create-category/create-category";
import { CommonModule } from "@angular/common";
import { CategoryService } from "../../../services/category/category-service";
import { CategoryDto } from "../../../models/category/CategoryDto";
import { DeleteCategory } from "../delete-category/delete-category";
import { UpdateCategory } from "../update-category/update-category";
import { STORAGE_ROOT } from "../../../services/api-url";
import { AppPermissionService } from "../../../services/auth/permission-service";

@Component({
  selector: "app-list-category",
  standalone: true,
  imports: [CreateCategory, CommonModule, DeleteCategory, UpdateCategory],
  templateUrl: "./list-category.html",
  styleUrl: "./list-category.scss",
})
export class ListCategory implements OnInit {
  readonly restaurantName = JSON.parse(localStorage.getItem("restaurant_session") || "null")?.name || "Restaurant Scan";
  private categoryService = inject(CategoryService);
  private permissions = inject(AppPermissionService);
  readonly storageRoot = STORAGE_ROOT;
  isLoading = signal<boolean>(true);

  // Signaux d'état
  categories = signal<CategoryDto[]>([]);
  searchTerm = signal<string>('');
  currentPage = signal<number>(1);
  pageSize = 10;

    totalCategoryCount = computed(() => this.categories().length);


  // Calcul automatique de la liste filtrée et paginée
  filteredCategories = computed(() => {
    const term = this.searchTerm().toLowerCase();
    const allData = this.categories();

    // 1. Filtrage dynamique
    const filtered = allData.filter(cat =>
        cat.name.toLowerCase().includes(term) ||
        (cat.description && cat.description.toLowerCase().includes(term))
    );

    // 2. Pagination
    const startIndex = (this.currentPage() - 1) * this.pageSize;
    return filtered.slice(startIndex, startIndex + this.pageSize);
  });

  // Calcul du nombre total de pages pour l'affichage
  totalPages = computed(() => {
    const term = this.searchTerm().toLowerCase();
    const filteredCount = this.categories().filter(cat =>
        cat.name.toLowerCase().includes(term) ||
        (cat.description && cat.description.toLowerCase().includes(term))
    ).length;
    return Math.ceil(filteredCount / this.pageSize);
  });

  ngOnInit(): void {
    this.loadCategories();
  }

  canAccess(permission: string): boolean {
    return this.permissions.has(permission);
  }

  pagesArray = computed(() => {
    const total = this.totalPages();
    return Array.from({ length: total }, (_, i) => i + 1);
  });

  loadCategories(): void {
    this.isLoading.set(true);
    this.categoryService.list().subscribe({
      next: (data) => {
        this.categories.set(data);
        this.isLoading.set(false);
        this.currentPage.set(1); // Reset à la page 1 au chargement
      }
    });
  }

  // Action de recherche
  onSearch(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchTerm.set(input.value);
    this.currentPage.set(1); // Toujours revenir à la page 1 quand on filtre
  }

  // Navigation entre les pages
  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
    }
  }
}
