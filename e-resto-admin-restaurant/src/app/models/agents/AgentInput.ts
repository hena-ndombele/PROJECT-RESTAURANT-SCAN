interface AgentInput {
    first_name: string;
    last_name: string;
    email: string;
    phone_number: string;
    address: string;
    education_level?: string;
    fonction: string;
    matricule?: string;
    photo?: File | null;
    department?: string;
    status?: string;
    contract_type?: string;
    shift?: string;
    hired_at?: string;
    emergency_contact_name?: string;
    emergency_contact_phone?: string;
}
