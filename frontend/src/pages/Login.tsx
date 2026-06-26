import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';

export function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier || !password) return;
    
    setLoading(true);
    setError('');
    
    try {
      const res = await api.post('/auth/login', {
        loginIdentifier: identifier,
        password
      });
      
      if (res.data && res.data.data) {
        const { accessToken, user } = res.data.data;
        login(accessToken, user);
        navigate('/');
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  // Temp mock
  const handleMockLogin = async (role: 'company' | 'vendor') => {
    setLoading(true);
    setError('');
    try {
      const identifier = role === 'company' ? 'admin' : 'gmpl_vendor';
      const pw = role === 'company' ? 'admin123' : 'password';
      const res = await api.post('/auth/login', { loginIdentifier: identifier, password: pw });
      if (res.data && res.data.data) {
        const { accessToken, user } = res.data.data;
        login(accessToken, user);
        navigate('/');
      }
    } catch (err: any) {
      setError('Development override failed to authenticate with backend.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md neo-card bg-surface flex flex-col gap-6">
        <div className="text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <img alt="GMPL Logo" className="h-12 w-12 object-contain border-2 border-on-background p-1 bg-surface-container-low neo-shadow" src="https://lh3.googleusercontent.com/aida-public/AB6AXuC-5H4T5-mbUEyLKE5ecWjl7tzHoeA0zydTTKrVcADfIqDlHfNcBvJrZWiw1ZWkUjvzGqw5sPKm9Up14Sa68b5NehYxuADDt8Z5wUfxRdpuSG-cEs6vJ6f2U90AIcbrs6k_pv-tECi_eOUsT6-kO7l6OqyIg09tzSq34ECwSYHw1FVENmLxLp_584pY3PW8lcu13BrttzNW5Itcs-7kQm3HMYAcvBJh3fuoaTchj9XEuxa6rhyRlTAS7Dnkf0MDLRV0EJCpxRSG9-6S"/>
          </div>
          <h1 className="font-display-lg text-[32px] font-bold text-primary tracking-tight">GMPL Copilot</h1>
          <p className="font-label-sm text-label-sm text-on-surface-variant uppercase mt-1">Enterprise Authentication</p>
        </div>

        {error && (
          <div className="bg-error-container border-2 border-on-background p-3 flex items-start gap-2 neo-shadow-sm">
            <span className="material-symbols-outlined text-danger">error</span>
            <p className="font-body-md text-danger font-bold">{error}</p>
          </div>
        )}

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label className="font-label-sm text-label-sm uppercase text-on-background">Identifier (Email / Vendor ID)</label>
            <input 
              type="text" 
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="w-full h-[56px] bg-surface-container-low border-2 border-on-background neo-shadow-sm focus:outline-none focus:ring-0 px-4 font-body-md text-on-background" 
              placeholder="Enter your ID"
              disabled={loading}
            />
          </div>
          
          <div className="flex flex-col gap-2">
            <label className="font-label-sm text-label-sm uppercase text-on-background">Password</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-[56px] bg-surface-container-low border-2 border-on-background neo-shadow-sm focus:outline-none focus:ring-0 px-4 font-body-md text-on-background" 
              placeholder="••••••••"
              disabled={loading}
            />
          </div>

          <button type="submit" disabled={loading} className="mt-4 neo-btn-primary w-full h-14 cursor-pointer">
            {loading ? 'Authenticating...' : 'Secure Login'}
          </button>
        </form>

        <div className="mt-4 pt-4 border-t-2 border-on-background">
          <p className="font-label-sm text-label-sm text-on-surface-variant uppercase mb-4 text-center">Development Overrides</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => handleMockLogin('company')} className="flex-1 bg-surface border-2 border-on-background py-2 font-label-sm text-label-sm uppercase neo-shadow hover:bg-surface-container-high transition-colors">
              Admin
            </button>
            <button type="button" onClick={() => handleMockLogin('vendor')} className="flex-1 bg-surface border-2 border-on-background py-2 font-label-sm text-label-sm uppercase neo-shadow hover:bg-surface-container-high transition-colors">
              Vendor
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
