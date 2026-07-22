import {Component, computed, inject, OnInit, signal} from "@angular/core";
import {TableService} from "../../../services/table/table-service";
import {TableDto} from "../../../models/table/TableDto";
import {DatePipe} from "@angular/common";
import {CreateTable} from "../create-table/create-table";
import {DeleteTable} from "../delete-table/delete-table";
import {ShowTable} from "../show-table/show-table";
import {UpdateTable} from "../update-table/update-table";
import {RouterLink} from "@angular/router";
import {SaasService} from "../../../services/saas/saas-service";
import {RestaurantPlanUsage} from "../../../models/saas/saas.models";
import {AppPermissionService} from "../../../services/auth/permission-service";


@Component({
    selector: "app-list-table",
    imports: [
        DatePipe,
        CreateTable,
        DeleteTable,
        ShowTable,
        UpdateTable,
        RouterLink,
    ],
    templateUrl: "./list-table.html",
    styleUrl: "./list-table.scss",
    standalone: true
})
export class ListTable implements OnInit {
    private tableService = inject(TableService);
    private saasService = inject(SaasService);
    private permissions = inject(AppPermissionService);
    isLoading = signal<boolean>(true);
    errorMessage = signal<string>("");

    // Signaux d'état
    tables = signal<TableDto[]>([]);
    planUsage = signal<RestaurantPlanUsage | null>(null);
    searchTerm = signal<string>('');
    currentPage = signal<number>(1);
    pageSize = 10;
    totalTableCount = computed(() => this.tables().length);
    tableLimitReached = computed(() => this.planUsage()?.permissions?.can_create_table === false);
    tableLimitMessage = computed(() => this.planUsage()?.messages?.tables ?? '');

    parseDate(dateStr: string): Date {
        const [datePart, timePart] = dateStr.split(' ');
        const [day, month, year] = datePart.split('/');
        return new Date(`${year}-${month}-${day}T${timePart}`);
    }
    // Calcul automatique de la liste filtrée et paginée
    // Calcul automatique de la liste filtrée et paginée
    filteredTable = computed(() => {
        const term = this.searchTerm().toLowerCase().trim(); // Ajout de trim() pour les espaces
        const allData = this.tables();

        // 1. Filtrage dynamique
        const filtered = allData.filter(table => {
            const nameMatch = String(table?.name || "").toLowerCase().includes(term);
            return nameMatch; // Retourne vrai si le nom correspond
        });

        // 2. Pagination
        const startIndex = (this.currentPage() - 1) * this.pageSize;
        return filtered.slice(startIndex, startIndex + this.pageSize);
    });

// Calcul du nombre total de pages (doit utiliser la même logique de filtre !)
    totalPages = computed(() => {
        const term = this.searchTerm().toLowerCase().trim();
        const filteredCount = this.tables().filter(table =>
            String(table?.name || "").toLowerCase().includes(term)
        ).length;

        return Math.ceil(filteredCount / this.pageSize);
    });
    // filteredTable = computed(() => {
    //     const term = this.searchTerm().toLowerCase();
    //     const allData = this.tables();
    //
    //     // 1. Filtrage dynamique
    //     const filtered = allData.filter(table =>
    //         table.name.includes(term) || (table.created_at)
    //     );
    //
    //     // 2. Pagination
    //     const startIndex = (this.currentPage() - 1) * this.pageSize;
    //     return filtered.slice(startIndex, startIndex + this.pageSize);
    // });
    //
    // // Calcul du nombre total de pages pour l'affichage
    // totalPages = computed(() => {
    //     const term = this.searchTerm().toLowerCase();
    //     const filteredCount = this.tables().filter(table =>
    //         table.name.includes(term) ||
    //         (table.created_at)
    //     ).length;
    //     return Math.ceil(filteredCount / this.pageSize);
    // });

    ngOnInit(): void {
        this.loadTables();
        this.loadPlanUsage();
    }

    canAccess(permission: string): boolean {
        return this.permissions.has(permission);
    }

    pagesArray = computed(() => {
        const total = this.totalPages();
        return Array.from({length: total}, (_, i) => i + 1);
    });

    loadTables(): void {
        this.isLoading.set(true);
        this.errorMessage.set("");
        this.tableService.list().subscribe({
            next: (response: any) => {
                const tables = this.resolveTablesResponse(response);
                this.tables.set(tables);

                this.isLoading.set(false);
                this.currentPage.set(1);
            },
            error: (err) => {
                this.tables.set([]);
                this.errorMessage.set(err?.error?.message || err?.message || "Impossible de charger les tables.");
                this.isLoading.set(false);
            }
        });
    }

    private resolveTablesResponse(response: any): TableDto[] {
        const tables = Array.isArray(response)
            ? response
            : Array.isArray(response?.data)
                ? response.data
                : Array.isArray(response?.tables)
                    ? response.tables
                    : [];

        return tables.filter((table: TableDto) => !['Commandes en ligne', 'Commandes hors restaurant'].includes(String(table?.name || '').trim()));
    }

    loadPlanUsage(): void {
        this.saasService.restaurantUsage().subscribe({
            next: (usage) => this.planUsage.set(usage),
            error: (err) => {
                this.planUsage.set(null);
            }
        });
    }


    onSearch(event: Event): void {
        const input = event.target as HTMLInputElement;
        this.searchTerm.set(input.value);
        this.currentPage.set(1);
    }

    goToPage(page: number): void {
        if (page >= 1 && page <= this.totalPages()) {
            this.currentPage.set(page);
        }
    }


}
