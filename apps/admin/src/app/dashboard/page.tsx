import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Dashboard — Executive Concierge Admin',
};

// Mock data for the dashboard
const stats = [
  { label: 'Active Users', value: '12', change: '+2 this week' },
  { label: 'Open Requests', value: '7', change: '3 urgent' },
  { label: 'Active Conversations', value: '4', change: '1 awaiting handoff' },
  { label: 'Avg. Resolution Time', value: '1.8h', change: '-12 min vs last week' },
];

const recentRequests = [
  {
    id: '1',
    user: 'James Richardson',
    title: 'Table booking at Maní — tonight 8:30 PM',
    status: 'IN_PROGRESS',
    priority: 'HIGH',
    updatedAt: '2h ago',
  },
  {
    id: '2',
    user: 'Sarah Mitchell',
    title: 'Airport transfer to GRU — Friday 18:00',
    status: 'ACKNOWLEDGED',
    priority: 'NORMAL',
    updatedAt: '5h ago',
  },
  {
    id: '3',
    user: 'David Chen',
    title: 'Spa session recommendation + booking',
    status: 'PENDING',
    priority: 'LOW',
    updatedAt: '6h ago',
  },
];

const STATUS_COLORS: Record<string, string> = {
  PENDING: '#5A5A5A',
  ACKNOWLEDGED: '#1976D2',
  IN_PROGRESS: '#C9A96E',
  COMPLETED: '#4CAF50',
  CANCELLED: '#E53935',
};

