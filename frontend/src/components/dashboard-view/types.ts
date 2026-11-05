export type DashboardRoute = "/" | "/exams" | "/medications" | "/profile";

export function route_from_path(pathname: string): DashboardRoute {
  if (
    pathname === "/exams" ||
    pathname === "/medications" ||
    pathname === "/profile"
  ) {
    return pathname;
  }
  return "/";
}