import { RoleDto } from "../roles/RoleDto";
import { AgentDto } from "../agents/AgentDto";

export interface UserDto {
  id: string;
  agent_id?: string | null;
  first_name: string;
  last_name: string;
  email: string;
  phone_number?: string | null;
  address?: string | null;
  is_first_login?: boolean;
  agent?: AgentDto | null;
  roles?: RoleDto[];
  created_at?: string;
  updated_at?: string;
}
