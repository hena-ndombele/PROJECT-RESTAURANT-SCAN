export interface ApiResponse {
    message: string;
    order: Order;
}

export interface Order {
    id: string;
    table_id: string;
    note: string | null;
    status: 'pending' | 'preparing' | 'ready' | 'paid' | 'delivered' | 'cancelled';
    total_amount: number;
    currency: string;
    created_at: string;
    updated_at: string;
    items: OrderItem[];
    // Si vous chargez aussi la table via Eloquent
    table?: Table;
}

export interface OrderItem {
    id: string;
    order_id: string;
    plat_id: string;
    quantity: number;
    price_at_order: string; // Reçu comme string depuis l'API (Decimal)
    created_at: string;
    updated_at: string;
    plat: Plat;
}

export interface Plat {
    id: string;
    name: string;
    description: string;
    price: string;
    currency: string;
    preparation_time: number;
    is_available: boolean;
    ingredients: string[];
    image: string;
    image_secondaire_1: string | null;
    image_secondaire_2: string | null;
    category_id: string;
    created_at: string;
    updated_at: string;
}

export interface Table {
    id: string;
    name: string;
    status: string;
}
