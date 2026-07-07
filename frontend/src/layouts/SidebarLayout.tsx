import { useState, useEffect } from 'react';
import { Outlet, NavLink, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';
import { SyncIndicator } from '../components/SyncIndicator';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useToast } from '../hooks/useToast';
import { useSyncStatus } from '../hooks/useSyncStatus';

export function SidebarLayout() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const { pendingCount } = useSyncStatus();
  const location = useLocation();

  const isCompany = user ? user.role === 'company' : true;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [logoutConfirm, setLogoutConfirm] = useState(false);

  const handleLogoutClick = () => {
    // Only show confirm dialog if there are pending sync jobs
    if (pendingCount > 0) {
      setLogoutConfirm(true);
    } else {
      handleLogout();
    }
  };

  // Close drawer on route change
  useEffect(() => { setDrawerOpen(false); }, [location.pathname]);

  // Close drawer on ESC
  useEffect(() => {
    if (!drawerOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setDrawerOpen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [drawerOpen]);

  // Block scroll when drawer open on mobile
  useEffect(() => {
    if (drawerOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [drawerOpen]);

  const handleLogout = async () => {
    setLogoutConfirm(false);
    await logout();
    toast.info('You have been signed out.');
  };

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    isActive
      ? 'bg-primary-container text-on-primary-container border-2 border-on-background shadow-[4px_4px_0px_#1A1A1A] m-2 p-3 flex items-center gap-3 font-bold'
      : 'text-on-surface-variant hover:bg-surface-container-highest p-3 mx-2 my-0.5 flex items-center gap-3 transition-all border-2 border-transparent hover:border-on-background';

  const NavContent = () => (
    <>
      {/* Brand */}
      <div className="px-5 mb-6 flex flex-col gap-1">
        <div className="flex items-center gap-3 mb-3">
          <img
            alt="GMPL Logo"
            className="h-10 w-10 object-contain border-2 border-on-background p-1 bg-surface-container-low shadow-[2px_2px_0px_#1A1A1A]"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuC-5H4T5-mbUEyLKE5ecWjl7tzHoeA0zydTTKrVcADfIqDlHfNcBvJrZWiw1ZWkUjvzGqw5sPKm9Up14Sa68b5NehYxuADDt8Z5wUfxRdpuSG-cEs6vJ6f2U90AIcbrs6k_pv-tECi_eOUsT6-kO7l6OqyIg09tzSq34ECwSYHw1FVENmLxLp_584pY3PW8lcu13BrttzNW5Itcs-7kQm3HMYAcvBJh3fuoaTchj9XEuxa6rhyRlTAS7Dnkf0MDLRV0EJCpxRSG9-6S"
          />
          <div>
            <h1 className="font-headline-md text-headline-md text-deep-orange tracking-tight leading-none">GANES METPLAST</h1>
            <p className="font-label-sm text-[11px] text-on-surface-variant uppercase mt-0.5">
              {isCompany ? 'Admin Console' : 'Vendor Portal'}
            </p>
          </div>
        </div>
      </div>

      {/* Quick action for vendors */}
      {!isCompany && (
        <div className="px-4 mb-5">
          <Link
            to="/moulds"
            className="w-full bg-deep-orange text-white border-2 border-on-background py-3 text-sm font-bold uppercase flex items-center justify-center gap-2 neo-shadow hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_#1A1A1A] transition-all"
          >
            <span className="material-symbols-outlined fill-icon text-[18px]">add_circle</span>
            Log Production
          </Link>
        </div>
      )}

      {/* Nav links */}
      <div className="flex-1 flex flex-col gap-0.5 px-2 overflow-y-auto">
        <NavLink to="/" end className={navLinkClass}>
          <span className="material-symbols-outlined fill-icon">home</span>
          <span className="font-label-sm text-label-sm">{isCompany ? 'Dashboard' : 'Home'}</span>
        </NavLink>

        <NavLink to="/logs" className={navLinkClass}>
          <span className="material-symbols-outlined fill-icon">history</span>
          <span className="font-label-sm text-label-sm">{isCompany ? 'Global Logs' : 'My Logs'}</span>
        </NavLink>

        <NavLink to="/moulds" className={navLinkClass}>
          <span className="material-symbols-outlined">precision_manufacturing</span>
          <span className="font-label-sm text-label-sm">{isCompany ? 'Moulds' : 'My Moulds'}</span>
        </NavLink>

        {isCompany && (
          <NavLink to="/materials" className={navLinkClass}>
            <span className="material-symbols-outlined">inventory_2</span>
            <span className="font-label-sm text-label-sm">Materials</span>
          </NavLink>
        )}

        {isCompany && (
          <NavLink to="/vendors" className={navLinkClass}>
            <span className="material-symbols-outlined">factory</span>
            <span className="font-label-sm text-label-sm">Vendors</span>
          </NavLink>
        )}

        {isCompany && (
          <NavLink to="/repairs" className={navLinkClass}>
            <span className="material-symbols-outlined">build</span>
            <span className="font-label-sm text-label-sm">Repairs</span>
          </NavLink>
        )}

        <NavLink to="/edit-requests" className={navLinkClass}>
          <span className="material-symbols-outlined">edit_document</span>
          <span className="font-label-sm text-label-sm">{isCompany ? 'Approval Queue' : 'My Requests'}</span>
        </NavLink>

        {isCompany && (
          <NavLink to="/analytics" className={navLinkClass}>
            <span className="material-symbols-outlined">analytics</span>
            <span className="font-label-sm text-label-sm">Analytics</span>
          </NavLink>
        )}

        {isCompany && (
          <NavLink to="/copilot" className={navLinkClass}>
            <span className="material-symbols-outlined">smart_toy</span>
            <span className="font-label-sm text-label-sm">Copilot</span>
          </NavLink>
        )}
      </div>

      {/* Footer */}
      <div className="mt-auto border-t-2 border-on-background p-4 flex flex-col gap-1 bg-surface-container-low">
        <NavLink to="/settings" className={navLinkClass}>
          <span className="material-symbols-outlined text-[20px]">settings</span>
          <span className="font-label-sm text-label-sm">Settings</span>
        </NavLink>

        <NavLink to="/support" className={navLinkClass}>
          <span className="material-symbols-outlined text-[20px]">help</span>
          <span className="font-label-sm text-label-sm">Support</span>
        </NavLink>

        <button
          onClick={() => setLogoutConfirm(true)}
          className="text-danger hover:bg-surface-container-highest p-2 mx-2 my-1 flex items-center gap-3 transition-all border-2 border-transparent hover:border-on-background text-left w-[calc(100%-1rem)]"
        >
          <span className="material-symbols-outlined text-[20px]">logout</span>
          <span className="font-label-sm text-label-sm">Sign Out</span>
        </button>
        <SyncIndicator />
      </div>
    </>
  );

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background">
      {/* ── Mobile Top App Bar ─────────────────────────────────────── */}
      <header className="sticky top-0 z-50 flex justify-between items-center px-4 py-3 w-full bg-surface border-b-2 border-on-background shadow-[0px_4px_0px_#1A1A1A] md:hidden">
        <div className="flex items-center gap-3">
          {/* Hamburger */}
          <button
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
            className="w-10 h-10 flex items-center justify-center border-2 border-on-background bg-surface-container-low hover:bg-surface-variant transition-colors neo-shadow-sm"
          >
            <span className="material-symbols-outlined text-[22px]">menu</span>
          </button>
          <div>
            <span className="text-headline-sm font-black tracking-tighter text-deep-orange block leading-none">GANES METPLAST</span>
            <span className="text-[10px] font-label-sm uppercase text-on-surface-variant">
              {isCompany ? 'Admin Console' : 'Vendor Portal'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isCompany && (
            <Link
              to="/moulds"
              className="bg-deep-orange text-white border-2 border-on-background px-3 py-1.5 font-label-sm text-[11px] uppercase font-bold flex items-center gap-1 neo-shadow-sm"
            >
              <span className="material-symbols-outlined fill-icon text-[16px]">add_circle</span>
              Log
            </Link>
          )}
          <button
            onClick={handleLogoutClick}
            aria-label="Sign out"
            className="w-9 h-9 flex items-center justify-center text-danger"
          >
            <span className="material-symbols-outlined text-[22px]">logout</span>
          </button>
        </div>
      </header>

      {/* ── Mobile Bottom Nav Bar ──────────────────────────────────── */}
      <nav
        aria-label="Mobile bottom navigation"
        className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-surface border-t-2 border-on-background shadow-[0px_-4px_0px_#1A1A1A] flex items-stretch"
      >
        {(isCompany ? [
          { to: '/', icon: 'home', label: 'Dashboard', end: true },
          { to: '/moulds', icon: 'precision_manufacturing', label: 'Moulds' },
          { to: '/vendors', icon: 'factory', label: 'Vendors' },
          { to: '/repairs', icon: 'build', label: 'Repairs' },
          { to: '/edit-requests', icon: 'edit_document', label: 'Approvals' },
        ] : [
          { to: '/', icon: 'home', label: 'Home', end: true },
          { to: '/moulds', icon: 'precision_manufacturing', label: 'My Moulds' },
          { to: '/logs', icon: 'history', label: 'Logs' },
          { to: '/edit-requests', icon: 'edit_document', label: 'Requests' },
          { to: '/logs/new', icon: 'add_circle', label: 'Log', end: false },
        ]).map(item => (
          <NavLink
            key={item.to + item.label}
            to={item.to}
            end={'end' in item ? item.end : false}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center gap-0.5 py-2 px-1 transition-colors ${
                isActive
                  ? 'bg-primary-container text-on-primary-container'
                  : 'text-on-surface-variant hover:bg-surface-container-low'
              }${item.label === 'Log' ? ' bg-deep-orange text-white hover:bg-deep-orange' : ''}`
            }
          >
            <span className="material-symbols-outlined fill-icon text-[22px]">{item.icon}</span>
            <span className="font-label-sm text-[10px] uppercase">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* ── Mobile Drawer Overlay ──────────────────────────────────── */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-[60] md:hidden"
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        >
          <div className="absolute inset-0 bg-on-background/50 backdrop-blur-sm" />
        </div>
      )}

      {/* ── Mobile Drawer Panel ────────────────────────────────────── */}
      <aside
        className={`
          fixed left-0 top-0 h-full z-[70] w-72 bg-surface border-r-2 border-on-background
          shadow-[8px_0px_0px_#1A1A1A] flex flex-col pt-4 overflow-hidden
          transition-transform duration-300 ease-in-out md:hidden
          ${drawerOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
        aria-label="Navigation drawer"
      >
        {/* Close button inside drawer */}
        <button
          onClick={() => setDrawerOpen(false)}
          aria-label="Close menu"
          className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center border-2 border-on-background bg-surface-container-low hover:bg-surface-variant transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">close</span>
        </button>
        <NavContent />
      </aside>

      {/* ── Desktop Sidebar ────────────────────────────────────────── */}
      <nav className="hidden md:flex fixed left-0 top-0 h-full flex-col pt-8 z-40 bg-surface border-r-2 border-on-background shadow-[6px_0px_0px_#1A1A1A] w-64 overflow-y-auto">
        <NavContent />
      </nav>

      {/* ── Main Content Canvas ────────────────────────────────────── */}
      <main className="flex-1 md:ml-64 flex flex-col relative overflow-y-auto min-h-0 pb-16 md:pb-0">
        <Outlet />
      </main>

      {/* ── Logout Confirmation ────────────────────────────────────── */}
      <ConfirmDialog
        open={logoutConfirm}
        title="Sign Out?"
        description={`${pendingCount > 0 ? `You have ${pendingCount} unsynced change${pendingCount > 1 ? 's' : ''} in queue. ` : ''}Any queued data will be saved locally and pushed when you log back in. Make sure you're connected before logging out to ensure all production logs are saved.`}
        confirmLabel="Sign Out"
        cancelLabel="Stay Logged In"
        severity="warning"
        onConfirm={handleLogout}
        onCancel={() => setLogoutConfirm(false)}
      />
    </div>
  );
}
