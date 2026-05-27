export interface AccountRequestDto {
    id: number;
    username: string;
    phone: string;
    message: string;
    status: 'pending' | 'approved' | 'rejected' | string; // Utilisation d'une union de types pour le statut
    created_at: string | Date;
    updated_at: string | Date;
}