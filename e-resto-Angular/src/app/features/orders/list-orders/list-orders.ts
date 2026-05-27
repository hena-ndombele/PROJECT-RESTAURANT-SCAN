import { CommonModule, DatePipe } from "@angular/common";
import { Component, OnInit, computed, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Order } from "../../../models/orders/OrderDto";
import { OderService } from "../../../services/orders/oder-service";
import {DeleteOrder} from "../delete-order/delete-order";

@Component({
    selector: "app-list-orders",
    standalone: true,
    imports: [
        FormsModule,
        CommonModule,
        DatePipe,
        DeleteOrder
    ],
    templateUrl: "./list-orders.html",
    styleUrl: "./list-orders.scss"
})
export class ListOrders implements OnInit {
    orders = signal<Order[]>([]);
    loading = signal<boolean>(false);
    errorMessage = signal<string>("");
    successMessage = signal<string>("");
    updatingOrderId = signal<string | null>(null);

    readonly statusOptions: { value: Order["status"]; label: string }[] = [
        { value: "pending", label: "Reçue" },
        { value: "preparing", label: "En préparation" },
        { value: "ready", label: "Prête" },
        { value: "delivered", label: "Servie" },
        { value: "paid", label: "Payée" },
        { value: "cancelled", label: "Annulée" }
    ];

    currentPage = signal<number>(1);
    pageSize = 10;

    searchTerm = signal<string>("");

    filters = {
        day: "",
        month: "",
        year: ""
    };

    filteredOrders = computed(() => {
        const term = this.searchTerm().toLowerCase().trim();
        const allOrders = this.orders();

        if (!term) return allOrders;

        return allOrders.filter((order) => {
            const tableName = order.table?.name ?? "";
            const status = order.status ?? "";
            const total = String(order.total_amount ?? "");
            const currency = order.currency ?? "";

            return order.id.toLowerCase().includes(term)
                || tableName.toLowerCase().includes(term)
                || status.toLowerCase().includes(term)
                || total.includes(term)
                || currency.toLowerCase().includes(term);
        });
    });

    totalPages = computed(() => {
        return Math.max(1, Math.ceil(this.filteredOrders().length / this.pageSize));
    });

    paginatedOrders = computed(() => {
        const startIndex = (this.currentPage() - 1) * this.pageSize;
        return this.filteredOrders().slice(startIndex, startIndex + this.pageSize);
    });

    pagesArray = computed(() => {
        return Array.from({ length: this.totalPages() }, (_, index) => index + 1);
    });

    constructor(private orderService: OderService) {}

    ngOnInit(): void {
        this.loadOrders();
    }

    loadOrders(): void {
        this.loading.set(true);
        this.errorMessage.set("");
        this.successMessage.set("");

        const activeFilters: { day?: string; month?: string; year?: string } = {};
        if (this.filters.day) activeFilters.day = this.filters.day;
        if (this.filters.month) activeFilters.month = this.filters.month;
        if (this.filters.year) activeFilters.year = this.filters.year;

        this.orderService.list(activeFilters).subscribe({
            next: (data) => {
                console.log("Orders received:", data);
                this.orders.set(data);
                this.currentPage.set(1);
                this.loading.set(false);
            },
            error: (err) => {
                console.error("Erreur lors du chargement", err);
                this.orders.set([]);
                this.errorMessage.set("Impossible de charger les commandes.");
                this.loading.set(false);
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

    resetFilters(): void {
        this.filters = { day: "", month: "", year: "" };
        this.searchTerm.set("");
        this.currentPage.set(1);
        this.loadOrders();
    }

    updateOrderStatus(order: Order, status: Order["status"]): void {
        if (!order.id || order.status === status || this.updatingOrderId() === order.id) return;

        const previousStatus = order.status;
        this.updatingOrderId.set(order.id);
        this.errorMessage.set("");
        this.successMessage.set("");

        this.orders.update((orders) =>
            orders.map((item) => item.id === order.id ? { ...item, status } : item)
        );

        this.orderService.updateStatus(order.id, status).subscribe({
            next: (updatedOrder) => {
                this.orders.update((orders) =>
                    orders.map((item) => item.id === order.id ? { ...item, ...updatedOrder } : item)
                );
                this.successMessage.set("Statut de la commande mis à jour et envoyé au client.");
                this.updatingOrderId.set(null);
            },
            error: (err) => {
                console.error("Erreur lors de la mise à jour du statut", err);
                this.orders.update((orders) =>
                    orders.map((item) => item.id === order.id ? { ...item, status: previousStatus } : item)
                );
                this.errorMessage.set("Impossible de mettre à jour le statut de la commande.");
                this.updatingOrderId.set(null);
            }
        });
    }

    statusBadgeClass(status: Order["status"]): string {
        switch (status) {
            case "pending":
                return "bg-warning text-dark";
            case "preparing":
                return "bg-primary";
            case "ready":
                return "bg-success";
            case "delivered":
                return "bg-info text-dark";
            case "paid":
                return "bg-secondary";
            case "cancelled":
                return "bg-danger";
            default:
                return "bg-light text-dark";
        }
    }
}
