import { Outlet, NavLink, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export function SidebarLayout() {
  const { user, logout } = useAuth();
  
  // MOCK LOGIC FOR LAYOUT
  const isCompany = user ? user.role === 'company' : true;

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* TopAppBar (Mobile) */}
      <header className="sticky top-0 z-50 flex justify-between items-center px-margin py-4 w-full bg-surface border-b-2 border-on-background shadow-[6px_6px_0px_#1A1A1A] md:hidden">
        <div className="flex items-center gap-3">
          <img alt="GMPL Logo" className="h-8 w-8 object-contain" src="https://lh3.googleusercontent.com/aida-public/AB6AXuC-5H4T5-mbUEyLKE5ecWjl7tzHoeA0zydTTKrVcADfIqDlHfNcBvJrZWiw1ZWkUjvzGqw5sPKm9Up14Sa68b5NehYxuADDt8Z5wUfxRdpuSG-cEs6vJ6f2U90AIcbrs6k_pv-tECi_eOUsT6-kO7l6OqyIg09tzSq34ECwSYHw1FVENmLxLp_584pY3PW8lcu13BrttzNW5Itcs-7kQm3HMYAcvBJh3fuoaTchj9XEuxa6rhyRlTAS7Dnkf0MDLRV0EJCpxRSG9-6S"/>
          <span className="text-headline-md font-headline-md font-black tracking-tighter text-deep-orange">GANES ETPLAST</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="material-symbols-outlined cursor-pointer hover:translate-x-[2px] hover:translate-y-[2px] transition-all">notifications</span>
          <span className="material-symbols-outlined cursor-pointer hover:translate-x-[2px] hover:translate-y-[2px] transition-all">account_circle</span>
        </div>
      </header>

      {/* SideNavBar (Desktop) */}
      <nav className="hidden md:flex fixed left-0 top-0 h-full flex-col pt-8 z-40 bg-surface border-r-2 border-on-background shadow-[6px_0px_0px_#1A1A1A] w-64 overflow-y-auto">
        <div className="px-6 mb-8 flex flex-col gap-2">
          <div className="flex items-center gap-3 mb-4">
            <img alt="GMPL Logo" className="h-12 w-12 object-contain border-2 border-on-background p-1 bg-surface-container-low shadow-[2px_2px_0px_#1A1A1A]" src="https://lh3.googleusercontent.com/aida-public/AB6AXuC-5H4T5-mbUEyLKE5ecWjl7tzHoeA0zydTTKrVcADfIqDlHfNcBvJrZWiw1ZWkUjvzGqw5sPKm9Up14Sa68b5NehYxuADDt8Z5wUfxRdpuSG-cEs6vJ6f2U90AIcbrs6k_pv-tECi_eOUsT6-kO7l6OqyIg09tzSq34ECwSYHw1FVENmLxLp_584pY3PW8lcu13BrttzNW5Itcs-7kQm3HMYAcvBJh3fuoaTchj9XEuxa6rhyRlTAS7Dnkf0MDLRV0EJCpxRSG9-6S"/>
          </div>
          <h1 className="font-headline-md text-headline-md text-primary tracking-tight">Industrial ERP</h1>
          <p className="font-label-sm text-label-sm text-on-surface-variant uppercase">{isCompany ? 'Admin Console' : 'Vendor Portal'}</p>
        </div>
        
        {!isCompany && (
          <div className="px-4 mb-6">
            <Link to="/logs/new" className="w-full neo-btn-primary py-2 text-sm flex items-center justify-center gap-2">
              <span className="material-symbols-outlined fill-icon text-[18px]">add</span>
              New Production Log
            </Link>
          </div>
        )}
        
        <div className="flex-1 flex flex-col gap-1 px-2">
          <NavLink to="/" className={({isActive}) => isActive 
            ? "bg-primary-container text-on-primary-container border-2 border-on-background shadow-[4px_4px_0px_#1A1A1A] m-2 p-3 flex items-center gap-3 font-bold"
            : "text-on-surface-variant hover:bg-surface-container-highest p-3 mx-2 my-1 flex items-center gap-3 transition-all border-2 border-transparent hover:border-on-background"}>
            <span className="material-symbols-outlined fill-icon">dashboard</span>
            <span className="font-label-sm text-label-sm">Dashboard</span>
          </NavLink>
          
          <NavLink to="/logs" className={({isActive}) => isActive 
            ? "bg-primary-container text-on-primary-container border-2 border-on-background shadow-[4px_4px_0px_#1A1A1A] m-2 p-3 flex items-center gap-3 font-bold"
            : "text-on-surface-variant hover:bg-surface-container-highest p-3 mx-2 my-1 flex items-center gap-3 transition-all border-2 border-transparent hover:border-on-background"}>
            <span className="material-symbols-outlined fill-icon">history</span>
            <span className="font-label-sm text-label-sm">{isCompany ? 'Global Logs' : 'My Logs'}</span>
          </NavLink>
          
          <NavLink to="/moulds" className={({isActive}) => isActive 
            ? "bg-primary-container text-on-primary-container border-2 border-on-background shadow-[4px_4px_0px_#1A1A1A] m-2 p-3 flex items-center gap-3 font-bold"
            : "text-on-surface-variant hover:bg-surface-container-highest p-3 mx-2 my-1 flex items-center gap-3 transition-all border-2 border-transparent hover:border-on-background"}>
            <span className="material-symbols-outlined">precision_manufacturing</span>
            <span className="font-label-sm text-label-sm">Moulds</span>
          </NavLink>
          
          {!isCompany && (
            <NavLink to="/assignments" className={({isActive}) => isActive 
              ? "bg-primary-container text-on-primary-container border-2 border-on-background shadow-[4px_4px_0px_#1A1A1A] m-2 p-3 flex items-center gap-3 font-bold"
              : "text-on-surface-variant hover:bg-surface-container-highest p-3 mx-2 my-1 flex items-center gap-3 transition-all border-2 border-transparent hover:border-on-background"}>
              <span className="material-symbols-outlined">assignment</span>
              <span className="font-label-sm text-label-sm">My Assignments</span>
            </NavLink>
          )}

          {isCompany && (
            <NavLink to="/materials" className={({isActive}) => isActive 
              ? "bg-primary-container text-on-primary-container border-2 border-on-background shadow-[4px_4px_0px_#1A1A1A] m-2 p-3 flex items-center gap-3 font-bold"
              : "text-on-surface-variant hover:bg-surface-container-highest p-3 mx-2 my-1 flex items-center gap-3 transition-all border-2 border-transparent hover:border-on-background"}>
              <span className="material-symbols-outlined">inventory_2</span>
              <span className="font-label-sm text-label-sm">Materials</span>
            </NavLink>
          )}

          {isCompany && (
            <NavLink to="/vendors" className={({isActive}) => isActive 
              ? "bg-primary-container text-on-primary-container border-2 border-on-background shadow-[4px_4px_0px_#1A1A1A] m-2 p-3 flex items-center gap-3 font-bold"
              : "text-on-surface-variant hover:bg-surface-container-highest p-3 mx-2 my-1 flex items-center gap-3 transition-all border-2 border-transparent hover:border-on-background"}>
              <span className="material-symbols-outlined">factory</span>
              <span className="font-label-sm text-label-sm">Vendors</span>
            </NavLink>
          )}

          {isCompany && (
            <NavLink to="/repairs" className={({isActive}) => isActive 
              ? "bg-primary-container text-on-primary-container border-2 border-on-background shadow-[4px_4px_0px_#1A1A1A] m-2 p-3 flex items-center gap-3 font-bold"
              : "text-on-surface-variant hover:bg-surface-container-highest p-3 mx-2 my-1 flex items-center gap-3 transition-all border-2 border-transparent hover:border-on-background"}>
              <span className="material-symbols-outlined">build</span>
              <span className="font-label-sm text-label-sm">Repairs</span>
            </NavLink>
          )}

          <NavLink to="/edit-requests" className={({isActive}) => isActive 
            ? "bg-primary-container text-on-primary-container border-2 border-on-background shadow-[4px_4px_0px_#1A1A1A] m-2 p-3 flex items-center gap-3 font-bold"
            : "text-on-surface-variant hover:bg-surface-container-highest p-3 mx-2 my-1 flex items-center gap-3 transition-all border-2 border-transparent hover:border-on-background"}>
            <span className="material-symbols-outlined">edit_document</span>
            <span className="font-label-sm text-label-sm">{isCompany ? 'Approval Queue' : 'My Requests'}</span>
          </NavLink>

          {isCompany && (
            <NavLink to="/analytics" className={({isActive}) => isActive 
              ? "bg-primary-container text-on-primary-container border-2 border-on-background shadow-[4px_4px_0px_#1A1A1A] m-2 p-3 flex items-center gap-3 font-bold"
              : "text-on-surface-variant hover:bg-surface-container-highest p-3 mx-2 my-1 flex items-center gap-3 transition-all border-2 border-transparent hover:border-on-background"}>
              <span className="material-symbols-outlined">analytics</span>
              <span className="font-label-sm text-label-sm">Analytics</span>
            </NavLink>
          )}

          {isCompany && (
            <NavLink to="/copilot" className={({isActive}) => isActive 
              ? "bg-primary-container text-on-primary-container border-2 border-on-background shadow-[4px_4px_0px_#1A1A1A] m-2 p-3 flex items-center gap-3 font-bold"
              : "text-on-surface-variant hover:bg-surface-container-highest p-3 mx-2 my-1 flex items-center gap-3 transition-all border-2 border-transparent hover:border-on-background"}>
              <span className="material-symbols-outlined">smart_toy</span>
              <span className="font-label-sm text-label-sm">Copilot</span>
            </NavLink>
          )}
        </div>
        
        <div className="mt-auto border-t-2 border-on-background p-4 flex flex-col gap-1 bg-surface-container-low">
          <NavLink to="/settings" className={({isActive}) => isActive 
            ? "bg-surface-variant text-on-background border-2 border-on-background shadow-[2px_2px_0px_#1A1A1A] mx-2 my-1 p-2 flex items-center gap-3 font-bold"
            : "text-on-surface-variant hover:bg-surface-container-highest p-2 mx-2 my-1 flex items-center gap-3 transition-all border-2 border-transparent hover:border-on-background"}>
            <span className="material-symbols-outlined text-[20px]">settings</span>
            <span className="font-label-sm text-label-sm">Settings</span>
          </NavLink>

          <NavLink to="/support" className={({isActive}) => isActive 
            ? "bg-surface-variant text-on-background border-2 border-on-background shadow-[2px_2px_0px_#1A1A1A] mx-2 my-1 p-2 flex items-center gap-3 font-bold"
            : "text-on-surface-variant hover:bg-surface-container-highest p-2 mx-2 my-1 flex items-center gap-3 transition-all border-2 border-transparent hover:border-on-background"}>
            <span className="material-symbols-outlined text-[20px]">help</span>
            <span className="font-label-sm text-label-sm">Support</span>
          </NavLink>

          <button onClick={logout} className="text-danger hover:bg-surface-container-highest p-2 mx-2 my-1 flex items-center gap-3 transition-all border-2 border-transparent hover:border-on-background text-left">
            <span className="material-symbols-outlined text-[20px]">logout</span>
            <span className="font-label-sm text-label-sm">Sign Out</span>
          </button>
        </div>
      </nav>

      {/* Main Content Canvas */}
      <main className="flex-1 md:ml-64 flex flex-col relative overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
