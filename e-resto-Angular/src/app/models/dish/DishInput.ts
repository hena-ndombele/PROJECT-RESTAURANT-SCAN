export interface DishInput {
    id?: number;
    name: string;
    price: number;
    currency: string;
    category_id: number;
    preparation_time: number;
    is_available: boolean;
    ingredients: string[];
    main_image?: File | string;
    thumbnail_1?: File | string;
    thumbnail_2?: File | string;
    main_image_url?: string;
}