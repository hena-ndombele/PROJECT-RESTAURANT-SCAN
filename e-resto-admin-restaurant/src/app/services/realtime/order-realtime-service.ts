import { Injectable, NgZone, computed, inject, signal } from "@angular/core";
import { Subject } from "rxjs";
import { Order } from "../../models/orders/OrderDto";
import { AuthService } from "../auth/auth-service";
import { OderService } from "../orders/oder-service";
import { ReservationDto, ReservationService } from "../reservation/reservation-service";
import { API_ROOT } from "../api-url";

interface OrderNotification {
    id: string;
    title: string;
    message: string;
    createdAt: Date;
    order?: Order;
    route?: string;
}

export interface FeedbackRealtimeDto {
    id: string;
    restaurant_id?: string | null;
    food_rating?: number;
    service_rating?: number;
    ordering_rating?: number;
    recommended?: boolean | null;
    comment?: string | null;
    customer_name?: string | null;
    customer_phone?: string | null;
    created_at?: string;
    order?: {
        id: string;
        total_amount?: number;
        currency?: string;
        table?: { id: string; name: string } | null;
    } | null;
    table?: { id: string; name: string } | null;
}

@Injectable({
    providedIn: "root"
})
export class OrderRealtimeService {
    private readonly orderService = inject(OderService);
    private readonly reservationService = inject(ReservationService);
    private readonly authService = inject(AuthService);
    private readonly zone = inject(NgZone);

    private socket?: WebSocket;
    private reconnectTimer?: ReturnType<typeof setTimeout>;
    private pollingTimer?: ReturnType<typeof setInterval>;
    private connected = false;
    private started = false;
    private reservationPollingInitialized = false;
    private knownReservationIds = new Set<string>();

    readonly orders = signal<Order[]>([]);
    readonly notifications = signal<OrderNotification[]>([]);
    readonly pendingReservationsCount = signal(0);
    readonly connectionState = signal<"idle" | "connecting" | "connected" | "error">("idle");
    readonly orderChanged$ = new Subject<Order>();
    readonly reservationCreated$ = new Subject<ReservationDto>();
    readonly reservationChanged$ = new Subject<{ action: "created" | "updated" | "deleted"; reservation: ReservationDto }>();
    readonly feedbackCreated$ = new Subject<FeedbackRealtimeDto>();
    readonly businessRestaurantsChanged$ = new Subject<any>();
    readonly menuUpdated$ = new Subject<{ restaurant_id?: string; reason?: string }>();

    readonly activeOrdersCount = computed(() => {
        return this.orders().filter((order) => this.isActiveOrder(order)).length;
    });

    start(): void {
        if (this.started) return;
        this.started = true;
        this.loadInitialOrders();
        this.refreshReservationsFromApi(true);
        this.connect();
        this.startPollingFallback();
    }

    stop(): void {
        this.started = false;
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        if (this.pollingTimer) clearInterval(this.pollingTimer);
        this.socket?.close();
        this.socket = undefined;
        this.connected = false;
        this.connectionState.set("idle");
    }

    markNotificationsRead(): void {
        this.notifications.set([]);
    }

    private loadInitialOrders(): void {
        this.orderService.list({ active_only: true }).subscribe({
            next: (orders) => this.orders.set(orders),
            error: () => this.orders.set([])
        });
    }

    private startPollingFallback(): void {
        if (this.pollingTimer) clearInterval(this.pollingTimer);
        this.pollingTimer = setInterval(() => {
            if (!this.started) return;
            this.refreshOrdersFromApi();
            this.refreshReservationsFromApi();
        }, 8000);
    }

    private refreshOrdersFromApi(): void {
        const knownIds = new Set(this.orders().map((order) => order.id));

        this.orderService.list({ active_only: true }).subscribe({
            next: (orders) => {
                this.orders.set(orders);

                const freshOrders = orders
                    .filter((order) => order.id && !knownIds.has(order.id) && this.isActiveOrder(order))
                    .slice()
                    .reverse();

                for (const order of freshOrders) {
                    this.orderChanged$.next(order);
                    this.addOrderNotification(order);
                    this.playNotificationSound();
                }
            },
            error: () => {
                if (!this.connected) {
                    this.connectionState.set("error");
                }
            }
        });
    }

    private refreshReservationsFromApi(initial = false): void {
        this.reservationService.list({ status: "pending" }).subscribe({
            next: (reservations) => {
                this.pendingReservationsCount.set(reservations.length);

                if (initial || !this.reservationPollingInitialized) {
                    reservations.forEach((reservation) => this.knownReservationIds.add(reservation.id));
                    this.reservationPollingInitialized = true;
                    return;
                }

                const freshReservations = reservations
                    .filter((reservation) => reservation.id && !this.knownReservationIds.has(reservation.id))
                    .slice()
                    .reverse();

                freshReservations.forEach((reservation) => this.notifyReservation(reservation));
            },
            error: () => undefined
        });
    }

