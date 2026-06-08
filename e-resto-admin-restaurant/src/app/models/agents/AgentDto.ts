export interface AgentDto {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone_number: string;
    address: string;
    education_level: string;
    fonction: string;
    user_id?: string;
    created_at?: Date;
    updated_at?: Date;
}