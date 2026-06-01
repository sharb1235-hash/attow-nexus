import { NavLink, Outlet } from "react-router-dom";

const links = [
  ["/", "Home"],
  ["/bus", "Agent Bus"],
  ["/channels", "Channels"],
  ["/ledger", "Ledger"],
  ["/diff", "Diff"],
  ["/replay", "Replay"],
  ["/fork", "Fork"],
  ["/rollback", "Rollback"],
  ["/loops", "Loops"],
  ["/metrics", "Metrics"]
];

export function Layout() {
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">Nexus</div>
        <nav>
          {links.map(([to, label]) => (
            <NavLink key={to} to={to} end={to === "/"}>
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <Outlet />
    </div>
  );
}

