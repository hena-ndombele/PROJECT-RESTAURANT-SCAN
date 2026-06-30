import { CommonModule, DecimalPipe } from "@angular/common";
import { AfterViewInit, Component, OnDestroy, OnInit, computed, inject, signal } from "@angular/core";
import { RouterLink } from "@angular/router";
import ApexCharts, { ApexOptions } from "apexcharts";
import * as XLSX from "xlsx";
import { Subscription, catchError, forkJoin, of } from "rxjs";
import { Footer } from "../../layouts/footer/footer";
import { AgentService } from "../../services/agents/agent-service";
import { CategoryService } from "../../services/category/category-service";
import { DishService } from "../../services/dish/dish-service";
import { OderService } from "../../services/orders/oder-service";
import { TableService } from "../../services/table/table-service";
import { DishDto } from "../../models/dish/DishDto";
import { CategoryDto } from "../../models/category/CategoryDto";
import { TableDto } from "../../models/table/TableDto";
import { Order } from "../../models/orders/OrderDto";
import { OrderRealtimeService } from "../../services/realtime/order-realtime-service";
import { SaasService } from "../../services/saas/saas-service";
import { RestaurantPlanUsage } from "../../models/saas/saas.models";
import { AppPermissionService } from "../../services/auth/permission-service";

type DashboardStatus = Order["status"];

interface KpiCard {
    label: string;
    value: string;
    hint: string;
    icon: string;
    tone: "primary" | "success" | "info" | "warning";
}

interface CurrencyRevenue {
    currency: string;
    amount: number;
    count: number;
}

type RevenuePeriod = "today" | "month" | "year";
type DashboardView = "restaurant" | "business";

interface OnboardingStep {
    eyebrow: string;
    title: string;
    description: string;
    icon: string;
    tone: "orange" | "indigo" | "violet" | "emerald" | "pink";
    bullets: string[];
}

@Component({
    selector: "app-dashboard",
    imports: [
        CommonModule,
        DecimalPipe,
        RouterLink,
        Footer
    ],
    templateUrl: "./dashboard.html",
    styleUrl: "./dashboard.scss",
    standalone: true
})
export class Dashboard implements OnInit, AfterViewInit, OnDestroy {
    private readonly orderService = inject(OderService);
    private readonly dishService = inject(DishService);
    private readonly categoryService = inject(CategoryService);
    private readonly tableService = inject(TableService);
    private readonly agentService = inject(AgentService);
    private readonly realtime = inject(OrderRealtimeService);
    private readonly saasService = inject(SaasService);
    private readonly permissions = inject(AppPermissionService);

    private salesPurchaseChart?: ApexCharts;
    private customerChart?: ApexCharts;
    private realtimeSubscription?: Subscription;
    private chartsReady = false;

    readonly loading = signal(true);
    readonly refreshing = signal(false);
    readonly errorMessage = signal("");
    readonly lastUpdated = signal<Date | null>(null);
    readonly onboardingOpen = signal(false);
    readonly onboardingStepIndex = signal(0);
    readonly planUsage = signal<RestaurantPlanUsage | null>(null);
    readonly dashboardView = signal<DashboardView>("restaurant");
    readonly businessAnalytics = signal<any | null>(null);
    readonly selectedBusinessMonth = signal(this.currentMonthValue());
    readonly businessExporting = signal<"excel" | "pdf" | "">("");

    readonly todayOrders = signal<Order[]>([]);
    readonly monthOrders = signal<Order[]>([]);
    readonly yearOrders = signal<Order[]>([]);
    readonly dishes = signal<DishDto[]>([]);
    readonly categories = signal<CategoryDto[]>([]);
    readonly tables = signal<TableDto[]>([]);
    readonly agents = signal<any[]>([]);

    readonly currency = computed(() => {
        return this.todayOrders()[0]?.currency
            || this.monthOrders()[0]?.currency
            || this.yearOrders()[0]?.currency
            || this.dishes()[0]?.currency
            || "USD";
    });

    readonly activeOrders = computed(() => {
        return this.todayOrders().filter((order) =>
            ["pending", "preparing", "ready"].includes(order.status)
        );
    });

    readonly completedOrders = computed(() => {
        return this.todayOrders().filter((order) =>
            order.payment_status === "paid"
        );
    });

