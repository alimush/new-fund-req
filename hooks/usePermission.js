import { usePermissionContext } from "@/context/PermissionContext";

export default function usePermission(permissionName) {
  const { permissions, loading } = usePermissionContext();
  if (loading) return false;
  return permissions.includes(permissionName);
}