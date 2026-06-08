export interface ApiResponse {
    message: string;
    order: Order;
}

export interface Order {
    id: string;
    table_id: string;
    tracking_code?: string | null;
    order_type?: 'dine_in' | 'takeaway' | string;
    pickup_name?: string | null;
    pickup_phone?: string | null;
    note: string | null;
    customer_name?: string | null;
    customer_phone?: string | null;
    customer_email?: string | null;
    status: 'pending' | 'preparing' | 'ready' | 'delivered' | 'cancelled';
    payment_status: 'unpaid' | 'pending' | 'paid' | 'failed' | 'refunded';
    payment_method: 'cash' | 'mobile_money' | string;
    payment_provider?: string | null;
    cancellation_reason?: string | null;
    cancelled_at?: string | null;
    cancelled_by?: string | null;
    total_amount: number;
    currency: string;
    created_at: string;
    updated_at: string;
    items: OrderItem[];
    latest_payment?: PaymentDto | null;
    // Si vous chargez aussi la table via Eloquent
    table?: Table;
}

export interface PaymentDto {
    id: string;
    order_id: string;
    method: string;
    provider: string | null;
    status: string;
    amount: string | number;
    currency: string;
    reference: string | null;
    metadata?: any;
    paid_at?: string | null;
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
