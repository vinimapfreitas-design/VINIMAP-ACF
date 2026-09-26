import React, { useState, useEffect } from 'react';
import { Lock, User, Key, LogIn, Truck, Shield, AlertCircle, Phone, ArrowRight, CheckCircle2, Eye, EyeOff, Smartphone, RefreshCw } from 'lucide-react';
import { Courier, AppBranding } from '../types';

interface LoginScreenProps {
  onLoginSuccess: (user: any) => void;
  couriers?: Courier[];
  initialRole?: 'admin' | 'driver' | null;
  initialDriverId?: string | null;
  branding?: AppBranding;
  hideAdminTab?: boolean;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ 
  onLoginSuccess, 
  couriers: initialCouriers = [],
  initialRole,
  initialDriverId,
  branding,
  hideAdminTab = false
}) => {
  const [localCouriers, setLocalCouriers] = useState<Courier[]>(initialCouriers);
  const [isLoadingCouriers, setIsLoadingCouriers] = useState<boolean>(false);
  const [showDriverPassword, setShowDriverPassword] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Auto-fetch freshest couriers if empty or on mount to ensure newly registered drivers can log in immediately
  useEffect(() => {
    if (initialCouriers.length > 0) {
      setLocalCouriers(initialCouriers);
    } else {
      fetchFreshCouriers();
    }
  }, [initialCouriers]);

  const fetchFreshCouriers = async () => {
    setIsLoadingCouriers(true);
    try {
      const res = await fetch('/api/couriers');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setLocalCouriers(data);
        }
      }
    } catch (e) {
      console.warn('Erro ao carregar lista atualizada de condutores:', e);
    } finally {
      setIsLoadingCouriers(false);
    }
  };

  // Check if opened specifically as a driver application / link or on a driver device
  const isDriverDevice = React.useMemo(() => {
    if (hideAdminTab) return true;
    if (initialRole === 'driver') return true;
    if (typeof window !== 'undefined') {
      if (window.localStorage.getItem('vinimap_device_role') === 'driver') return true;
      if (window.localStorage.getItem('vinimap_driver_id')) return true;
      if (window.localStorage.getItem('vinimap_driver_session_token')) return true;
      if (window.matchMedia('(display-mode: standalone)').matches) return true;
      const params = new URLSearchParams(window.location.search);
      if (
        params.get('role') === 'driver' || 
        params.has('driverId') || 
        params.has('courierId') || 
        params.get('app') === 'driver' ||
        window.location.pathname.includes('/driver') ||
        window.location.pathname.includes('/condutor') ||
        window.location.hash.includes('driver')
      ) {
        return true;
      }
    }
    return false;
  }, [hideAdminTab, initialRole]);

  const isDriverOnlyMode = isDriverDevice;

  // Dedicated screen state for Admin vs Driver (Strictly disabled on driver devices)
  const [isAdminScreen, setIsAdminScreen] = useState<boolean>(() => {
    if (hideAdminTab) return false;
    if (initialRole === 'driver') return false;
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const hasExplicitAdminParam = 
        params.get('mode') === 'admin' || 
        params.get('role') === 'admin' || 
        params.get('view') === 'admin' || 
        params.has('admin');

      // If this device was ever tagged as a driver device and no explicit admin param is in URL, force false
      const isTaggedDriver = window.localStorage.getItem('vinimap_device_role') === 'driver' ||
                             Boolean(window.localStorage.getItem('vinimap_driver_id')) ||
                             Boolean(window.localStorage.getItem('vinimap_driver_session_token')) ||
                             window.matchMedia('(display-mode: standalone)').matches;

      if (isTaggedDriver && !hasExplicitAdminParam) {
        return false;
      }

      if (initialRole === 'admin') return true;
      return hasExplicitAdminParam;
    }
    return false;
  });

  // Admin login states
  const [adminLogin, setAdminLogin] = useState('admin');
  const [adminPassword, setAdminPassword] = useState('123456');

  // Driver login states - Phone / Identification and Password
  const [driverPhoneInput, setDriverPhoneInput] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlDriverId = params.get('driverId') || params.get('courierId');
      if (urlDriverId) {
        const match = initialCouriers.find(c => c.id === urlDriverId || c.phone === urlDriverId);
        if (match) return match.phone || match.id;
        return urlDriverId;
      }
    }
    if (initialDriverId) {
      const match = initialCouriers.find(c => c.id === initialDriverId || c.phone === initialDriverId);
      if (match) return match.phone || match.id;
      return initialDriverId;
    }
    return initialCouriers[0]?.phone || '';
  });

  const [driverPassword, setDriverPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Format phone number utility
  const formatPhone = (val: string) => {
    const digits = val.replace(/\D/g, '');
    if (digits.length <= 2) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    // If user is typing digits, apply phone mask
    if (/^[\d\s()\-+]+$/.test(raw) || raw === '') {
      setDriverPhoneInput(formatPhone(raw));
    } else {
      // Allow raw input if typing ID or custom text
      setDriverPhoneInput(raw);
    }
    setErrorMessage(null);
  };

  // Sync when initialDriverId or localCouriers change
  useEffect(() => {
    if (initialDriverId && localCouriers.length > 0) {
      const match = localCouriers.find(c => c.id === initialDriverId || c.phone === initialDriverId);
      if (match && !driverPhoneInput) {
        setDriverPhoneInput(match.phone || match.id);
      }
    }
  }, [initialDriverId, localCouriers]);

  const handleAdminSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (adminLogin === 'admin' && adminPassword === '123456') {
      const user = {
        id: 'usr-admin',
        name: 'Administrador Central',
        login: adminLogin,
        role: 'admin',
        permissions: 'all'
      };
      localStorage.setItem('vinimap_current_operator', JSON.stringify(user));
      localStorage.setItem('vinimap_device_role', 'admin');
      onLoginSuccess(user);
    } else {
      setErrorMessage('Credenciais de administrador incorretas.');
    }
  };

  const handleDriverSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    const inputTrimmed = driverPhoneInput.trim();
    if (!inputTrimmed) {
      setErrorMessage('Por favor, digite o celular cadastrado.');
      setIsSubmitting(false);
      return;
    }

    const cleanInputDigits = inputTrimmed.replace(/\D/g, '');

    const getDeviceId = () => {
      try {
        let devId = localStorage.getItem('vinimap_device_id');
        if (!devId) {
          devId = `dev_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
          localStorage.setItem('vinimap_device_id', devId);
        }
        return devId;
      } catch (_) {
        return `dev_${Date.now()}`;
      }
    };
    const deviceId = getDeviceId();

    // 1. Attempt official driver login API (registers unique single-session token on server)
    try {
      const loginRes = await fetch('/api/driver/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: inputTrimmed,
          password: driverPassword,
          deviceId: deviceId,
          deviceInfo: navigator.userAgent.includes('Mobile') ? 'Smartphone Mobile (PWA)' : 'Dispositivo Web'
        })
      });

      if (loginRes.ok) {
        const data = await loginRes.json();
        if (data.success && data.user) {
          if (data.sessionToken) {
            localStorage.setItem('vinimap_driver_session_token', data.sessionToken);
          }
          localStorage.setItem('vinimap_device_id', deviceId);
          localStorage.setItem('vinimap_driver_device_id', deviceId);
          localStorage.setItem('vinimap_driver_login_time', data.lastLoginAt || new Date().toISOString());
          localStorage.setItem('vinimap_current_operator', JSON.stringify(data.user));
          localStorage.setItem('vinimap_driver_id', data.user.id);
          localStorage.setItem('vinimap_device_role', 'driver');
          onLoginSuccess(data.user);
          return;
        }
      } else {
        const errData = await loginRes.json().catch(() => ({}));
        if (errData.error) {
          setErrorMessage(errData.error);
          setIsSubmitting(false);
          return;
        }
      }
    } catch (apiErr) {
      console.warn('Falha na chamada /api/driver/login, tentando validação local...', apiErr);
    }

    // 2. Fallback attempt: Match against localCouriers array
    let matchedCourier = localCouriers.find(c => {
      const cCleanPhone = (c.phone || '').replace(/\D/g, '');
      if (cleanInputDigits && cCleanPhone) {
        if (cCleanPhone === cleanInputDigits) return true;
        if (cleanInputDigits.length >= 8 && cCleanPhone.endsWith(cleanInputDigits)) return true;
        if (cCleanPhone.length >= 8 && cleanInputDigits.endsWith(cCleanPhone)) return true;
      }
      if (c.id.toLowerCase() === inputTrimmed.toLowerCase()) return true;
      if (c.name.toLowerCase() === inputTrimmed.toLowerCase()) return true;
      return false;
    });

    if (matchedCourier) {
      if (matchedCourier.password && driverPassword && matchedCourier.password !== driverPassword) {
        setErrorMessage(`Senha / PIN incorreto para o condutor "${matchedCourier.name}".`);
        setIsSubmitting(false);
        return;
      }

      const localSessionToken = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const loginTime = new Date().toISOString();

      const driverUser = {
        id: matchedCourier.id,
        name: matchedCourier.name,
        login: matchedCourier.phone || matchedCourier.id,
        phone: matchedCourier.phone,
        vehicle: matchedCourier.vehicle,
        role: 'driver',
        permissions: ['driver'],
        sessionToken: localSessionToken,
        deviceId: deviceId
      };

      localStorage.setItem('vinimap_driver_session_token', localSessionToken);
      localStorage.setItem('vinimap_device_id', deviceId);
      localStorage.setItem('vinimap_driver_device_id', deviceId);
      localStorage.setItem('vinimap_driver_login_time', loginTime);
      localStorage.setItem('vinimap_current_operator', JSON.stringify(driverUser));
      localStorage.setItem('vinimap_driver_id', matchedCourier.id);
      localStorage.setItem('vinimap_device_role', 'driver');

      // Async sync of session token to backend
      fetch(`/api/couriers/${matchedCourier.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activeSessionToken: localSessionToken,
          activeDeviceId: deviceId,
          lastLoginAt: loginTime,
          lastLoginDevice: navigator.userAgent.includes('Mobile') ? 'Smartphone Mobile (PWA)' : 'Dispositivo Web'
        })
      }).catch(() => {});

      onLoginSuccess(driverUser);
      return;
    }

    // 3. Not found anywhere
    setErrorMessage('Nenhum entregador cadastrado encontrado com este celular. Verifique o número digitado ou realize o cadastro no painel.');
    setIsSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-900 rounded-3xl border border-slate-800 p-6 sm:p-8 shadow-2xl text-white space-y-6">
        
        {/* Brand Header */}
        <div className="text-center space-y-2">
          {branding?.logoUrl ? (
            <div className="w-20 h-20 rounded-2xl bg-white/10 p-2 border border-slate-700 flex items-center justify-center mx-auto shadow-lg">
              <img
                src={branding.logoUrl}
                alt={branding.appName || 'Logo'}
                className="max-h-full max-w-full object-contain rounded-lg"
              />
            </div>
          ) : (
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center font-black text-2xl mx-auto shadow-lg transition-all ${
              !isAdminScreen
                ? 'bg-emerald-600 text-white shadow-emerald-500/30' 
                : 'bg-blue-600 text-white shadow-blue-500/30'
            }`}>
              {!isAdminScreen ? <Truck size={32} /> : <Shield size={32} />}
            </div>
          )}
          <h2 className="text-2xl font-bold tracking-tight">
            {!isAdminScreen
              ? `${branding?.appName || 'ViniMap'} - App do Condutor` 
              : `${branding?.appName || 'ViniMap'} - Painel Administrativo`}
          </h2>
          <p className="text-xs text-slate-400">
            {!isAdminScreen
              ? 'Digite seu celular cadastrado para acessar suas rotas e entregas' 
              : 'Central de Gestão, Monitoramento & Despacho'}
          </p>
        </div>

        {errorMessage && (
          <div className="p-3.5 bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs rounded-2xl flex items-start gap-2.5 leading-relaxed">
            <AlertCircle size={17} className="shrink-0 text-rose-400 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* 1. Driver Screen (Default - no other couriers shown, no admin tab) */}
        {!isAdminScreen ? (
          <form onSubmit={handleDriverSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Phone size={13} className="text-emerald-400" />
                  <span>Celular Cadastrado (Login)</span>
                </span>
              </label>
              
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500">
                  <Smartphone size={16} />
                </div>
                <input
                  type="tel"
                  required
                  value={driverPhoneInput}
                  onChange={handlePhoneChange}
                  placeholder="(11) 98765-4321"
                  className="w-full pl-10 pr-4 py-3.5 bg-slate-950 border border-slate-800 rounded-xl text-sm font-semibold text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Lock size={13} className="text-emerald-400" />
                  <span>Senha / PIN Numérico</span>
                </span>
                <span className="text-[10px] font-normal text-slate-500">Opcional se não cadastrada</span>
              </label>
              
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500">
                  <Key size={15} />
                </div>
                <input
                  type={showDriverPassword ? "text" : "password"}
                  value={driverPassword}
                  onChange={(e) => setDriverPassword(e.target.value)}
                  placeholder="Digite sua senha ou deixe em branco"
                  className="w-full pl-10 pr-10 py-3.5 bg-slate-950 border border-slate-800 rounded-xl text-sm font-semibold text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowDriverPassword(!showDriverPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-1 cursor-pointer"
                >
                  {showDriverPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] disabled:opacity-50 text-white font-extrabold rounded-xl shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer mt-3"
            >
              {isSubmitting ? (
                <RefreshCw size={18} className="animate-spin" />
              ) : (
                <Truck size={18} />
              )}
              <span>{isSubmitting ? 'Autenticando...' : 'Acessar Minhas Entregas'}</span>
              {!isSubmitting && <ArrowRight size={16} />}
            </button>

            <div className="pt-2 text-center">
              <p className="text-[11px] text-slate-500 flex items-center justify-center gap-1.5">
                <CheckCircle2 size={13} className="text-emerald-500" />
                <span>Geolocalização GPS e fotos de comprovante sincronizadas</span>
              </p>
            </div>

            {/* Discrete Link to Dedicated Admin Screen (NEVER shown on driver device or driver mode) */}
            {!isDriverDevice && !isDriverOnlyMode && !hideAdminTab && (
              <div className="pt-4 border-t border-slate-800/80 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setIsAdminScreen(true);
                    setErrorMessage(null);
                  }}
                  className="text-xs text-slate-500 hover:text-slate-300 transition-colors inline-flex items-center gap-1.5 cursor-pointer py-1 font-medium"
                >
                  <Shield size={13} className="text-slate-400" />
                  <span>Acesso Administrativo (Painel de Gestão)</span>
                </button>
              </div>
            )}
          </form>
        ) : (
          /* 2. Dedicated Admin Screen (Own view with username/password and return link) */
          <form onSubmit={handleAdminSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">
                Usuário Operador
              </label>
              <input
                type="text"
                required
                value={adminLogin}
                onChange={(e) => setAdminLogin(e.target.value)}
                className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500 transition-colors font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">
                Senha de Acesso
              </label>
              <input
                type="password"
                required
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500 transition-colors font-medium"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 active:scale-[0.99] text-white font-extrabold rounded-xl shadow-lg shadow-blue-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              <LogIn size={18} />
              <span>Entrar no Painel Central</span>
              <ArrowRight size={16} />
            </button>

            {/* Back button to return to Driver portal */}
            <div className="pt-4 border-t border-slate-800/80 text-center">
              <button
                type="button"
                onClick={() => {
                  setIsAdminScreen(false);
                  setErrorMessage(null);
                }}
                className="text-xs text-slate-400 hover:text-emerald-400 transition-colors inline-flex items-center gap-1.5 cursor-pointer py-1 font-medium"
              >
                <Truck size={13} className="text-emerald-400" />
                <span>← Voltar ao Acesso do Condutor</span>
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
};

export default LoginScreen;
