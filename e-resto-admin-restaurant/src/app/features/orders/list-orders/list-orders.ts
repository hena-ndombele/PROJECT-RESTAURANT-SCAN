import { CommonModule, DatePipe } from "@angular/common";
import { Component, OnDestroy, OnInit, computed, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute } from "@angular/router";
import { Subscription } from "rxjs";
import { Order } from "../../../models/orders/OrderDto";
import { OderService } from "../../../services/orders/oder-service";
import { OrderRealtimeService } from "../../../services/realtime/order-realtime-service";
import { SaasService } from "../../../services/saas/saas-service";
import { RestaurantPlanUsage } from "../../../models/saas/saas.models";
import { TableService } from "../../../services/table/table-service";
import { TableDto } from "../../../models/table/TableDto";
import { AppPermissionService } from "../../../services/auth/permission-service";
import { STORAGE_ROOT } from "../../../services/api-url";

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
    readonly restaurantName = JSON.parse(localStorage.getItem("restaurant_session") || "null")?.name || "Restaurant Scan";
    private readonly realtime = inject(OrderRealtimeService);
    private readonly permissions = inject(AppPermissionService);
    private readonly route = inject(ActivatedRoute);
    private realtimeSubscription?: Subscription;
    private menuUpdatedSubscription?: Subscription;
    private routeSubscription?: Subscription;

    orders = signal<Order[]>([]);
    loading = signal<boolean>(false);
    errorMessage = signal<string>("");
    successMessage = signal<string>("");
    updatingOrderId = signal<string | null>(null);
    updatingPaymentId = signal<string | null>(null);
    selectedOrder = signal<Order | null>(null);
    newOrderModals = signal<Order[]>([]);
    billRequestModal = signal<Order | null>(null);
    cashOrder = signal<Order | null>(null);
    cashReceivedAmount = signal<number | null>(null);
    planUsage = signal<RestaurantPlanUsage | null>(null);
    tables = signal<TableDto[]>([]);

    readonly statusOptions: { value: Order["status"]; label: string }[] = [
        { value: "pending", label: "Reçue" },
        { value: "preparing", label: "En préparation" },
        { value: "ready", label: "Prête" },
        { value: "delivered", label: "Servie" },
        { value: "cancelled", label: "Annulée" }
    ];

    readonly statusTabs = computed(() => {
        const orders = this.orders();
        const tabs: Array<{ value: Order["status"] | "all" | "online"; label: string; icon: string; count: number }> = [
            { value: "all", label: "Toutes", icon: "bi-grid", count: orders.length },
            { value: "online", label: "En ligne", icon: "bi-whatsapp", count: orders.filter((order) => order.order_type === "remote").length },
            { value: "pending", label: "Nouvelles", icon: "bi-bell", count: orders.filter((order) => order.status === "pending").length },
            { value: "preparing", label: "En préparation", icon: "bi-hourglass-split", count: orders.filter((order) => order.status === "preparing").length },
            { value: "ready", label: "Prêtes", icon: "bi-check-square", count: orders.filter((order) => order.status === "ready").length },
            { value: "delivered", label: "Servies", icon: "bi-bag-check", count: orders.filter((order) => order.status === "delivered").length },
            { value: "cancelled", label: "Annulées", icon: "bi-x-lg", count: orders.filter((order) => order.status === "cancelled").length }
        ];

        return tabs;
    });

    currentPage = signal<number>(1);
    pageSize = 10;

    searchTerm = signal<string>("");
    statusFilter = signal<Order["status"] | "all" | "online">("pending");
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
        return ["pro", "business"].includes(slug) || features.includes("rapport") || features.includes("report");
    });
    reportLimitMessage = computed(() => {
        const planName = this.planUsage()?.plan?.name || "votre plan";
        return `La génération PDF est réservée aux plans Pro et Business. Plan actuel : ${planName}.`;
    });

    constructor(
        private orderService: OderService,
        private saasService: SaasService,
        private tableService: TableService
    ) {}

    ngOnInit(): void {
        this.realtime.start();
        this.realtimeSubscription = this.realtime.orderChanged$.subscribe((order) => this.upsertRealtimeOrder(order));
        this.menuUpdatedSubscription = this.realtime.menuUpdated$.subscribe(() => this.refreshSelectedOrder());
        this.routeSubscription = this.route.queryParamMap.subscribe((params) => {
            const status = params.get("status");
            if (this.isStatusFilter(status)) {
                this.statusFilter.set(status);
                this.currentPage.set(1);
            }
        });
        this.loadPlanUsage();
        this.loadTables();
        this.loadOrders();
    }

    ngOnDestroy(): void {
        this.realtimeSubscription?.unsubscribe();
        this.menuUpdatedSubscription?.unsubscribe();
        this.routeSubscription?.unsubscribe();
    }

    canAccess(permission: string): boolean {
        return this.permissions.has(permission);
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
                this.orders.set([]);
                this.errorMessage.set(err?.error?.message || err?.message || "Impossible de charger les commandes.");
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
                this.newOrderModals.update((current) => [
                    order,
                    ...current.filter((item) => item.id !== order.id),
                ].slice(0, 8));
            } else if (!this.billRequested(previous!) && this.billRequested(order)) {
                this.billRequestModal.set(order);
                this.successMessage.set(`Addition demandée par ${order.table?.name || "une table"}.`);
                this.playBillRequestSound();
            }
            return exists
                ? orders.map((item) => item.id === order.id ? { ...item, ...order } : item)
                : [order, ...orders];
        });

        if (this.selectedOrder()?.id === order.id) {
            this.selectedOrder.update((current) => current ? { ...current, ...order } : order);
        }
    }

    private refreshSelectedOrder(): void {
        const selected = this.selectedOrder();
        if (!selected?.id) return;

        this.orderService.show(selected.id).subscribe({
            next: (freshOrder) => {
                this.selectedOrder.set(freshOrder);
                this.orders.update((orders) =>
                    orders.map((order) => order.id === freshOrder.id ? { ...order, ...freshOrder } : order)
                );
            },
            error: () => undefined
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
        if (!this.canAccess("orders.update-status")) {
            this.errorMessage.set("Vous n'avez pas la permission de modifier les commandes.");
            return;
        }
        if (!order.id || order.status === status || this.updatingOrderId() === order.id) return;
        if (this.isStatusDisabled(order, status)) {
            this.errorMessage.set("Impossible de revenir en arrière dans le statut de la commande.");
            return;
        }

        let cancellationReason: string | undefined;
        if (status === "cancelled") {
            if (order.status === "delivered") {
                this.errorMessage.set("Une commande déjà servie ne peut plus être annulée. Utilisez un remboursement.");
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
                    ? "Commande annulée, table libérée et paiement ajusté."
                    : "Statut de la commande mis à jour et envoyé au client.");
                this.updatingOrderId.set(null);
            },
            error: (err) => {
                this.orders.update((orders) =>
                    orders.map((item) => item.id === order.id ? { ...item, status: previousStatus } : item)
                );
                this.errorMessage.set(err?.error?.message || "Impossible de mettre à jour le statut de la commande.");
                this.updatingOrderId.set(null);
            }
        });
    }

    openCashModal(order: Order): void {
        if (!this.canAccess("orders.update-status")) {
            this.errorMessage.set("Vous n'avez pas la permission de modifier le paiement des commandes.");
            return;
        }
        this.cashOrder.set(order);
        this.cashReceivedAmount.set(this.orderTotal(order));
        this.errorMessage.set("");
        this.successMessage.set("");
    }

    closeCashModal(): void {
        this.cashOrder.set(null);
        this.cashReceivedAmount.set(null);
    }

    setCashReceivedAmount(amount: number): void {
        this.cashReceivedAmount.set(Math.max(0, Number(amount || 0)));
    }

    appendCashDigit(value: string): void {
        const current = String(this.cashReceivedAmount() ?? "");
        const next = `${current}${value}`.replace(",", ".");
        const normalized = next.replace(/^0+(?=\d)/, "");
        const amount = Number(normalized);
        if (Number.isNaN(amount)) return;
        this.cashReceivedAmount.set(amount);
    }

    backspaceCashInput(): void {
        const current = String(this.cashReceivedAmount() ?? "");
        const next = current.slice(0, -1);
        this.cashReceivedAmount.set(next ? Number(next) : 0);
    }

    clearCashInput(): void {
        this.cashReceivedAmount.set(0);
    }

    addCashQuickAmount(amount: number): void {
        this.cashReceivedAmount.set(Number(this.cashReceivedAmount() || 0) + amount);
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
        if (!this.canAccess("orders.update-status")) {
            this.errorMessage.set("Vous n'avez pas la permission de modifier le paiement des commandes.");
            return;
        }
        const order = this.cashOrder();
        if (!order?.id || this.updatingPaymentId() === order.id || !this.cashAmountIsEnough()) return;

        const receiptWindow = window.open("", "_blank", "width=420,height=720");
        if (!receiptWindow) {
            this.errorMessage.set("Impossible d'ouvrir le recu. Autorisez les popups du navigateur.");
            return;
        }

        receiptWindow.document.open();
        receiptWindow.document.write(`
            <!doctype html>
            <html lang="fr">
            <head>
                <meta charset="utf-8">
                <title>Préparation du reçu</title>
                <style>
                    body {
                        min-height: 100vh;
                        margin: 0;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-family: Arial, sans-serif;
                        color: #111827;
                    }
                </style>
            </head>
            <body>Préparation du reçu...</body>
            </html>
        `);
        receiptWindow.document.close();

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
                this.successMessage.set("Paiement cash confirmé et comptabilisé.");
                this.updatingPaymentId.set(null);
                this.cashOrder.set(updatedOrder);
                this.printCashReceiptWithFreshRestaurant(updatedOrder, receiptWindow);
            },
            error: (err) => {
                this.errorMessage.set("Impossible de confirmer le paiement cash.");
                this.updatingPaymentId.set(null);
                receiptWindow.close();
            }
        });
    }

    private printCashReceiptWithFreshRestaurant(order: Order, receiptWindow?: Window | null): void {
        this.saasService.currentRestaurant().subscribe({
            next: (restaurant) => {
                if (restaurant) {
                    localStorage.setItem("restaurant_session", JSON.stringify(restaurant));
                }
                setTimeout(() => this.printCashReceiptTicket(order, receiptWindow), 100);
            },
            error: () => setTimeout(() => this.printCashReceiptTicket(order, receiptWindow), 100)
        });
    }

    printCashReceiptTicket(order: Order, receiptWindow?: Window | null): void {
        const restaurant = this.currentRestaurantFromStorage();
        const payment = order.latest_payment;
        const metadata = payment?.metadata || {};
        const received = Number(metadata.received_amount ?? this.cashReceivedAmount() ?? order.total_amount ?? 0);
        const change = Number(metadata.change_amount ?? Math.max(0, received - this.orderTotal(order)));
        const paymentDate = payment?.paid_at ? new Date(payment.paid_at) : new Date();
        const formattedDate = paymentDate.toLocaleString("fr-FR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit"
        });
        const restaurantName = this.escapeReceiptText(restaurant?.name || restaurant?.business_name || restaurant?.restaurant_name || "Restaurant Scan");
        const restaurantAddress = this.escapeReceiptText(restaurant?.address || restaurant?.settings?.address || "");
        const restaurantPhone = this.escapeReceiptText(restaurant?.phone || restaurant?.owner_phone || restaurant?.settings?.phone || "");
        const logoUrl = this.receiptLogoUrl(restaurant);
        const customer = this.escapeReceiptText(order.customer_name || order.pickup_name || order.customer_phone || order.pickup_phone || "Client QR");
        const table = this.escapeReceiptText(order.table?.name || "Table inconnue");
        const orderCode = this.escapeReceiptText(order.tracking_code || order.id.slice(0, 8).toUpperCase());
        const restaurantUrl = this.receiptRestaurantUrl(restaurant);
        const qrCodeUrl = this.receiptQrCodeUrl(restaurantUrl);
        const rows = (order.items || []).map((item) => `
            <tr>
                <td class="item-name">${this.escapeReceiptText(item.plat?.name || "Plat")}</td>
                <td class="qty">${item.quantity}</td>
                <td class="amount">${this.formatCurrency(this.itemLineTotal(item), order.currency)}</td>
            </tr>
        `).join("");
        const receipt = receiptWindow || window.open("", "_blank", "width=420,height=720");

        if (!receipt) {
            this.errorMessage.set("Impossible d'ouvrir le recu. Autorisez les popups du navigateur.");
            return;
        }

        const logo = logoUrl
            ? `<img src="${this.escapeReceiptText(logoUrl)}" alt="Logo" class="logo">`
            : `<div class="logo-placeholder">${restaurantName.slice(0, 2).toUpperCase()}</div>`;
        const receiptHtml = `
            <!doctype html>
            <html lang="fr">
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <title>Recu cash - ${restaurantName}</title>
                <style>
                    @page { size: auto; margin: 8mm; }
                    * { box-sizing: border-box; }
                    html {
                        margin: 0;
                        background: #f3f4f6;
                    }
                    body {
                        margin: 0;
                        min-height: 100vh;
                        display: flex;
                        justify-content: center;
                        align-items: flex-start;
                        padding: 12px 0;
                        background: #f3f4f6;
                        color: #000;
                        font-family: "Courier New", Courier, monospace;
                        font-size: 12px;
                    }
                    .receipt {
                        width: 76mm;
                        margin: 0 auto;
                        padding: 10px 9px;
                        border: 1.5px dashed #000;
                        outline: 1px solid rgba(0, 0, 0, .16);
                        outline-offset: 3px;
                        background: #fff;
                        line-height: 1.35;
                    }
                    .header { text-align: center; }
                    .logo, .logo-placeholder {
                        width: 62px;
                        height: 62px;
                        margin: 0 auto 6px;
                        border-radius: 8px;
                        object-fit: cover;
                    }
                    .logo-placeholder {
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        border: 1px solid #000;
                        font-size: 20px;
                        font-weight: 800;
                    }
                    h1 { margin: 0; font-size: 17px; text-transform: uppercase; }
                    .subtitle { margin: 3px 0 0; font-size: 11px; }
                    .divider { border-top: 1px dashed #000; margin: 9px 0; }
                    .title { text-align: center; text-transform: uppercase; font-weight: 800; margin: 0 0 6px; }
                    .row { display: flex; justify-content: space-between; gap: 8px; margin: 3px 0; }
                    .row span:first-child { font-weight: 700; }
                    table { width: 100%; border-collapse: collapse; }
                    th, td { padding: 4px 0; border-bottom: 1px dashed #999; vertical-align: top; }
                    th { text-align: left; text-transform: uppercase; font-size: 11px; }
                    .qty { width: 24px; text-align: center; }
                    .amount { text-align: right; white-space: nowrap; }
                    .item-name { max-width: 42mm; }
                    .credit {
                        text-align: center;
                        font-size: 15px;
                        font-weight: 800;
                        margin: 10px 0;
                        padding: 7px 0;
                        border-top: 1px dashed #000;
                        border-bottom: 1px dashed #000;
                    }
                    .qr-box {
                        text-align: center;
                        margin: 10px 0 4px;
                        padding-top: 8px;
                        border-top: 1px dashed #000;
                    }
                    .qr-box img {
                        width: 92px;
                        height: 92px;
                        display: block;
                        margin: 0 auto 5px;
                        image-rendering: pixelated;
                    }
                    .qr-box span {
                        display: block;
                        font-size: 10px;
                        font-weight: 800;
                        text-transform: uppercase;
                    }
                    .total-line { font-size: 15px; font-weight: 900; }
                    .thanks { text-align: center; font-weight: 700; margin: 10px 0 0; }
                    @media print {
                        html, body {
                            width: 100%;
                            min-height: auto;
                            display: flex;
                            justify-content: center;
                            align-items: flex-start;
                            padding: 0;
                            background: #fff;
                        }
                        .receipt {
                            width: 76mm;
                            margin: 0 auto;
                            border: 1.5px dashed #000;
                            outline: 0;
                        }
                    }
                </style>
            </head>
            <body>
                <div class="receipt">
                    <div class="header">
                        ${logo}
                        <h1>${restaurantName}</h1>
                        ${restaurantAddress ? `<p class="subtitle">${restaurantAddress}</p>` : ""}
                        ${restaurantPhone ? `<p class="subtitle">Tel: ${restaurantPhone}</p>` : ""}
                        <p class="subtitle">${formattedDate}</p>
                    </div>
                    <div class="divider"></div>
                    <p class="title">Recu de paiement cash</p>
                    <div class="row"><span>Commande</span><strong>#${orderCode}</strong></div>
                    <div class="row"><span>Table</span><strong>${table}</strong></div>
                    <div class="row"><span>Client</span><strong>${customer}</strong></div>
                    <div class="row"><span>Paiement</span><strong>Cash</strong></div>
                    <div class="divider"></div>
                    <table>
                        <thead><tr><th>Article</th><th class="qty">Qte</th><th class="amount">Total</th></tr></thead>
                        <tbody>${rows || `<tr><td colspan="3">Aucun article</td></tr>`}</tbody>
                    </table>
                    <div class="divider"></div>
                    <div class="row total-line"><span>Total</span><span>${this.formatCurrency(this.orderTotal(order), order.currency)}</span></div>
                    <div class="row"><span>Montant reçu</span><span>${this.formatCurrency(received, order.currency)}</span></div>
                    <div class="row"><span>Monnaie</span><span>${this.formatCurrency(change, order.currency)}</span></div>
                    <div class="credit">PAYE: ${this.formatCurrency(this.orderTotal(order), order.currency)}</div>
                    <div class="qr-box">
                        <img src="${this.escapeReceiptText(qrCodeUrl)}" alt="QR code du restaurant">
                        <span>Scanner pour ouvrir notre menu</span>
                    </div>
                    <p class="thanks">Merci pour votre visite !</p>
                </div>
                <script>
                    window.addEventListener("load", function () {
                        setTimeout(function () {
                            window.focus();
                            window.print();
                        }, 650);
                    });
                </script>
            </body>
            </html>
        `;

        receipt.document.open();
        receipt.document.write(receiptHtml);
        receipt.document.close();
    }

    private currentRestaurantFromStorage(): any {
        try {
            const restaurant = JSON.parse(localStorage.getItem("restaurant_session") || "null");
            if (restaurant) return restaurant;
            const user = JSON.parse(localStorage.getItem("user_data") || "null");
            return user?.restaurant || null;
        } catch {
            return null;
        }
    }

    private receiptLogoUrl(restaurant: any): string {
        const logo = restaurant?.logo_data_url
            || restaurant?.logo_url
            || restaurant?.settings?.logo_data_url
            || restaurant?.settings?.logo_url
            || restaurant?.logo_path
            || restaurant?.settings?.logo
            || restaurant?.logo;
        if (!logo) return "";
        if (/^(data:|https?:\/\/|blob:)/i.test(String(logo))) return String(logo);
        const path = String(logo).replace(/^\/+/, "");
        if (path.startsWith("public/")) {
            return `${STORAGE_ROOT}/${path.replace(/^public\//, "")}`;
        }
        if (path.startsWith("storage/")) {
            return `${STORAGE_ROOT.replace(/\/storage$/, "")}/${path}`;
        }
        return `${STORAGE_ROOT}/${path}`;
    }

    private receiptRestaurantUrl(restaurant: any): string {
        const url = new URL(window.location.origin.replace(":4200", ":5173"));
        const restaurantSlug = restaurant?.slug || restaurant?.settings?.slug;

        if (restaurantSlug) {
            url.searchParams.set("restaurant_slug", String(restaurantSlug));
        }

        return url.toString();
    }

    private receiptQrCodeUrl(value: string): string {
        return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=8&data=${encodeURIComponent(value)}`;
    }

    private escapeReceiptText(value: unknown): string {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    printCashReceipt(order: Order): void {
        const payment = order.latest_payment;
        const metadata = payment?.metadata || {};
        const received = Number(metadata.received_amount ?? this.cashReceivedAmount() ?? order.total_amount ?? 0);
        const change = Number(metadata.change_amount ?? Math.max(0, received - this.orderTotal(order)));
        const restaurant = this.currentRestaurantFromStorage();
        const qrCodeUrl = this.receiptQrCodeUrl(this.receiptRestaurantUrl(restaurant));
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
            this.errorMessage.set("Impossible d'ouvrir le reçu. Autorisez les popups du navigateur.");
            return;
        }

        receipt.document.write(`
            <html>
            <head>
                <title>Recu cash Restaurant Scan</title>
                <style>
                    body { font-family: Arial, sans-serif; color: #111827; padding: 18px; }
                    h1 { text-align: center; margin: 0 0 4px; }
                    .muted { color: #6b7280; text-align: center; margin: 0 0 16px; }
                    table { width: 100%; border-collapse: collapse; margin: 16px 0; }
                    th, td { border-bottom: 1px solid #e5e7eb; padding: 8px 4px; font-size: 12px; text-align: left; }
                    .totals div { display: flex; justify-content: space-between; padding: 6px 0; }
                    .total { font-weight: 800; font-size: 18px; border-top: 2px solid #111827; margin-top: 8px; padding-top: 10px; }
                    .qr { text-align: center; margin-top: 16px; }
                    .qr img { width: 110px; height: 110px; }
                    .qr span { display: block; margin-top: 6px; font-size: 11px; font-weight: 800; }
                </style>
            </head>
            <body>
                <h1>Restaurant Scan</h1>
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
                <div class="qr">
                    <img src="${this.escapeReceiptText(qrCodeUrl)}" alt="QR code du restaurant">
                    <span>Scanner pour ouvrir notre menu</span>
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
            unpaid: "non payé",
            pending: "en attente",
            paid: "payé",
            failed: "échoué",
            refunded: "remboursé"
        }[order.payment_status] || order.payment_status;

        return `${method} - ${status}`;
    }

    orderTypeLabel(order: Order): string {
        if (order.order_type === "remote") return "En ligne";
        return order.order_type === "takeaway" ? "À emporter" : "Sur place";
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

    itemName(item: any): string {
        return item?.plat?.name || item?.dish?.name || item?.name || item?.plat_name || "Plat";
    }

    formatCurrency(amount: number, currency = "USD"): string {
        return `${amount.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${currency}`;
    }

    viewOrder(order: Order): void {
        this.billRequestModal.set(null);
        this.cashOrder.set(null);
        this.dismissNewOrder(order.id);
        this.selectedOrder.set(order);
    }

    closeOrderModal(): void {
        this.selectedOrder.set(null);
    }

    openNewOrder(order: Order): void {
        this.viewOrder(order);
    }

    dismissNewOrder(orderId?: string): void {
        if (!orderId) {
            this.newOrderModals.set([]);
            return;
        }

        this.newOrderModals.update((orders) => orders.filter((order) => order.id !== orderId));
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
                <title>Rapport commandes Restaurant Scan</title>
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

    private isStatusFilter(value: string | null): value is Order["status"] | "all" | "online" {
        return ["all", "online", "pending", "preparing", "ready", "delivered", "cancelled"].includes(String(value));
    }
}