    readonly revenueToday = computed(() => this.sumOrders(this.todayOrders()));
    readonly revenueMonth = computed(() => this.sumOrders(this.monthOrders()));
    readonly revenueYear = computed(() => this.sumOrders(this.yearOrders()));
    readonly revenueTodayByCurrency = computed(() => this.groupRevenueByCurrency(this.todayOrders()));
    readonly revenueMonthByCurrency = computed(() => this.groupRevenueByCurrency(this.monthOrders()));
    readonly revenueYearByCurrency = computed(() => this.groupRevenueByCurrency(this.yearOrders()));
    readonly averageTicket = computed(() => {
        const orders = this.completedOrders().filter((order) => order.currency === this.currency());
        if (!orders.length) return 0;
        return this.sumOrders(orders) / orders.length;
    });

    readonly availableDishes = computed(() => {
        return this.dishes().filter((dish) => dish.is_available === true || dish.is_available === 1).length;
    });

    readonly occupiedTables = computed(() => {
        return this.tables().filter((table) => {
            const status = String(table.status || "").toLowerCase();
            return status !== "libre" && status !== "available" && status !== "disponible";
        }).length;
    });

    readonly occupancyRate = computed(() => {
        const total = this.tables().length;
        if (!total) return 0;
        return Math.round((this.occupiedTables() / total) * 100);
    });

    readonly statusSummary = computed(() => {
        const labels: Record<DashboardStatus, string> = {
            pending: "Reçues",
            preparing: "En préparation",
            ready: "Prêtes",
            delivered: "Servies",
            cancelled: "Annulées"
        };

        return (Object.keys(labels) as DashboardStatus[]).map((status) => ({
            status,
            label: labels[status],
            count: this.todayOrders().filter((order) => order.status === status).length,
            className: this.statusClass(status)
        }));
    });

