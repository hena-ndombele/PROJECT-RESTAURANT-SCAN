export interface Category {
    id: number;
    name: string;
    description: string;
    image: string;
    created_at: string;
    updated_at: string;
}

export interface DishDto {
    id: string;
    name: string;
    description: string;
    price: string; // Ou number selon ton retour API
    promotion_percent?: number | string | null;
    promotion_ends_at?: string | null;
    is_promotion_active?: boolean;
    promotion_price?: number | string | null;
    currency: string; // Ajouté: CDF ou USD
    category_id: string | number;

    // Champs de gestion ajoutés
    preparation_time: number; // Ajouté
    is_available: boolean | number; // Ajouté (pour le switch stock)
    ingredients?: string[] | string; // Ajouté (si tu les stockes en JSON ou relation)
    sizes?: string[] | string | null;

    // Gestion des images
    // Note: En réception API c'est souvent une string (URL),
    // en envoi c'est un File. On utilise 'any' ou string pour le DTO de réception.
    image: string | null;
    image_secondaire_1?: string | null; // Ajouté
    image_secondaire_2?: string | null; // Ajouté

    created_at: string;
    updated_at: string;

    // Relation
    category?: Category | null;
}

export interface CreatePlatResponse {
    message: string;
    status: boolean; // Souvent présent dans tes retours Laravel
    data: DishDto;
}