export default function DashboardPage() {
  return (
    <div style={styles.page}>
      {/* Sidebar */}
      <aside style={styles.sidebar}>
        <div style={styles.sidebarBrand}>
          <span style={styles.brandAccent}>EXECUTIVE</span>
          <span style={styles.brandName}>Concierge SP</span>
          <span style={styles.brandBadge}>Admin</span>
        </div>

        <nav style={styles.nav}>
          {[
            { href: '/dashboard', label: 'Dashboard' },
            { href: '/conversations', label: 'Conversations' },
            { href: '/requests', label: 'Requests' },
            { href: '/users', label: 'Users' },
            { href: '/catalog', label: 'Catalog' },
            { href: '/settings', label: 'Settings' },
          ].map((item) => (
            <Link key={item.href} href={item.href} style={styles.navLink}>
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <main style={styles.main}>
        <header style={styles.header}>
          <div>
            <h1 style={styles.pageTitle}>Dashboard</h1>
            <p style={styles.pageSubtitle}>Operations overview — São Paulo</p>
          </div>
          <div style={styles.headerActions}>
            <span style={styles.onlineIndicator}>● Online</span>
          </div>
        </header>

        {/* Stats */}
        <div style={styles.statsGrid}>
          {stats.map((stat) => (
            <div key={stat.label} style={styles.statCard}>
              <div style={styles.statValue}>{stat.value}</div>
              <div style={styles.statLabel}>{stat.label}</div>
              <div style={styles.statChange}>{stat.change}</div>
            </div>
          ))}
        </div>

        {/* Recent requests */}
        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionTitle}>Recent Requests</h2>
            <Link href="/requests" style={styles.seeAll}>
              See all →
            </Link>
          </div>

          <div style={styles.table}>
            <div style={styles.tableHeader}>
              <span style={{ flex: 2 }}>REQUEST</span>
              <span style={{ flex: 1 }}>USER</span>
              <span style={{ flex: 1 }}>STATUS</span>
              <span style={{ flex: 1 }}>PRIORITY</span>
              <span style={{ flex: 1 }}>UPDATED</span>
            </div>
            {recentRequests.map((req) => (
              <Link
                key={req.id}
                href={`/requests/${req.id}`}
                style={styles.tableRow}
              >
                <span style={{ flex: 2, color: '#E8E5E0' }}>{req.title}</span>
                <span style={{ flex: 1, color: '#9A9A9A' }}>{req.user}</span>
                <span style={{ flex: 1 }}>
                  <span
                    style={{
                      ...styles.badge,
                      borderColor: STATUS_COLORS[req.status] ?? '#5A5A5A',
                      color: STATUS_COLORS[req.status] ?? '#5A5A5A',
                    }}
                  >
                    {req.status.replace('_', ' ')}
                  </span>
                </span>
                <span style={{ flex: 1, color: '#9A9A9A' }}>{req.priority}</span>
                <span style={{ flex: 1, color: '#5A5A5A' }}>{req.updatedAt}</span>
              </Link>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

// Inline styles (would use CSS modules or Tailwind in production)
const styles: Record<string, React.CSSProperties> = {
  page: {
    display: 'flex',
    minHeight: '100vh',
    backgroundColor: '#0A0A0A',
  },
  sidebar: {
    width: 220,
    backgroundColor: '#141414',
    borderRight: '1px solid #2C2C2C',
    padding: '24px 0',
    flexShrink: 0,
    position: 'fixed',
    top: 0,
    left: 0,
    height: '100vh',
  },
  sidebarBrand: {
    padding: '0 20px 24px',
    borderBottom: '1px solid #2C2C2C',
    marginBottom: 8,
  },
  brandAccent: {
    display: 'block',
    fontSize: 10,
    fontWeight: 600,
    color: '#C9A96E',
    letterSpacing: 2,
    marginBottom: 4,
  },
  brandName: {
    display: 'block',
    fontSize: 16,
    fontWeight: 300,
    color: '#FFFFFF',
    marginBottom: 6,
  },
  brandBadge: {
    display: 'inline-block',
    fontSize: 10,
    backgroundColor: '#2C2C2C',
    color: '#9A9A9A',
    padding: '2px 8px',
    borderRadius: 4,
  },
  nav: {
    display: 'flex',
    flexDirection: 'column',
    padding: '8px 0',
  },
  navLink: {
    display: 'block',
    padding: '10px 20px',
    color: '#9A9A9A',
    textDecoration: 'none',
    fontSize: 14,
    transition: 'color 0.15s',
  },
  main: {
    marginLeft: 220,
    flex: 1,
    padding: 32,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 32,
    paddingBottom: 24,
    borderBottom: '1px solid #2C2C2C',
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: 300,
    color: '#FFFFFF',
    margin: 0,
    marginBottom: 4,
  },
  pageSubtitle: {
    fontSize: 13,
    color: '#9A9A9A',
    margin: 0,
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
  },
  onlineIndicator: {
    fontSize: 12,
    color: '#4CAF50',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 16,
    marginBottom: 32,
  },
  statCard: {
    backgroundColor: '#141414',
    borderRadius: 10,
    padding: '20px 24px',
    border: '1px solid #2C2C2C',
  },
  statValue: {
    fontSize: 32,
    fontWeight: 300,
    color: '#FFFFFF',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#9A9A9A',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  statChange: {
    fontSize: 12,
    color: '#C9A96E',
  },
  section: {
    backgroundColor: '#141414',
    borderRadius: 10,
    border: '1px solid #2C2C2C',
    overflow: 'hidden',
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 24px',
    borderBottom: '1px solid #2C2C2C',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 500,
    color: '#FFFFFF',
    margin: 0,
  },
  seeAll: {
    fontSize: 13,
    color: '#C9A96E',
    textDecoration: 'none',
  },
  table: {
    display: 'flex',
    flexDirection: 'column',
  },
  tableHeader: {
    display: 'flex',
    padding: '10px 24px',
    fontSize: 10,
    fontWeight: 600,
    color: '#5A5A5A',
    letterSpacing: 1,
    borderBottom: '1px solid #2C2C2C',
  },
  tableRow: {
    display: 'flex',
    alignItems: 'center',
    padding: '16px 24px',
    borderBottom: '1px solid #1E1E1E',
    textDecoration: 'none',
    fontSize: 13,
    transition: 'background 0.15s',
    cursor: 'pointer',
  },
  badge: {
    display: 'inline-block',
    fontSize: 10,
    fontWeight: 600,
    padding: '2px 6px',
    borderRadius: 4,
    border: '1px solid',
    letterSpacing: 0.5,
  },
};