    readonly topDishes = computed(() => {
        const totals = new Map<string, { name: string; quantity: number; revenue: number }>();

        for (const order of this.monthOrders()) {
            for (const item of order.items || []) {
                const key = item.plat_id || item.plat?.id || item.plat?.name || item.id;
                const current = totals.get(key) || {
                    name: item.plat?.name || "Plat inconnu",
                    quantity: 0,
                    revenue: 0
                };

                const quantity = Number(item.quantity || 0);
                const price = Number(item.price_at_order || item.plat?.price || 0);
                current.quantity += quantity;
                current.revenue += quantity * price;
                totals.set(key, current);
            }
        }

        return Array.from(totals.values())
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, 5);
    });

    readonly recentOrders = computed(() => this.todayOrders().slice(0, 10));
    readonly recentOrdersDescription = computed(() => {
        return this.planUsage()?.permissions?.can_use_multi_restaurant === true
            ? "Dernières commandes du restaurant sélectionné."
            : "Dernières commandes de votre restaurant.";
    });
    readonly canViewAnalytics = computed(() => this.planUsage()?.permissions?.can_view_analytics === true);
    readonly canViewBusinessGlobal = computed(() => {
        const user = JSON.parse(localStorage.getItem("user_data") || "null");
        const restaurant = JSON.parse(localStorage.getItem("restaurant_session") || "null") || user?.restaurant;
        const isBusinessOwner = Boolean(
            user?.id && restaurant?.business_owner_user_id === user.id
            || user?.email && restaurant?.owner_email && String(restaurant.owner_email).toLowerCase() === String(user.email).toLowerCase()
        );

        return Boolean(
            this.planUsage()?.permissions?.can_use_multi_restaurant === true &&
            (
                restaurant?.can_manage_business_restaurants ||
                isBusinessOwner ||
                this.permissions.hasAnyRole(["multi-tenant", "multi-restaurant", "multi-restaurants"])
            )
        );
    });

    readonly onboardingSteps: OnboardingStep[] = [
        {
            eyebrow: "14 jours d'essai gratuit - plan complet",
            title: "Bienvenue sur Restaurant Scan",
            description: "Votre restaurant entre dans l'ère digitale. En quelques minutes, vos clients pourront consulter votre menu et commander depuis leur téléphone.",
            icon: "ti ti-hand-wave",
            tone: "orange",
            bullets: ["Tableau de bord en temps réel", "Menu QR accessible sans application", "Commandes centralisées dans votre espace"]
        },
        {
            eyebrow: "Étape 1 - gérer les plats",
            title: "Créez votre menu",
            description: "Ajoutez vos catégories, vos plats, vos prix et vos photos pour construire un menu clair et prêt à partager.",
            icon: "ti ti-tools-kitchen-2",
            tone: "indigo",
            bullets: ["Catégories : entrées, plats, boissons", "Photos, descriptions et prix", "Plat disponible ou épuisé en un clic"]
        },
        {
            eyebrow: "Étape 2 - installer le QR code",
            title: "Votre QR code unique",
            description: "Créez vos tables, imprimez les QR codes et placez-les pour que les clients ouvrent le menu instantanément.",
            icon: "ti ti-qrcode",
            tone: "violet",
            bullets: ["Génération de QR code par table", "Impression depuis la fiche table", "Lien menu client partageable"]
        },
        {
            eyebrow: "Étape 3 - gérer les commandes",
            title: "Recevez des commandes",
            description: "Les commandes arrivent directement depuis le menu client avec statut, table, total et détails des plats.",
            icon: "ti ti-shopping-cart",
            tone: "orange",
            bullets: ["Notification à chaque nouvelle commande", "Sur place, à emporter ou livraison", "Validation et suivi du statut"]
        },
    ];

    readonly currentOnboardingStep = computed(() => this.onboardingSteps[this.onboardingStepIndex()]);
    readonly businessMonthOptions = this.monthOptions();

    readonly kpiCards = computed<KpiCard[]>(() => [
        {
            label: "Commandes du jour",
            value: String(this.todayOrders().length),
            hint: `${this.activeOrders().length} en cours`,
            icon: "ti ti-receipt",
            tone: "primary"
        },
        {
            label: "CA du jour",
            value: this.formatRevenueList(this.revenueTodayByCurrency()),
            hint: `${this.completedOrders().length} commande(s) payee(s)`,
            icon: "ti ti-cash",
            tone: "success"
        },
        {
            label: "Occupation tables",
            value: `${this.occupancyRate()}%`,
            hint: `${this.occupiedTables()}/${this.tables().length} tables occupées`,
            icon: "ti ti-armchair",
            tone: "warning"
        },
        {
            label: "Plats publies",
            value: String(this.dishes().length),
            hint: `${this.availableDishes()} disponible(s)`,
            icon: "ti ti-tools-kitchen-2",
            tone: "info"
        }
    ]);

    revenueAmount(period: string, currency: string): number {
        return this.revenueCollection(period).find((item) => item.currency === currency)?.amount ?? 0;
    }

    revenueCount(period: string, currency: string): number {
        return this.revenueCollection(period).find((item) => item.currency === currency)?.count ?? 0;
    }

    revenuePeriodOrders(period: string): number {
        if (period === "today") return this.todayOrders().length;
        if (period === "month") return this.monthOrders().length;
        return this.yearOrders().length;
    }

    revenuePeriodLabel(period: string): string {
        if (period === "today") return "Aujourd'hui";
        if (period === "month") return "Ce mois";
        return "Cette année";
    }

    ngOnInit(): void {
        this.realtime.start();
        this.realtimeSubscription = this.realtime.orderChanged$.subscribe((order) => this.applyRealtimeOrder(order));
        this.loadUsage();
        this.loadDashboard();
        this.openOnboardingForFirstVisit();
    }

    ngAfterViewInit(): void {
        this.chartsReady = true;
        this.renderCharts();
    }

    ngOnDestroy(): void {
        this.realtimeSubscription?.unsubscribe();
        void this.salesPurchaseChart?.destroy();
        void this.customerChart?.destroy();
    }

    loadDashboard(silent = false): void {
        const now = new Date();
        const day = this.toInputDate(now);
        const month = String(now.getMonth() + 1).padStart(2, "0");
        const year = String(now.getFullYear());

        if (silent) {
            this.refreshing.set(true);
        } else {
            this.loading.set(true);
        }
        this.errorMessage.set("");

        forkJoin({
            todayOrders: this.orderService.list({ day }).pipe(catchError(() => of([] as Order[]))),
            monthOrders: this.orderService.list({ month, year }).pipe(catchError(() => of([] as Order[]))),
            yearOrders: this.orderService.list({ year }).pipe(catchError(() => of([] as Order[]))),
            dishes: this.dishService.list().pipe(catchError(() => of([] as DishDto[]))),
            categories: this.categoryService.list().pipe(catchError(() => of([] as CategoryDto[]))),
            tables: this.tableService.list().pipe(catchError(() => of([] as TableDto[]))),
            agents: this.agentService.list().pipe(catchError(() => of([] as any[]))),
            businessAnalytics: this.saasService.businessAnalytics(this.businessAnalyticsParams()).pipe(catchError(() => of(null)))
        }).subscribe({
            next: (data) => {
                this.todayOrders.set(data.todayOrders);
                this.monthOrders.set(data.monthOrders);
                this.yearOrders.set(data.yearOrders);
                this.dishes.set(data.dishes);
                this.categories.set(data.categories);
                this.tables.set(data.tables);
                this.agents.set(data.agents);
                this.businessAnalytics.set(data.businessAnalytics);
                this.lastUpdated.set(new Date());
                this.loading.set(false);
                this.refreshing.set(false);
                this.renderCharts();
            },
            error: () => {
                this.errorMessage.set("Impossible de charger le dashboard pour le moment.");
                this.loading.set(false);
                this.refreshing.set(false);
            }
        });
    }

    statusClass(status: DashboardStatus): string {
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

    formatMoney(amount: number): string {
        return `${amount.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${this.currency()}`;
    }

    formatMoneyWithCurrency(amount: number, currency: string): string {
        return `${amount.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${currency}`;
    }

    formatRevenueList(items: CurrencyRevenue[]): string {
        if (!items.length) return "0 USD / 0 CDF";
        return items.map((item) => this.formatMoneyWithCurrency(item.amount, item.currency)).join(" / ");
    }

    businessRevenueList(key: "revenue_month_by_currency" | "revenue_year_by_currency"): string {
        return this.formatRevenueList(this.businessAnalytics()?.summary?.[key] || []);
    }

    restaurantRevenueList(row: any): string {
        return this.formatRevenueList(row?.revenue_by_currency || []);
    }

    onBusinessMonthChange(value: string): void {
        this.selectedBusinessMonth.set(value || this.currentMonthValue());
        this.loadBusinessAnalytics(true);
    }

    exportBusinessExcel(): void {
        const global = this.businessAnalytics();
        if (!global) return;

        this.businessExporting.set("excel");
        const summaryRows = [
            ["Periode", global.period?.label || this.selectedBusinessMonthLabel()],
            ["CA total du mois", this.businessRevenueList("revenue_month_by_currency")],
            ["CA annuel", this.businessRevenueList("revenue_year_by_currency")],
            ["Commandes du mois", global.summary?.orders_month || 0],
            ["Commandes de l'annee", global.summary?.orders_year || 0],
            ["Meilleur restaurant", global.summary?.best_restaurant?.name || "-"],
            ["Restaurant a suivre", global.summary?.weakest_restaurant?.name || "-"],
        ];
        const rankingRows = (global.restaurants || []).map((row: any) => ({
            Restaurant: row.name || "-",
            Province: row.city || "-",
            Commandes: row.orders_count || 0,
            "Commandes payees": row.paid_orders_count || 0,
            Revenus: this.restaurantRevenueList(row),
            Equipe: row.users_count || 0,
            Tables: row.tables_count || 0,
        }));
        const dishRows = (global.top_dishes || []).map((dish: any) => ({
            Plat: dish.name || "-",
            Quantite: dish.quantity || 0,
            Revenu: Number(dish.revenue || 0),
        }));

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(summaryRows), "Resume");
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rankingRows), "Restaurants");
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(dishRows), "Top plats");
        XLSX.writeFile(workbook, `statistiques-business-${this.selectedBusinessMonth()}.xlsx`);
        this.businessExporting.set("");
    }

    exportBusinessPdf(): void {
        const global = this.businessAnalytics();
        if (!global) return;

        this.businessExporting.set("pdf");
        const html = this.businessPdfHtml(global);
        const reportWindow = window.open("", "_blank", "noopener,noreferrer,width=1024,height=720");
        if (!reportWindow) {
            this.businessExporting.set("");
            return;
        }

        reportWindow.document.open();
        reportWindow.document.write(html);
        reportWindow.document.close();
        reportWindow.focus();
        setTimeout(() => {
            reportWindow.print();
            this.businessExporting.set("");
        }, 450);
    }

    switchDashboardView(view: DashboardView): void {
        if (view === "business" && !this.canViewBusinessGlobal()) {
            this.dashboardView.set("restaurant");
            return;
        }

        this.dashboardView.set(view);
    }

    private loadBusinessAnalytics(silent = false): void {
        if (silent) {
            this.refreshing.set(true);
        }

        this.saasService.businessAnalytics(this.businessAnalyticsParams()).pipe(
            catchError(() => of(null))
        ).subscribe({
            next: (analytics) => {
                this.businessAnalytics.set(analytics);
                this.refreshing.set(false);
            },
            error: () => {
                this.refreshing.set(false);
            },
        });
    }

    loadUsage(): void {
        this.saasService.restaurantUsage().subscribe({
            next: (usage) => {
                this.planUsage.set(usage);
                if (!this.canViewBusinessGlobal() && this.dashboardView() === "business") {
                    this.dashboardView.set("restaurant");
                }
            },
            error: () => this.planUsage.set(null),
        });
    }

    nextOnboardingStep(): void {
        if (this.onboardingStepIndex() >= this.onboardingSteps.length - 1) {
            this.finishOnboarding();
            return;
        }

        this.onboardingStepIndex.update((index) => index + 1);
    }

    previousOnboardingStep(): void {
        this.onboardingStepIndex.update((index) => Math.max(0, index - 1));
    }

    skipOnboarding(): void {
        this.finishOnboarding();
    }

    finishOnboarding(): void {
        localStorage.setItem(this.onboardingStorageKey(), "done");
        this.onboardingOpen.set(false);
        this.onboardingStepIndex.set(0);
    }

    private renderCharts(): void {
        if (!this.chartsReady) return;

        this.renderSalesPurchaseChart();
        this.renderCustomerChart();
    }

    private revenueCollection(period: string): CurrencyRevenue[] {
        if (period === "today") return this.revenueTodayByCurrency();
        if (period === "month") return this.revenueMonthByCurrency();
        return this.revenueYearByCurrency();
    }

    private businessAnalyticsParams(): { month: number; year: number } {
        const [year, month] = this.selectedBusinessMonth().split("-").map((value) => Number(value));
        return {
            month: Number.isFinite(month) ? month : new Date().getMonth() + 1,
            year: Number.isFinite(year) ? year : new Date().getFullYear(),
        };
    }

    private currentMonthValue(): string {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    }

    private monthOptions(): Array<{ value: string; label: string }> {
        const year = new Date().getFullYear();
        return Array.from({ length: 12 }, (_, index) => {
            const date = new Date(year, index, 1);
            return {
                value: `${year}-${String(index + 1).padStart(2, "0")}`,
                label: date.toLocaleDateString("fr-FR", { month: "long", year: "numeric" }),
            };
        });
    }

    private selectedBusinessMonthLabel(): string {
        return this.businessMonthOptions.find((item) => item.value === this.selectedBusinessMonth())?.label || "Ce mois";
    }

    private businessPdfHtml(global: any): string {
        const restaurants = (global.restaurants || []).map((row: any) => `
            <tr>
                <td><strong>${this.escapeHtml(row.name || "-")}</strong><br><small>${this.escapeHtml(row.city || "Province non renseignee")}</small></td>
                <td>${row.orders_count || 0}</td>
                <td>${row.paid_orders_count || 0}</td>
                <td>${this.escapeHtml(this.restaurantRevenueList(row))}</td>
                <td>${row.users_count || 0}</td>
                <td>${row.tables_count || 0}</td>
            </tr>
        `).join("");
        const dishes = (global.top_dishes || []).map((dish: any) => `
            <tr>
                <td>${this.escapeHtml(dish.name || "-")}</td>
                <td>${dish.quantity || 0}</td>
                <td>${Number(dish.revenue || 0).toLocaleString("fr-FR")}</td>
            </tr>
        `).join("");

        return `<!doctype html>
        <html lang="fr">
        <head>
            <meta charset="utf-8">
            <title>Statistiques Business</title>
            <style>
                body { margin: 0; padding: 34px; color: #111827; font-family: Inter, Arial, sans-serif; background: #f6f7fb; }
                .report { max-width: 1080px; margin: 0 auto; background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; }
                header { padding: 28px; color: #fff; background: #111827; }
                header span { color: #ff7a1a; font-size: 12px; font-weight: 900; text-transform: uppercase; }
                h1 { margin: 6px 0 4px; font-size: 28px; }
                p { margin: 0; color: #64748b; }
                header p { color: rgba(255,255,255,.72); }
                .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; padding: 20px; }
                .card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; }
                .card span { color: #64748b; font-size: 11px; font-weight: 900; text-transform: uppercase; }
                .card strong { display: block; margin-top: 8px; font-size: 18px; }
                section { padding: 0 20px 22px; }
                h2 { margin: 0 0 12px; font-size: 18px; }
                table { width: 100%; border-collapse: collapse; background: #fff; }
                th, td { padding: 11px 12px; border-bottom: 1px solid #e5e7eb; text-align: left; }
                th { color: #64748b; background: #f8fafc; font-size: 11px; text-transform: uppercase; }
                small { color: #64748b; }
                @media print { body { background: #fff; padding: 0; } .report { border: 0; } }
            </style>
        </head>
        <body>
            <main class="report">
                <header>
                    <span>Restaurant Scan</span>
                    <h1>Statistiques globales Business</h1>
                    <p>Periode : ${this.escapeHtml(global.period?.label || this.selectedBusinessMonthLabel())}</p>
                </header>
                <div class="stats">
                    <div class="card"><span>CA du mois</span><strong>${this.escapeHtml(this.businessRevenueList("revenue_month_by_currency"))}</strong></div>
                    <div class="card"><span>CA annuel</span><strong>${this.escapeHtml(this.businessRevenueList("revenue_year_by_currency"))}</strong></div>
                    <div class="card"><span>Meilleur restaurant</span><strong>${this.escapeHtml(global.summary?.best_restaurant?.name || "-")}</strong></div>
                    <div class="card"><span>Restaurant a suivre</span><strong>${this.escapeHtml(global.summary?.weakest_restaurant?.name || "-")}</strong></div>
                </div>
                <section>
                    <h2>Classement des restaurants</h2>
                    <table>
                        <thead><tr><th>Restaurant</th><th>Commandes</th><th>Payees</th><th>Revenus</th><th>Equipe</th><th>Tables</th></tr></thead>
                        <tbody>${restaurants || '<tr><td colspan="6">Aucune donnee.</td></tr>'}</tbody>
                    </table>
                </section>
                <section>
                    <h2>Top plats du groupe</h2>
                    <table>
                        <thead><tr><th>Plat</th><th>Quantite</th><th>Revenu</th></tr></thead>
                        <tbody>${dishes || '<tr><td colspan="3">Aucune donnee.</td></tr>'}</tbody>
                    </table>
                </section>
            </main>
        </body>
        </html>`;
    }

    private escapeHtml(value: string): string {
        return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    private openOnboardingForFirstVisit(): void {
        if (localStorage.getItem(this.onboardingStorageKey()) === "done") {
            return;
        }

        setTimeout(() => this.onboardingOpen.set(true), 350);
    }

    private onboardingStorageKey(): string {
        const restaurant = JSON.parse(localStorage.getItem("restaurant_session") || "null");
        const user = JSON.parse(localStorage.getItem("user_data") || "null");
        return `e_resto_dashboard_onboarding_done_${restaurant?.id || restaurant?.slug || user?.email || "current"}`;
    }

    private renderSalesPurchaseChart(): void {
        const element = document.querySelector<HTMLElement>("#salesPurchaseChart");
        if (!element) return;

        const chartData = this.lastSevenDaysData();
        const options: ApexOptions = {
            series: [
                { name: "Commandes", data: chartData.orders },
                { name: "Revenu", data: chartData.revenue }
            ],
            colors: ["#0d6efd", "#16a34a"],
            chart: {
                type: "bar",
                height: 320,
                width: "100%",
                parentHeightOffset: 0,
                toolbar: { show: false }
            },
            grid: { show: true, borderColor: "#e5e7eb" },
            legend: { show: true, fontFamily: "Inter, Poppins, sans-serif", fontWeight: 600 },
            plotOptions: {
                bar: {
                    horizontal: false,
                    columnWidth: "55%",
                    borderRadius: 4,
                    borderRadiusApplication: "end"
                }
            },
            dataLabels: { enabled: false },
            stroke: { show: true, width: 2, colors: ["transparent"] },
            xaxis: { categories: chartData.labels, axisBorder: { show: false }, axisTicks: { show: false } },
            yaxis: { labels: { formatter: (value: number) => `${Math.round(value)}` } },
            fill: { opacity: 1 },
            tooltip: {
                y: {
                    formatter: (value: number, context: any) => {
                        return context.seriesIndex === 1 ? this.formatMoney(value) : `${value} commandes`;
                    }
                }
            }
        };

        if (this.salesPurchaseChart) {
            void this.salesPurchaseChart.updateOptions(options);
            return;
        }

        this.salesPurchaseChart = new ApexCharts(element, options);
        void this.salesPurchaseChart.render();
    }

    private renderCustomerChart(): void {
        const element = document.querySelector<HTMLElement>("#customerChart");
        if (!element) return;

        const active = this.activeOrders().length;
        const completed = this.completedOrders().length;
        const cancelled = this.todayOrders().filter((order) => order.status === "cancelled").length;
        const series = [active, completed, cancelled].map((value) => Math.max(value, 0));

        const options: ApexOptions = {
            series,
            chart: { height: 250, type: "donut" },
            colors: ["#0d6efd", "#16a34a", "#dc3545"],
            labels: ["En cours", "Terminées", "Annulées"],
            legend: { position: "bottom", fontFamily: "Inter, Poppins, sans-serif" },
            dataLabels: { enabled: false },
            plotOptions: {
                pie: {
                    donut: {
                        size: "68%",
                        labels: {
                            show: true,
                            total: {
                                show: true,
                                label: "Total",
                                formatter: () => String(this.todayOrders().length)
                            }
                        }
                    }
                }
            }
        };

        if (this.customerChart) {
            void this.customerChart.updateOptions(options);
            return;
        }

        this.customerChart = new ApexCharts(element, options);
        void this.customerChart.render();
    }

    private lastSevenDaysData(): { labels: string[]; orders: number[]; revenue: number[] } {
        const today = new Date();
        const days = Array.from({ length: 7 }, (_, index) => {
            const date = new Date(today);
            date.setDate(today.getDate() - (6 - index));
            return date;
        });

        return {
            labels: days.map((date) => date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })),
            orders: days.map((date) => this.ordersForDate(date).length),
            revenue: days.map((date) => this.sumOrders(this.ordersForDate(date)))
        };
    }

    private ordersForDate(date: Date): Order[] {
        const target = this.toInputDate(date);
        return this.monthOrders().filter((order) => this.toInputDate(new Date(order.created_at)) === target);
    }

    private applyRealtimeOrder(order: Order): void {
        this.upsertOrderSignal(this.todayOrders, order, this.toInputDate(new Date()) === this.toInputDate(new Date(order.created_at)));
        this.upsertOrderSignal(this.monthOrders, order, this.isSameMonth(new Date(), new Date(order.created_at)));
        this.upsertOrderSignal(this.yearOrders, order, new Date().getFullYear() === new Date(order.created_at).getFullYear());
        this.lastUpdated.set(new Date());
        this.renderCharts();
    }

    private upsertOrderSignal(target: typeof this.todayOrders, order: Order, shouldInclude: boolean): void {
        target.update((orders) => {
            const withoutOrder = orders.filter((item) => item.id !== order.id);
            return shouldInclude ? [order, ...withoutOrder] : withoutOrder;
        });
    }

    private isSameMonth(left: Date, right: Date): boolean {
        return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth();
    }

    private sumOrders(orders: Order[]): number {
        return orders
            .filter((order) => order.payment_status === "paid")
            .reduce((total, order) => total + Number(order.total_amount || 0), 0);
    }

    private groupRevenueByCurrency(orders: Order[]): CurrencyRevenue[] {
        const totals = new Map<string, CurrencyRevenue>();

        for (const order of orders.filter((item) => item.payment_status === "paid")) {
            const currency = order.currency || "USD";
            const current = totals.get(currency) || { currency, amount: 0, count: 0 };
            current.amount += Number(order.total_amount || 0);
            current.count += 1;
            totals.set(currency, current);
        }

        const result = Array.from(totals.values()).sort((a, b) => a.currency.localeCompare(b.currency));
        for (const currency of ["CDF", "USD"]) {
            if (!result.some((item) => item.currency === currency)) {
                result.push({ currency, amount: 0, count: 0 });
            }
        }
        return result.sort((a, b) => a.currency.localeCompare(b.currency));
    }

    private toInputDate(date: Date): string {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    }
}
