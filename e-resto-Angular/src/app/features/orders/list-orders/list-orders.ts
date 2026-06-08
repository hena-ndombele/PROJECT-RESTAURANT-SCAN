import { CommonModule, DatePipe } from "@angular/common";
import { Component, OnDestroy, OnInit, computed, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Subscription } from "rxjs";
import { Order } from "../../../models/orders/OrderDto";
import { OderService } from "../../../services/orders/oder-service";
import { OrderRealtimeService } from "../../../services/realtime/order-realtime-service";
import { SaasService } from "../../../services/saas/saas-service";
import { RestaurantPlanUsage } from "../../../models/saas/saas.models";
import { TableService } from "../../../services/table/table-service";
import { TableDto } from "../../../models/table/TableDto";

@Component({
    selector: "app-list-orders",
    standalone: true,
    imports: [
        FormsModule,
        CommonModule,
        DatePipe
    ],
    templateUrl: "./list-orders.html",
    styleUrl: "./list-orders.scss"
})
export class ListOrders implements OnInit, OnDestroy {
    private readonly realtime = inject(OrderRealtimeService);
    private realtimeSubscription?: Subscription;

    orders = signal<Order[]>([]);
    loading = signal<boolean>(false);
    errorMessage = signal<string>("");
    successMessage = signal<string>("");
    updatingOrderId = signal<string | null>(null);
    updatingPaymentId = signal<string | null>(null);
    selectedOrder = signal<Order | null>(null);
    newOrderModal = signal<Order | null>(null);
    billRequestModal = signal<Order | null>(null);
    cashOrder = signal<Order | null>(null);
    cashReceivedAmount = signal<number | null>(null);
    planUsage = signal<RestaurantPlanUsage | null>(null);
    tables = signal<TableDto[]>([]);

    readonly statusOptions: { value: Order["status"]; label: string }[] = [
        { value: "pending", label: "Recue" },
        { value: "preparing", label: "En preparation" },
        { value: "ready", label: "Prete" },
        { value: "delivered", label: "Servie" },
        { value: "cancelled", label: "Annulee" }
    ];

    readonly statusTabs = computed(() => {
        const orders = this.orders();
        const tabs: Array<{ value: Order["status"] | "all" | "online"; label: string; icon: string; count: number }> = [
            { value: "all", label: "Toutes", icon: "bi-grid", count: orders.length },
            { value: "online", label: "En ligne", icon: "bi-whatsapp", count: orders.filter((order) => order.order_type === "remote").length },
            { value: "pending", label: "Nouvelles", icon: "bi-bell", count: orders.filter((order) => order.status === "pending").length },
            { value: "preparing", label: "En preparation", icon: "bi-hourglass-split", count: orders.filter((order) => order.status === "preparing").length },
            { value: "ready", label: "Pretes", icon: "bi-check-square", count: orders.filter((order) => order.status === "ready").length },
            { value: "delivered", label: "Servies", icon: "bi-bag-check", count: orders.filter((order) => order.status === "delivered").length },
            { value: "cancelled", label: "Annulees", icon: "bi-x-lg", count: orders.filter((order) => order.status === "cancelled").length }
        ];

        return tabs;
    });

    currentPage = signal<number>(1);
    pageSize = 10;

    searchTerm = signal<string>("");
    statusFilter = signal<Order["status"] | "all" | "online">("all");
    tableFilter = signal<string>("all");

    filters = {
        day: "",
        month: "",
        year: ""
    };

