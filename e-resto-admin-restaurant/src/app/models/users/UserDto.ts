import { RoleDto } from "../roles/RoleDto";

export interface UserDto {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number?: string | null;
  address?: string | null;
  is_first_login?: boolean;
  roles?: RoleDto[];
  created_at?: string;
  updated_at?: string;
}