    private connect(): void {
        if (!this.started || this.socket?.readyState === WebSocket.OPEN || this.socket?.readyState === WebSocket.CONNECTING) {
            return;
        }

        const apiUrl = new URL(API_ROOT);
        const host = apiUrl.hostname || window.location.hostname;
        const key = "restaurant-scan-key";
        const port = 8080;
        const protocol = apiUrl.protocol === "https:" ? "wss" : "ws";
        const url = `${protocol}://${host}:${port}/app/${key}?protocol=7&client=angular-native&version=1.0&flash=false`;

        this.connectionState.set("connecting");
        this.socket = new WebSocket(url);

        this.socket.onopen = () => {
            this.zone.run(() => {
                this.connected = true;
                this.connectionState.set("connected");
                this.subscribeToOrders();
                this.subscribeToReservations();
                this.subscribeToFeedbacks();
                this.subscribeToMenu();
                this.subscribeToBusinessRestaurants();
            });
        };

        this.socket.onmessage = (event) => {
            this.zone.run(() => this.handleSocketMessage(event.data));
        };

        this.socket.onerror = () => {
            this.zone.run(() => this.connectionState.set("error"));
        };

        this.socket.onclose = () => {
            this.zone.run(() => {
                this.connected = false;
                if (!this.started) return;
                this.connectionState.set("error");
                this.reconnectTimer = setTimeout(() => this.connect(), 3000);
            });
        };
    }

    private subscribeToOrders(): void {
        const restaurantId = this.authService.getUserData()?.restaurant_id;
        const channel = restaurantId ? `orders.${restaurantId}` : "orders";

        this.send({
            event: "pusher:subscribe",
            data: { channel }
        });
    }

    private subscribeToReservations(): void {
        const restaurantId = this.authService.getUserData()?.restaurant_id;
        const channels = restaurantId
            ? [`reservations.${restaurantId}`, `Réservations.${restaurantId}`]
            : ["reservations", "Réservations"];

        channels.forEach((channel) => {
            this.send({
                event: "pusher:subscribe",
                data: { channel }
            });
        });
    }

    private subscribeToFeedbacks(): void {
        const restaurantId = this.authService.getUserData()?.restaurant_id;
        const channel = restaurantId ? `feedbacks.${restaurantId}` : "feedbacks";

        this.send({
            event: "pusher:subscribe",
            data: { channel }
        });
    }

    private subscribeToMenu(): void {
        const user = this.authService.getUserData();
        const restaurantId = user?.restaurant_id || user?.restaurant?.id;
        if (!restaurantId) return;

        this.send({
            event: "pusher:subscribe",
            data: { channel: `menu.${restaurantId}` }
        });
    }

    private subscribeToBusinessRestaurants(): void {
        const user = this.authService.getUserData();
        const businessOwnerId = user?.restaurant?.business_owner_user_id || user?.id;
        if (!businessOwnerId) return;

        this.send({
            event: "pusher:subscribe",
            data: { channel: `business-restaurants.${businessOwnerId}` }
        });
    }

    private handleSocketMessage(raw: string): void {
        let message: any;
        try {
            message = JSON.parse(raw);
        } catch {
            return;
        }

        if (message.event === "pusher:ping") {
            this.send({ event: "pusher:pong", data: {} });
            return;
        }

        if (message.event === "reservation.created") {
            this.handleReservationCreated(message);
            return;
        }

        if (["reservation.updated", "reservation.deleted"].includes(message.event)) {
            this.handleReservationChanged(message, message.event === "reservation.deleted" ? "deleted" : "updated");
            return;
        }

        if (message.event === "feedback.created") {
            this.handleFeedbackCreated(message);
            return;
        }

        if (message.event === "business-restaurants.updated") {
            this.handleBusinessRestaurantsUpdated(message);
            return;
        }

        if (message.event === "menu.updated") {
            this.handleMenuUpdated(message);
            return;
        }

        if (!["order.placed", "order.status.updated"].includes(message.event)) {
            return;
        }

        const payload = typeof message.data === "string" ? JSON.parse(message.data) : message.data;
        const order = payload?.order as Order | undefined;
        if (!order?.id) return;

        const isNewOrder = message.event === "order.placed" && !this.orders().some((item) => item.id === order.id);
        this.upsertOrder(order);
        this.orderChanged$.next(order);

        if (isNewOrder) {
            this.addOrderNotification(order);
            this.playNotificationSound();
        }
    }

