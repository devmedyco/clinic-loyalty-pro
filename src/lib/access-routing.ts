type AccessRouteInput = {
  isSuperAdmin?: boolean;
  roles?: Array<{ role: string }>;
  tenants?: Array<{ slug: string }>;
};

export function getPostLoginRoute(access: AccessRouteInput) {
  if (access.isSuperAdmin) return "/admin";
  if (access.roles?.some((role) => role.role === "patient")) return "/patient";

  const tenant = access.tenants?.[0];
  if (tenant) return `/app/${tenant.slug}`;

  return "/onboarding";
}
