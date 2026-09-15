// Small monochrome line icons, inline rather than a dependency — matches the sidebar reference
// (shadow.co's product UI): a compact icon + label per nav row, no icon font/library installed.
function Icon({ d }: { d: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

const ICONS = {
  home: "M4 11.5 12 4l8 7.5M6 10v9a1 1 0 0 0 1 1h4v-6h2v6h4a1 1 0 0 0 1-1v-9",
  chart: "M4 20V10M12 20V4M20 20v-7",
  users: "M8 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM2.5 20c0-3.3 2.5-6 5.5-6s5.5 2.7 5.5 6M17 11a3 3 0 1 0 0-6M15 6.2A3 3 0 0 1 21.5 8c0 1.4-.9 2.6-2.2 3M15.5 20c0-2.8-1.9-5.2-4.5-5.9M21.5 20c0-2.4-1.4-4.5-3.5-5.5",
  briefcase: "M4 8h16v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V8ZM8 8V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M4 13h16",
  check: "M5 12l5 5L20 7",
  shield: "M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3ZM9 12l2 2 4-4",
  eye: "M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12ZM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
};

interface NavItem {
  href: string;
  label: string;
  icon: keyof typeof ICONS;
  badge?: number;
}

export function InternalSidebar({ owner, pendingUsersCount, email }: { owner: boolean; pendingUsersCount: number; email: string }) {
  const ownerItems: NavItem[] = [
    { href: "/internal", label: "Home", icon: "home" },
    { href: "/internal/marketing", label: "Marketing Efforts", icon: "chart" },
    { href: "/internal/crm", label: "CRM", icon: "briefcase" },
    { href: "/internal/employees", label: "Employees", icon: "users" },
    { href: "/internal/tasks", label: "Tasks", icon: "check" },
    { href: "/internal/approvals", label: "Sign Up Approval", icon: "shield", badge: pendingUsersCount },
    { href: "/internal/view-as", label: "View as", icon: "eye" },
  ];
  const employeeItems: NavItem[] = [
    { href: "/internal", label: "Your brands", icon: "home" },
    { href: "/internal/my-tasks", label: "My tasks", icon: "check" },
  ];
  const items = owner ? ownerItems : employeeItems;

  return (
    <aside className="app-sidebar">
      <div className="app-sidebar-workspace">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/icon-mark-dark.svg" alt="" width={18} height={18} />
        <span>Flagship Growth</span>
      </div>

      <nav className="app-sidebar-nav">
        {items.map((item) => (
          <a key={item.href} href={item.href} className="app-sidebar-link">
            <Icon d={ICONS[item.icon]} />
            <span>{item.label}</span>
            {!!item.badge && item.badge > 0 && <span className="app-sidebar-badge">{item.badge}</span>}
          </a>
        ))}
      </nav>

      <div className="app-sidebar-footer">
        <small>{email}</small>
      </div>
    </aside>
  );
}
