export interface TableDto {
    id: number;
    name: string;
    qr_code?: string | null;
    capacity: string;
    status: string;
    created_at: string | Date;
    updated_at: string | Date;
    qr_url?: string | null;
}