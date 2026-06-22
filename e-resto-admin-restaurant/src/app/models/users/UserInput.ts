export interface UserInput {
  agent_id?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone_number?: string | null;
  address?: string | null;
  password?: string | null;
  role?: string | null;
  roles?: string[];
  is_first_login?: boolean;
}
