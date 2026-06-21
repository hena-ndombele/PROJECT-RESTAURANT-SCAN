export interface AgentDto {
    id: string;
    matricule?: string;
    first_name: string;
    last_name: string;
    email: string;
    photo?: string | null;
    photo_url?: string | null;
    phone_number: string;
    address: string;
    education_level?: string;
    fonction: string;
    department?: string;
    status?: string;
    contract_type?: string;
    shift?: string;
    hired_at?: string;
    emergency_contact_name?: string;
    emergency_contact_phone?: string;
    user_id?: string;
    created_at?: Date;
    updated_at?: Date;
}
