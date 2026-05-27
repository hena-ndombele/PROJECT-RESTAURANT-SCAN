import {Component, computed, inject, OnInit, signal} from "@angular/core";
import {AuthService} from "../../../services/auth/auth-service";
import {AccountRequestDto} from "../../../models/users/AccountRequestDto";
import {DatePipe} from "@angular/common";
import {AccountRequestDelete} from "../account-request-delete/account-request-delete";


@Component({
  selector: "app-account-request-list",
    imports: [
        DatePipe,
        AccountRequestDelete,
    ],
  templateUrl: "./account-request-list.html",
  styleUrl: "./account-request-list.scss",
    standalone:true
})
export class AccountRequestList implements OnInit {
    private authService = inject(AuthService);
    isLoading = signal<boolean>(true);

    // Signaux d'état
    accountRequest = signal<AccountRequestDto[]>([]);
    searchTerm = signal<string>('');
    currentPage = signal<number>(1);
    pageSize = 10;

    // Calcul automatique de la liste filtrée et paginée
    filteredAccountRequest = computed(() => {
        const term = this.searchTerm().toLowerCase();
        const allData = this.accountRequest();

        // 1. Filtrage dynamique
        const filtered = allData.filter(accountRequest =>
            accountRequest.username.toLowerCase().includes(term) ||
            (accountRequest.phone && accountRequest.message.includes(term))
        );

        // 2. Pagination
        const startIndex = (this.currentPage() - 1) * this.pageSize;
        return filtered.slice(startIndex, startIndex + this.pageSize);
    });

    // Calcul du nombre total de pages pour l'affichage
    totalPages = computed(() => {
        const term = this.searchTerm().toLowerCase();
        const filteredCount = this.accountRequest().filter(accountRequest =>
            accountRequest.username.toLowerCase().includes(term) ||
            (accountRequest.phone && accountRequest.message.includes(term))
        ).length;
        return Math.ceil(filteredCount / this.pageSize);
    });

    ngOnInit(): void {
        this.loadCategories();
    }

    pagesArray = computed(() => {
        const total = this.totalPages();
        return Array.from({ length: total }, (_, i) => i + 1);
    });

    loadCategories(): void {
        this.isLoading.set(true);
        this.authService.listAccountRequest().subscribe({
            next: (data) => {
                console.log(data);

                this.accountRequest.set(data);
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
