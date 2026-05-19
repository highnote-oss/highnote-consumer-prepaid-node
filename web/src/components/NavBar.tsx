import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useEnvironment } from "../context/EnvironmentContext";

export function NavBar() {
  const { user, logout } = useAuth();
  const { isTestEnv } = useEnvironment();
  const { pathname } = useLocation();

  function navLink(to: string, label: string) {
    const active = pathname === to;
    return (
      <Link
        to={to}
        className={`px-3 py-1.5 text-sm no-underline rounded-md transition-all duration-200 ${
          active
            ? "bg-navy-100 text-navy-900 font-medium"
            : "text-navy-500 hover:text-navy-800 hover:bg-navy-50"
        }`}
      >
        {label}
      </Link>
    );
  }

  return (
    <nav className="bg-white/80 backdrop-blur-lg border-b border-navy-100 sticky top-0 z-40">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-2.5">
        <Link
          to="/"
          className="text-lg font-bold tracking-tight text-brand-700 no-underline flex items-center gap-1.5"
        >
          <img src="/favicon.svg" alt="Bay19" className="w-7 h-7" />
          Bay19
          {isTestEnv && (
            <span className="ml-1 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide rounded-full bg-amber-100 text-amber-700 border border-amber-200">
              Test
            </span>
          )}
        </Link>
        <div className="flex items-center gap-1">
          {navLink("/", "Dashboard")}
          {navLink("/apply", "Apply")}
          {isTestEnv && (
            <Link
              to="/simulate"
              className={`px-3 py-1.5 text-sm no-underline rounded-md transition-all duration-200 ${
                pathname === "/simulate"
                  ? "bg-amber-100 text-amber-800 font-medium"
                  : "text-amber-600 hover:bg-amber-50"
              }`}
            >
              Simulate
            </Link>
          )}
          {navLink("/webhooks", "Events")}
          {navLink("/profile", user?.email ?? "Profile")}
          <button
            onClick={logout}
            className="ml-1 px-3 py-1.5 text-sm text-navy-400 hover:text-navy-700 rounded-md hover:bg-navy-50 transition-all duration-200"
          >
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}
