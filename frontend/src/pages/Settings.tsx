import { useAuth } from '../contexts/useAuth';

export function Settings() {
  const { user } = useAuth();
  
  return (
    <div className="flex-1 p-margin">
      <header className="mb-8 border-b-4 border-on-background border-dashed pb-4">
        <h1 className="font-display-lg text-display-lg text-on-background uppercase tracking-tight">System Settings</h1>
        <p className="font-body-lg text-body-lg text-on-surface-variant mt-2">Manage preferences, notifications, and user access.</p>
      </header>

      <div className="max-w-3xl flex flex-col gap-8">
        <section className="bg-surface border-2 border-on-background neo-shadow p-6">
          <h2 className="font-headline-md text-headline-md mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">person</span>
            Profile Settings
          </h2>
          <div className="flex flex-col gap-4">
            <div>
              <label className="font-label-sm uppercase text-secondary block mb-1">Role</label>
              <div className="font-data-lg text-on-background capitalize">{user?.role}</div>
            </div>
            <div>
              <label className="font-label-sm uppercase text-secondary block mb-1">Company / Vendor ID</label>
              <div className="font-data-md bg-surface-container-low p-2 border-2 border-on-background w-full md:w-1/2">
                {user?.role === 'vendor' ? user.vendorId : 'GMPL_INTERNAL'}
              </div>
            </div>
          </div>
        </section>

        <section className="bg-surface border-2 border-on-background neo-shadow p-6 opacity-70">
          <h2 className="font-headline-md text-headline-md mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">notifications</span>
            Notification Preferences (Coming Soon)
          </h2>
          <div className="flex flex-col gap-4">
            <label className="flex items-center gap-3 cursor-not-allowed">
              <input type="checkbox" disabled checked className="w-5 h-5 border-2 border-on-background accent-primary" />
              <span className="font-body-md text-body-md">Email alerts for Low Stock</span>
            </label>
            <label className="flex items-center gap-3 cursor-not-allowed">
              <input type="checkbox" disabled checked className="w-5 h-5 border-2 border-on-background accent-primary" />
              <span className="font-body-md text-body-md">Email alerts for Edit Requests</span>
            </label>
          </div>
        </section>

        {user?.role === 'company' && (
          <section className="bg-error-container/30 border-2 border-danger neo-shadow p-6">
            <h2 className="font-headline-md text-headline-md text-danger mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-danger">admin_panel_settings</span>
              Advanced Settings
            </h2>
            <p className="font-body-md mb-4">Export database backup or reset metrics.</p>
            <button disabled className="bg-danger text-on-error px-4 py-2 uppercase font-label-sm border-2 border-danger opacity-50 cursor-not-allowed">
              Initiate DB Backup
            </button>
          </section>
        )}
      </div>
    </div>
  );
}
