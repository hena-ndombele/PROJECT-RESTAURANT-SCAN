import { PermissionDto } from "../permissions/PermissionDto";

export interface RoleDto {
  id: number;
  name: string;
  guard_name?: string;
  permissions?: PermissionDto[];
  created_at?: string;
  updated_at?: string;
}
