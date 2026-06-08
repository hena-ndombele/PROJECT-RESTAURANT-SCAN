export interface CategoryDto {
    id: string;
    image: File | null;
    name: string;
    description: string;
    created_at: string | Date;
    updated_at: string | Date;
}