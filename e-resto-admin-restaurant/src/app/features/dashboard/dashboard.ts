import { CommonModule, DatePipe, DecimalPipe } from "@angular/common";
import { AfterViewInit, Component, OnDestroy, OnInit, computed, inject, signal } from "@angular/core";
import { RouterLink } from "@angular/router";
import ApexCharts, { ApexOptions } from "apexcharts";
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
        DatePipe,
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
            pending: "Recues",
            preparing: "En preparation",
            ready: "Pretes",
            delivered: "Servies",
            cancelled: "Annulees"
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

    readonly recentOrders = computed(() => this.todayOrders().slice(0, 6));
    readonly canViewAnalytics = computed(() => this.planUsage()?.permissions?.can_view_analytics !== false);

    readonly onboardingSteps: OnboardingStep[] = [
        {
            eyebrow: "14 jours d'essai gratuit - plan complet",
            title: "Bienvenue sur Restaurant Scan",
            description: "Votre restaurant entre dans l'ere digitale. En quelques minutes, vos clients pourront consulter votre menu et commander depuis leur telephone.",
            icon: "ti ti-hand-wave",
            tone: "orange",
            bullets: ["Tableau de bord en Temps réel", "Menu QR accessible sans application", "Commandes centralisees dans votre espace"]
        },
        {
            eyebrow: "Etape 1 - gerer les plats",
            title: "Creez votre menu",
            description: "Ajoutez vos categories, vos plats, vos prix et vos photos pour construire un menu clair et pret a partager.",
            icon: "ti ti-tools-kitchen-2",
            tone: "indigo",
            bullets: ["Categories: entrees, plats, boissons", "Photos, descriptions et prix", "Plat disponible ou epuise en un clic"]
        },
        {
            eyebrow: "Etape 2 - installer le QR code",
            title: "Votre QR code unique",
            description: "Creez vos tables, imprimez les QR codes et placez-les pour que les clients ouvrent le menu instantanement.",
            icon: "ti ti-qrcode",
            tone: "violet",
            bullets: ["Generation de QR code par table", "Impression depuis la fiche table", "Lien menu client partageable"]
        },
        {
            eyebrow: "Etape 3 - gerer les commandes",
            title: "Recevez des commandes",
            description: "Les commandes arrivent directement depuis le menu client avec statut, table, total et details des plats.",
            icon: "ti ti-shopping-cart",
            tone: "orange",
            bullets: ["Notification a chaque nouvelle commande", "Sur place, a emporter ou livraison", "Validation et suivi du statut"]
        },
        {
            eyebrow: "Etape 4 - statistiques",
            title: "Analysez vos performances",
            description: "Suivez les plats les plus commandes, les revenus par periode et l'activite du service.",
            icon: "ti ti-chart-bar",
            tone: "emerald",
            bullets: ["Commandes et revenus du jour", "Top plats du mois", "Graphiques sur les 7 derniers jours"]
        },
        {
            eyebrow: "Etape 5 - parametres",
            title: "Personnalisez votre menu",
            description: "Adaptez les informations visibles par vos clients: logo, couleurs, telephone, adresse et slug public.",
            icon: "ti ti-settings",
            tone: "pink",
            bullets: ["Logo et couleurs du menu client", "Adresse et telephone cliquables", "URL publique personnalisee selon le plan"]
        },
        {
            eyebrow: "C'est parti",
            title: "Vous etes pret",
            description: "Commencez par creer vos categories et vos plats, puis ajoutez vos tables pour imprimer les QR codes.",
            icon: "ti ti-rocket",
            tone: "orange",
            bullets: ["Notre equipe peut vous accompagner", "Vous pouvez rouvrir le guide depuis ce navigateur", "Votre dashboard est pret pour le service"]
        }
    ];

    readonly currentOnboardingStep = computed(() => this.onboardingSteps[this.onboardingStepIndex()]);

    readonly kpiCards = computed<KpiCard[]>(() => [
        {
            label: "Commandes du jour",
            value: String(this.todayOrders().length),
            hint: `${this.activeOrders().length} en cours`,
            icon: "ti ti-receipt",
            tone: "primary"
        },
        {
            label: "Chiffre du jour",
            value: this.formatRevenueList(this.revenueTodayByCurrency()),
            hint: "Revenus payes par devise",
            icon: "ti ti-currency-dollar",
            tone: "success"
        },
        {
            label: "Plats disponibles",
            value: `${this.availableDishes()}/${this.dishes().length}`,
            hint: `${this.categories().length} categories actives`,
            icon: "ti ti-tools-kitchen-2",
            tone: "info"
        },
        {
            label: "Occupation tables",
            value: `${this.occupancyRate()}%`,
            hint: `${this.occupiedTables()}/${this.tables().length} tables occupees`,
            icon: "ti ti-armchair",
            tone: "warning"
        }
    ]);

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
            agents: this.agentService.list().pipe(catchError(() => of([] as any[])))
        }).subscribe({
            next: (data) => {
                this.todayOrders.set(data.todayOrders);
                this.monthOrders.set(data.monthOrders);
                this.yearOrders.set(data.yearOrders);
                this.dishes.set(data.dishes);
                this.categories.set(data.categories);
                this.tables.set(data.tables);
                this.agents.set(data.agents);
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

    loadUsage(): void {
        this.saasService.restaurantUsage().subscribe({
            next: (usage) => this.planUsage.set(usage),
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
            labels: ["En cours", "Terminees", "Annulees"],
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