    private handleReservationCreated(message: any): void {
        const payload = typeof message.data === "string" ? JSON.parse(message.data) : message.data;
        const reservation = payload?.reservation as ReservationDto | undefined;
        if (!reservation?.id) return;

        this.notifyReservation(reservation);
    }

    private handleReservationChanged(message: any, action: "updated" | "deleted"): void {
        const payload = typeof message.data === "string" ? JSON.parse(message.data) : message.data;
        const reservation = payload?.reservation as ReservationDto | undefined;
        if (!reservation?.id) return;

        if (action === "deleted") {
            this.knownReservationIds.delete(reservation.id);
            if (reservation.status === "pending") {
                this.pendingReservationsCount.update((count) => Math.max(0, count - 1));
            }
        } else {
            this.knownReservationIds.add(reservation.id);
            this.refreshReservationsFromApi();
        }

        this.reservationChanged$.next({ action, reservation });
    }

    private handleFeedbackCreated(message: any): void {
        const payload = typeof message.data === "string" ? JSON.parse(message.data) : message.data;
        const feedback = payload?.feedback as FeedbackRealtimeDto | undefined;
        if (!feedback?.id) return;

        this.feedbackCreated$.next(feedback);
        this.addFeedbackNotification(feedback);
        this.playNotificationSound();
    }

    private notifyReservation(reservation: ReservationDto): void {
        if (this.knownReservationIds.has(reservation.id)) {
            return;
        }

        this.knownReservationIds.add(reservation.id);
        this.pendingReservationsCount.update((count) => count + 1);
        this.reservationCreated$.next(reservation);
        this.reservationChanged$.next({ action: "created", reservation });
        this.addReservationNotification(reservation);
        this.playNotificationSound();
    }

    private handleBusinessRestaurantsUpdated(message: any): void {
        const payload = typeof message.data === "string" ? JSON.parse(message.data) : message.data;
        this.businessRestaurantsChanged$.next(payload || {});
    }

    private handleMenuUpdated(message: any): void {
        const payload = typeof message.data === "string" ? JSON.parse(message.data) : message.data;
        this.menuUpdated$.next({
            restaurant_id: payload?.restaurant_id,
            reason: payload?.reason || "menu_updated"
        });
    }

    private upsertOrder(order: Order): void {
        this.orders.update((orders) => {
            const exists = orders.some((item) => item.id === order.id);
            const nextOrders = exists
                ? orders.map((item) => item.id === order.id ? { ...item, ...order } : item)
                : [order, ...orders];

            return nextOrders.slice(0, 50);
        });
    }

    private addOrderNotification(order: Order): void {
        const tableName = order.table?.name || "Table inconnue";
        this.notifications.update((items) => [
            {
                id: `${order.id}-${Date.now()}`,
                title: "Nouvelle commande",
                message: `${tableName} - ${Number(order.total_amount || 0).toLocaleString("fr-FR")} ${order.currency}`,
                createdAt: new Date(),
                order,
                route: "/orders/list?status=pending"
            },
            ...items
        ].slice(0, 8));
    }

    private addReservationNotification(reservation: ReservationDto): void {
        this.notifications.update((items) => [
            {
                id: `${reservation.id}-${Date.now()}`,
                title: "Nouvelle réservation",
                message: `${reservation.name} - ${reservation.guests} pers. le ${reservation.reservation_date}`,
                createdAt: new Date(),
                route: "/table/reservation-table"
            },
            ...items
        ].slice(0, 8));
    }

    private addFeedbackNotification(feedback: FeedbackRealtimeDto): void {
        const tableName = feedback.order?.table?.name || feedback.table?.name || "Table inconnue";
        this.notifications.update((items) => [
            {
                id: `${feedback.id}-${Date.now()}`,
                title: "Nouveau feedback",
                message: `${tableName} - avis client recu`,
                createdAt: new Date(),
                route: "/feedback/list"
            },
            ...items
        ].slice(0, 8));
    }

    private playNotificationSound(): void {
        try {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            if (!AudioContextClass) return;

            const context = new AudioContextClass();
            const oscillator = context.createOscillator();
            const gain = context.createGain();

            oscillator.type = "sine";
            oscillator.frequency.setValueAtTime(880, context.currentTime);
            oscillator.frequency.setValueAtTime(660, context.currentTime + 0.12);
            gain.gain.setValueAtTime(0.001, context.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.22, context.currentTime + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.28);

            oscillator.connect(gain);
            gain.connect(context.destination);
            oscillator.start();
            oscillator.stop(context.currentTime + 0.3);
        } catch {
            // Le navigateur peut bloquer l'audio avant une interaction utilisateur.
        }
    }

    private isActiveOrder(order: Order): boolean {
        return !["delivered", "cancelled"].includes(order.status);
    }

    private send(payload: any): void {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
        this.socket.send(JSON.stringify(payload));
    }
}
