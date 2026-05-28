export type AuthPortal = "clinic" | "patient" | "admin";

export type AuthRouteSearch = {
  portal?: unknown;
  redirect?: unknown;
};

export function getPortalFromAuthSearch(search: AuthRouteSearch): AuthPortal {
  const portal = typeof search.portal === "string" ? search.portal : undefined;
  const redirect = getSafeRedirectFromAuthSearch(search) ?? "";

  if (portal === "patient" || redirect.startsWith("/patient")) return "patient";
  if (portal === "admin" || redirect.startsWith("/admin")) return "admin";
  return "clinic";
}

export function getSafeRedirectFromAuthSearch(search: AuthRouteSearch) {
  if (typeof search.redirect !== "string") return null;
  if (!search.redirect.startsWith("/") || search.redirect.startsWith("//")) return null;
  return search.redirect;
}

export function getAuthLinkSearch(search: AuthRouteSearch) {
  const portal = typeof search.portal === "string" ? search.portal : undefined;
  const redirect = getSafeRedirectFromAuthSearch(search);
  return {
    ...(portal ? { portal } : {}),
    ...(redirect ? { redirect } : {}),
  };
}
