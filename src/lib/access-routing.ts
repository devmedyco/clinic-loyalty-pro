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

export function getPostAuthRoute(access: AccessRouteInput, requestedRoute?: string | null) {
  if (!requestedRoute) return getPostLoginRoute(access);
  if (isAlwaysAllowedAuthRoute(requestedRoute)) return requestedRoute;
  if (routeMatchesAccess(access, requestedRoute)) return requestedRoute;
  return getPostLoginRoute(access);
}

function routeMatchesAccess(access: AccessRouteInput, route: string) {
  if (route === "/admin" || route.startsWith("/admin/")) return Boolean(access.isSuperAdmin);
  if (route === "/patient" || route.startsWith("/patient/")) {
    return Boolean(access.roles?.some((role) => role.role === "patient"));
  }
  if (route === "/onboarding") return getPostLoginRoute(access) === "/onboarding";
  if (route.startsWith("/app/")) {
    if (access.isSuperAdmin) return true;
    const slug = route.split("/")[2];
    return Boolean(slug && access.tenants?.some((tenant) => tenant.slug === slug));
  }
  return false;
}

function isAlwaysAllowedAuthRoute(route: string) {
  return (
    route === "/reset-password" ||
    route.startsWith("/invite/") ||
    route.startsWith("/patient-invite/")
  );
}
