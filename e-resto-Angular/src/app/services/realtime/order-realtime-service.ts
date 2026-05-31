import { Injectable, NgZone, computed, inject, signal } from "@angular/core";
import { Subject } from "rxjs";
import { Order } from "../../models/orders/OrderDto";
import { AuthService } from "../auth/auth-service";
import { OderService } from "../orders/oder-service";

interface OrderNotification {
    id: string;
    title: string;
    message: string;
    createdAt: Date;
    order: Order;
}

@Injectable({
    providedIn: "root"
})
export class OrderRealtimeService {
    private readonly orderService = inject(OderService);
    private readonly authService = inject(AuthService);
    private readonly zone = inject(NgZone);

    private socket?: WebSocket;
    private reconnectTimer?: ReturnType<typeof setTimeout>;
    private connected = false;
    private started = false;

    readonly orders = signal<Order[]>([]);
    readonly notifications = signal<OrderNotification[]>([]);
    readonly connectionState = signal<"idle" | "connecting" | "connected" | "error">("idle");
    readonly orderChanged$ = new Subject<Order>();

    readonly activeOrdersCount = computed(() => {
        return this.orders().filter((order) => this.isActiveOrder(order)).length;
    });

    start(): void {
        if (this.started) return;
        this.started = true;
        this.loadInitialOrders();
        this.connect();
    }

    stop(): void {
        this.started = false;
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        this.socket?.close();
        this.socket = undefined;
        this.connected = false;
        this.connectionState.set("idle");
    }

    markNotificationsRead(): void {
        this.notifications.set([]);
    }

    private loadInitialOrders(): void {
        this.orderService.list({ year: String(new Date().getFullYear()) }).subscribe({
            next: (orders) => this.orders.set(orders),
            error: () => this.orders.set([])
        });
    }

    private connect(): void {
        if (!this.started || this.socket?.readyState === WebSocket.OPEN || this.socket?.readyState === WebSocket.CONNECTING) {
            return;
        }

        const host = window.location.hostname;
        const key = "e-resto-key";
        const port = 8080;
        const protocol = window.location.protocol === "https:" ? "wss" : "ws";
        const url = `${protocol}://${host}:${port}/app/${key}?protocol=7&client=angular-native&version=1.0&flash=false`;

        this.connectionState.set("connecting");
        this.socket = new WebSocket(url);

        this.socket.onopen = () => {
            this.zone.run(() => {
                this.connected = true;
                this.connectionState.set("connected");
                this.subscribeToOrders();
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
            this.addNotification(order);
            this.playNotificationSound();
        }
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

    private addNotification(order: Order): void {
        const tableName = order.table?.name || "Table inconnue";
        this.notifications.update((items) => [
            {
                id: `${order.id}-${Date.now()}`,
                title: "Nouvelle commande",
                message: `${tableName} - ${Number(order.total_amount || 0).toLocaleString("fr-FR")} ${order.currency}`,
                createdAt: new Date(),
                order
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