    filteredOrders = computed(() => {
        const term = this.searchTerm().toLowerCase().trim();
        const selectedStatus = this.statusFilter();
        const selectedTable = this.tableFilter();
        const allOrders = this.orders();

        const statusFiltered = selectedStatus === "all"
            ? allOrders
            : selectedStatus === "online"
                ? allOrders.filter((order) => order.order_type === "remote")
            : allOrders.filter((order) => order.status === selectedStatus);

        const tableFiltered = selectedTable === "all"
            ? statusFiltered
            : statusFiltered.filter((order) => order.table_id === selectedTable || order.table?.id === selectedTable);

        if (!term) return tableFiltered;

        return tableFiltered.filter((order) => {
            const tableName = order.table?.name ?? "";
            const status = order.status ?? "";
            const paymentStatus = order.payment_status ?? "";
            const paymentMethod = order.payment_method ?? "";
            const total = String(order.total_amount ?? "");
            const currency = order.currency ?? "";
            const customer = `${order.customer_name ?? ""} ${order.customer_phone ?? ""} ${order.customer_email ?? ""}`;

            return order.id.toLowerCase().includes(term)
                || tableName.toLowerCase().includes(term)
                || customer.toLowerCase().includes(term)
                || status.toLowerCase().includes(term)
                || paymentStatus.toLowerCase().includes(term)
                || paymentMethod.toLowerCase().includes(term)
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

    revenueByCurrency = computed(() => this.groupRevenueByCurrency(this.filteredOrders()));
    activeCount = computed(() => this.orders().filter((order) => !["delivered", "cancelled"].includes(order.status)).length);
    canGeneratePdf = computed(() => {
        const plan = this.planUsage()?.plan;
        const slug = String(plan?.slug || "").toLowerCase();
        const features = (plan?.features || []).join(" ").toLowerCase();
        return ["pro", "enterprise"].includes(slug) || features.includes("rapport") || features.includes("report");
    });
    reportLimitMessage = computed(() => {
        const planName = this.planUsage()?.plan?.name || "votre plan";
        return `La generation PDF est reservee aux plans Pro et Enterprise. Plan actuel : ${planName}.`;
    });

    constructor(
        private orderService: OderService,
        private saasService: SaasService,
        private tableService: TableService
    ) {}

    ngOnInit(): void {
        this.realtime.start();
        this.realtimeSubscription = this.realtime.orderChanged$.subscribe((order) => this.upsertRealtimeOrder(order));
        this.loadPlanUsage();
        this.loadTables();
        this.loadOrders();
    }

    ngOnDestroy(): void {
        this.realtimeSubscription?.unsubscribe();
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
                this.orders.set(data);
                this.realtime.orders.set(data);
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

    loadPlanUsage(): void {
        this.saasService.restaurantUsage().subscribe({
            next: (usage) => this.planUsage.set(usage),
            error: () => this.planUsage.set(null)
        });
    }

    loadTables(): void {
        this.tableService.list().subscribe({
            next: (tables) => this.tables.set(tables),
            error: () => this.tables.set([])
        });
    }

    private upsertRealtimeOrder(order: Order): void {
        this.orders.update((orders) => {
            const previous = orders.find((item) => item.id === order.id);
            const exists = Boolean(previous);
            if (!exists) {
                this.newOrderModal.set(order);
            } else if (!this.billRequested(previous!) && this.billRequested(order)) {
                this.billRequestModal.set(order);
                this.successMessage.set(`Addition demandee par ${order.table?.name || "une table"}.`);
                this.playBillRequestSound();
            }
            return exists
                ? orders.map((item) => item.id === order.id ? { ...item, ...order } : item)
                : [order, ...orders];
        });
    }

    goToPage(page: number): void {
        if (page >= 1 && page <= this.totalPages()) {
            this.currentPage.set(page);
        }
    }

    resetFilters(): void {
        this.filters = { day: "", month: "", year: "" };
        this.searchTerm.set("");
        this.statusFilter.set("all");
        this.tableFilter.set("all");
        this.currentPage.set(1);
        this.loadOrders();
    }

    updateOrderStatus(order: Order, status: Order["status"]): void {
        if (!order.id || order.status === status || this.updatingOrderId() === order.id) return;
        if (this.isStatusDisabled(order, status)) {
            this.errorMessage.set("Impossible de revenir en arriere dans le statut de la commande.");
            return;
        }

        let cancellationReason: string | undefined;
        if (status === "cancelled") {
            if (order.status === "delivered") {
                this.errorMessage.set("Une commande deja servie ne peut plus etre annulee. Utilisez un remboursement.");
                return;
            }

            const reason = window.prompt("Pourquoi annuler cette commande ?");
            if (!reason || reason.trim().length < 3) {
                this.errorMessage.set("La raison d'annulation est obligatoire.");
                return;
            }
            cancellationReason = reason.trim();
        }

        const previousStatus = order.status;
        this.updatingOrderId.set(order.id);
        this.errorMessage.set("");
        this.successMessage.set("");

        this.orders.update((orders) =>
            orders.map((item) => item.id === order.id ? { ...item, status } : item)
        );

        this.orderService.updateStatus(order.id, status, cancellationReason).subscribe({
            next: (updatedOrder) => {
                this.orders.update((orders) =>
                    orders.map((item) => item.id === order.id ? { ...item, ...updatedOrder } : item)
                );
                this.successMessage.set(status === "cancelled"
                    ? "Commande annulee, table liberee et paiement ajuste."
                    : "Statut de la commande mis a jour et envoye au client.");
                this.updatingOrderId.set(null);
            },
            error: (err) => {
                console.error("Erreur lors de la mise a jour du statut", err);
                this.orders.update((orders) =>
                    orders.map((item) => item.id === order.id ? { ...item, status: previousStatus } : item)
                );
                this.errorMessage.set(err?.error?.message || "Impossible de mettre a jour le statut de la commande.");
                this.updatingOrderId.set(null);
            }
        });
    }

    openCashModal(order: Order): void {
        this.cashOrder.set(order);
        this.cashReceivedAmount.set(this.orderTotal(order));
        this.errorMessage.set("");
        this.successMessage.set("");
    }

    closeCashModal(): void {
        this.cashOrder.set(null);
        this.cashReceivedAmount.set(null);
    }

    cashChangeAmount(): number {
        const order = this.cashOrder();
        if (!order) return 0;
        return Math.max(0, Number(this.cashReceivedAmount() || 0) - this.orderTotal(order));
    }

    cashAmountIsEnough(): boolean {
        const order = this.cashOrder();
        if (!order) return false;
        return Number(this.cashReceivedAmount() || 0) >= this.orderTotal(order);
    }

    confirmCashPayment(): void {
        const order = this.cashOrder();
        if (!order?.id || this.updatingPaymentId() === order.id || !this.cashAmountIsEnough()) return;

        this.updatingPaymentId.set(order.id);
        this.errorMessage.set("");
        this.successMessage.set("");

        this.orderService.updatePaymentStatus(order.id, {
            payment_status: "paid",
            method: "cash",
            received_amount: Number(this.cashReceivedAmount() || 0)
        }).subscribe({
            next: (updatedOrder) => {
                this.orders.update((orders) =>
                    orders.map((item) => item.id === order.id ? { ...item, ...updatedOrder } : item)
                );
                this.successMessage.set("Paiement cash confirme et comptabilise.");
                this.updatingPaymentId.set(null);
                this.cashOrder.set(updatedOrder);
                setTimeout(() => this.printCashReceipt(updatedOrder), 100);
            },
            error: (err) => {
                console.error("Erreur lors de l'encaissement", err);
                this.errorMessage.set("Impossible de confirmer le paiement cash.");
                this.updatingPaymentId.set(null);
            }
        });
    }

    printCashReceipt(order: Order): void {
        const payment = order.latest_payment;
        const metadata = payment?.metadata || {};
        const received = Number(metadata.received_amount ?? this.cashReceivedAmount() ?? order.total_amount ?? 0);
        const change = Number(metadata.change_amount ?? Math.max(0, received - this.orderTotal(order)));
        const rows = (order.items || []).map((item) => `
            <tr>
                <td>${item.plat?.name || "Plat"}</td>
                <td>${item.quantity}</td>
                <td>${this.formatCurrency(Number(item.price_at_order || 0), order.currency)}</td>
                <td>${this.formatCurrency(this.itemLineTotal(item), order.currency)}</td>
            </tr>
        `).join("");

        const receipt = window.open("", "_blank", "noopener,noreferrer,width=420,height=720");
        if (!receipt) {
            this.errorMessage.set("Impossible d'ouvrir le recu. Autorisez les popups du navigateur.");
            return;
        }

        receipt.document.write(`
            <html>
            <head>
                <title>Recu cash Restaura Scan</title>
                <style>
                    body { font-family: Arial, sans-serif; color: #111827; padding: 18px; }
                    h1 { text-align: center; margin: 0 0 4px; }
                    .muted { color: #6b7280; text-align: center; margin: 0 0 16px; }
                    table { width: 100%; border-collapse: collapse; margin: 16px 0; }
                    th, td { border-bottom: 1px solid #e5e7eb; padding: 8px 4px; font-size: 12px; text-align: left; }
                    .totals div { display: flex; justify-content: space-between; padding: 6px 0; }
                    .total { font-weight: 800; font-size: 18px; border-top: 2px solid #111827; margin-top: 8px; padding-top: 10px; }
                </style>
            </head>
            <body>
                <h1>Restaura Scan</h1>
                <p class="muted">Recu cash - ${new Date().toLocaleString("fr-FR")}</p>
                <p><strong>Table :</strong> ${order.table?.name || "Table inconnue"}</p>
                <p><strong>Commande :</strong> #${order.id.slice(0, 8).toUpperCase()}</p>
                <table>
                    <thead><tr><th>Plat</th><th>Qté</th><th>PU</th><th>Total</th></tr></thead>
                    <tbody>${rows}</tbody>
                </table>
                <div class="totals">
                    <div class="total"><span>Total</span><span>${this.formatCurrency(this.orderTotal(order), order.currency)}</span></div>
                    <div><span>Recu</span><span>${this.formatCurrency(received, order.currency)}</span></div>
                    <div><span>Monnaie</span><span>${this.formatCurrency(change, order.currency)}</span></div>
                    <div><span>Paiement</span><span>Cash</span></div>
                </div>
                <p class="muted">Merci pour votre visite.</p>
                <script>window.onload = function(){ window.print(); }</script>
            </body>
            </html>
        `);
        receipt.document.close();
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
            case "cancelled":
                return "bg-danger";
            default:
                return "bg-light text-dark";
        }
    }

    paymentBadgeClass(status: Order["payment_status"]): string {
        switch (status) {
            case "paid":
                return "bg-success";
            case "pending":
                return "bg-warning text-dark";
            case "failed":
                return "bg-danger";
            case "refunded":
                return "bg-info text-dark";
            case "unpaid":
            default:
                return "bg-secondary";
        }
    }

    paymentLabel(order: Order): string {
        const method = order.payment_method === "mobile_money"
            ? (order.payment_provider || "Mobile Money")
            : "Cash";
        const status = {
            unpaid: "non paye",
            pending: "en attente",
            paid: "paye",
            failed: "echoue",
            refunded: "rembourse"
        }[order.payment_status] || order.payment_status;

        return `${method} - ${status}`;
    }

    orderTypeLabel(order: Order): string {
        if (order.order_type === "remote") return "En ligne";
        return order.order_type === "takeaway" ? "A emporter" : "Sur place";
    }

    billRequested(order: Order): boolean {
        const payment = order.latest_payment || (order as any).latestPayment;
        return Boolean(payment?.metadata?.bill_requested);
    }

    billRequestedAt(order: Order): string | null {
        const payment = order.latest_payment || (order as any).latestPayment;
        return payment?.metadata?.bill_requested_at || null;
    }

    private playBillRequestSound(): void {
        try {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            if (!AudioContextClass) return;

            const context = new AudioContextClass();
            const now = context.currentTime;
            [740, 920, 740].forEach((frequency, index) => {
                const oscillator = context.createOscillator();
                const gain = context.createGain();
                oscillator.type = "triangle";
                oscillator.frequency.setValueAtTime(frequency, now + index * 0.11);
                gain.gain.setValueAtTime(0.001, now + index * 0.11);
                gain.gain.exponentialRampToValueAtTime(0.24, now + index * 0.11 + 0.02);
                gain.gain.exponentialRampToValueAtTime(0.001, now + index * 0.11 + 0.13);
                oscillator.connect(gain);
                gain.connect(context.destination);
                oscillator.start(now + index * 0.11);
                oscillator.stop(now + index * 0.11 + 0.15);
            });
        } catch {
            // Le navigateur peut bloquer l'audio sans interaction prealable.
        }
    }

    statusLabel(status: Order["status"]): string {
        return this.statusOptions.find((item) => item.value === status)?.label || status;
    }

    orderItemsCount(order: Order): number {
        return (order.items || []).reduce((total, item) => total + Number(item.quantity || 0), 0);
    }

    orderTotal(order: Order): number {
        return Number(order.total_amount || 0);
    }

    itemLineTotal(item: any): number {
        return Number(item.price_at_order || item.plat?.price || 0) * Number(item.quantity || 0);
    }

    formatCurrency(amount: number, currency = "USD"): string {
        return `${amount.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${currency}`;
    }

    viewOrder(order: Order): void {
        this.selectedOrder.set(order);
    }

    closeOrderModal(): void {
        this.selectedOrder.set(null);
    }

    openNewOrder(order: Order): void {
        this.selectedOrder.set(order);
        this.newOrderModal.set(null);
    }

    exportPdfReport(): void {
        if (!this.canGeneratePdf()) {
            this.errorMessage.set(this.reportLimitMessage());
            return;
        }

        const orders = this.filteredOrders();
        const totals = this.groupRevenueByCurrency(orders);
        const rows = orders.map((order) => `
            <tr>
                <td>${order.table?.name || "Table inconnue"}</td>
                <td>${this.statusLabel(order.status)}</td>
                <td>${this.paymentLabel(order)}</td>
                <td>${this.orderItemsCount(order)}</td>
                <td>${this.formatCurrency(this.orderTotal(order), order.currency)}</td>
                <td>${new Date(order.created_at).toLocaleString("fr-FR")}</td>
            </tr>
        `).join("");

        const totalRows = totals.map((item) => `<li>${this.formatCurrency(item.amount, item.currency)}</li>`).join("");
        const printWindow = window.open("", "_blank", "noopener,noreferrer");
        if (!printWindow) {
            this.errorMessage.set("Impossible d'ouvrir la fenetre PDF. Autorisez les popups du navigateur.");
            return;
        }

        printWindow.document.write(`
            <html>
            <head>
                <title>Rapport commandes Restaura Scan</title>
                <style>
                    body { font-family: Arial, sans-serif; color: #111827; padding: 28px; }
                    h1 { margin: 0 0 4px; }
                    p { color: #6b7280; margin-top: 0; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    th, td { border: 1px solid #d1d5db; padding: 8px; font-size: 12px; text-align: left; }
                    th { background: #f3f4f6; }
                    .summary { margin-top: 18px; padding: 12px; background: #f9fafb; border: 1px solid #e5e7eb; }
                </style>
            </head>
            <body>
                <h1>Rapport des commandes</h1>
                <p>Genere le ${new Date().toLocaleString("fr-FR")} - ${orders.length} commandes</p>
                <div class="summary"><strong>Revenus encaisses par devise</strong><ul>${totalRows || "<li>Aucun revenu paye</li>"}</ul></div>
                <table>
                    <thead><tr><th>Table</th><th>Commande</th><th>Paiement</th><th>Articles</th><th>Total</th><th>Date</th></tr></thead>
                    <tbody>${rows || "<tr><td colspan='6'>Aucune commande</td></tr>"}</tbody>
                </table>
                <script>window.onload = function(){ window.print(); }</script>
            </body>
            </html>
        `);
        printWindow.document.close();
    }

    isStatusDisabled(order: Order, nextStatus: Order["status"]): boolean {
        const orderRank: Record<Order["status"], number> = {
            pending: 0,
            preparing: 1,
            ready: 2,
            delivered: 3,
            cancelled: 99
        };

        if (order.status === "cancelled") return nextStatus !== "cancelled";
        if (order.status === "delivered") return nextStatus !== "delivered";
        if (nextStatus === "cancelled") return false;
        return orderRank[nextStatus] < orderRank[order.status];
    }

    private groupRevenueByCurrency(orders: Order[]): Array<{ currency: string; amount: number; count: number }> {
        const totals = new Map<string, { currency: string; amount: number; count: number }>();

        for (const order of orders.filter((item) => item.payment_status === "paid")) {
            const currency = order.currency || "USD";
            const current = totals.get(currency) || { currency, amount: 0, count: 0 };
            current.amount += Number(order.total_amount || 0);
            current.count += 1;
            totals.set(currency, current);
        }

        return Array.from(totals.values()).sort((a, b) => a.currency.localeCompare(b.currency));
    }
}
