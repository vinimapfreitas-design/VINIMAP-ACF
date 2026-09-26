import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  MapPin, 
  Package, 
  Users, 
  Building2, 
  DollarSign, 
  FileSpreadsheet, 
  Settings, 
  Calculator,
  Database, 
  LogOut, 
  ChevronLeft, 
  ChevronRight,
  ChevronDown,
  UserCheck,
  Map,
  RotateCcw,
  BookOpen,
  List,
  Code,
  FileCode,
  Smartphone,
  Zap,
  Image as ImageIcon,
  Truck,
  Navigation,
  Box,
  ShieldCheck,
  FolderKanban,
  Sliders,
  Pin,
  PinOff,
  Route
} from 'lucide-react';
import { AppBranding } from '../types';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  isMobileOpen?: boolean;
  setIsMobileOpen?: (open: boolean) => void;
  currentUser?: any;
  onLogout?: () => void;
  activities?: any[];
  onClearCache?: () => void;
  ordersCount?: number;
  branding?: AppBranding;
  onOpenLogoManager?: () => void;
  onOpenLogoModal?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  isCollapsed,
  setIsCollapsed,
  isMobileOpen = false,
  setIsMobileOpen,
  currentUser,
  onLogout,
  onClearCache,
  ordersCount = 0,
  branding,
  onOpenLogoManager,
  onOpenLogoModal
}) => {
  const handleOpenLogo = onOpenLogoManager || onOpenLogoModal;

  // Auto-retract mode: when enabled, sidebar is compact (w-20) by default and automatically expands on hover (w-64)
  const [autoRetract, setAutoRetract] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('vinimap_sidebar_auto_retract');
      return saved !== null ? saved === 'true' : true; // Default to true as requested
    } catch (_) {
      return true;
    }
  });

  const [isHovered, setIsHovered] = useState<boolean>(false);

  // Submenu expansion states
  const [isAdminExpanded, setIsAdminExpanded] = useState<boolean>(true);
  const [openSubmenus, setOpenSubmenus] = useState<{ [key: string]: boolean }>({
    cadastro: true,
    relatorios: true,
    sistema: false
  });

  // Top-level direct items as strictly requested:
  // 1. PAINEL GERAL
  // 2. GESTAO DE PEDIDOS
  // 3. IMPORTAR PLANILHA
  // 4. ALOCACAO & ROTAS
  // 5. GPS
  const topMenuItems = [
    { id: 'dashboard', label: 'Painel Geral', icon: LayoutDashboard },
    { id: 'orders', label: 'Gestão de Pedidos', icon: Package, badge: ordersCount },
    { id: 'import_spreadsheet', label: 'Importar Planilha', icon: FileSpreadsheet },
    { id: 'allocation', label: 'Alocação & Rotas', icon: MapPin },
    { id: 'route_optimizer', label: 'Roteirizador Pro', icon: Route },
    { id: 'driver_gps', label: 'GPS', icon: Map }
  ];

  // PAINEL ADM Submenu 1: CADASTRO
  // Items: Cadastro de Operador, Cadastro de Parceiro, Cadastro de Condutor, Hub Central (+ App do Condutor)
  const cadastroSubmenuItems = [
    { id: 'operators', label: 'Cadastro de Operador', icon: UserCheck },
    { id: 'partners', label: 'Cadastro de Parceiro', icon: Building2 },
    { id: 'couriers', label: 'Cadastro de Condutor', icon: Truck },
    { id: 'hubs', label: 'Hub Central', icon: MapPin },
    { id: 'driver_device', label: 'App do Condutor (PWA)', icon: Smartphone }
  ];

  // PAINEL ADM Submenu 2: RELATÓRIOS & FINANCEIRO
  // Items: Financeiro, Tabela de Frete, Cálculo de Volumes Profissional (+ Diário)
  const relatoriosSubmenuItems = [
    { id: 'finance', label: 'Financeiro', icon: DollarSign },
    { id: 'freight_config', label: 'Tabela de Frete', icon: Calculator },
    { id: 'volume_calculator', label: 'Cálculo de Volumes Profissional', icon: Box },
    { id: 'diary', label: 'Diário de Anotações', icon: BookOpen }
  ];

  // PAINEL ADM Submenu 3: SISTEMA E INTEGRAÇÃO
  // Items: Integração Intelipost, Firebase, Conf App, Backup, Exportar SQL, GitHub (+ Sync Logs)
  const sistemaSubmenuItems = [
    { id: 'integracoes', label: 'Integração Intelipost', icon: Zap },
    { id: 'firebase_control', label: 'Firebase', icon: Database },
    { id: 'environment', label: 'Conf App', icon: Settings },
    { id: 'backup', label: 'Backup', icon: RotateCcw },
    { id: 'sql_export', label: 'Exportar SQL', icon: FileCode },
    { id: 'github', label: 'GitHub', icon: Code },
    { id: 'sync_logs', label: 'Logs de Sincronização', icon: List }
  ];

  // Auto-expand relevant submenu if the activeTab belongs to it
  useEffect(() => {
    if (cadastroSubmenuItems.some(i => i.id === activeTab)) {
      setIsAdminExpanded(true);
      setOpenSubmenus(prev => ({ ...prev, cadastro: true }));
    } else if (relatoriosSubmenuItems.some(i => i.id === activeTab)) {
      setIsAdminExpanded(true);
      setOpenSubmenus(prev => ({ ...prev, relatorios: true }));
    } else if (sistemaSubmenuItems.some(i => i.id === activeTab)) {
      setIsAdminExpanded(true);
      setOpenSubmenus(prev => ({ ...prev, sistema: true }));
    } else if (activeTab === 'admin') {
      setIsAdminExpanded(true);
    }
  }, [activeTab]);

  const toggleAutoRetract = () => {
    const next = !autoRetract;
    setAutoRetract(next);
    try {
      localStorage.setItem('vinimap_sidebar_auto_retract', String(next));
    } catch (_) {}
    if (next) {
      setIsCollapsed(true);
    } else {
      setIsCollapsed(false);
    }
  };

  const toggleSubmenu = (key: string) => {
    setOpenSubmenus(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleTabSelect = (tabId: string) => {
    setActiveTab(tabId);
    if (setIsMobileOpen) {
      setIsMobileOpen(false);
    }
  };

  // Determine if sidebar is effectively expanded (showing full labels and submenus)
  const isEffectivelyExpanded = isMobileOpen || (!isCollapsed && !autoRetract) || (autoRetract && isHovered);

  const renderLogoIcon = (size = 20) => {
    switch (branding?.logoIconType) {
      case 'building': return <Building2 size={size} />;
      case 'navigation': return <Navigation size={size} />;
      case 'box': return <Box size={size} />;
      case 'map': return <Map size={size} />;
      case 'shield': return <ShieldCheck size={size} />;
      case 'truck':
      default: return <Truck size={size} />;
    }
  };

  const appName = branding?.appName || 'ViniMap Fleet';
  const appSubtitle = branding?.appSubtitle || 'Logística Inteligente';

  // Check if any item in a group is active
  const isAnyCadastroActive = cadastroSubmenuItems.some(i => i.id === activeTab);
  const isAnyRelatoriosActive = relatoriosSubmenuItems.some(i => i.id === activeTab);
  const isAnySistemaActive = sistemaSubmenuItems.some(i => i.id === activeTab);
  const isAnyAdminActive = isAnyCadastroActive || isAnyRelatoriosActive || isAnySistemaActive || activeTab === 'admin';

  return (
    <>
      {/* Mobile backdrop overlay */}
      {isMobileOpen && (
        <div 
          onClick={() => setIsMobileOpen?.(false)}
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-40 md:hidden animate-fade-in"
        />
      )}

      <aside 
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`bg-slate-900 text-slate-100 min-h-screen flex flex-col transition-all duration-300 border-r border-slate-800 z-50 select-none ${
          isMobileOpen 
            ? 'fixed inset-y-0 left-0 w-72 shadow-2xl translate-x-0' 
            : 'fixed -translate-x-full md:translate-x-0 md:static md:z-30'
        } ${
          isEffectivelyExpanded ? 'md:w-64 lg:w-72 shadow-xl' : 'md:w-20'
        }`}
      >
        {/* Top Header / Branding */}
        <div className="p-3.5 flex items-center justify-between border-b border-slate-800">
          {isEffectivelyExpanded ? (
            <div 
              onClick={handleOpenLogo}
              className="flex items-center gap-3 cursor-pointer group hover:opacity-90 transition-opacity min-w-0"
              title="Clique para editar logotipo e nome da empresa"
            >
              {branding?.logoUrl ? (
                <img
                  src={branding.logoUrl}
                  alt={appName}
                  className="w-9 h-9 rounded-xl object-contain bg-white/10 p-1 border border-slate-700 shadow-md shrink-0"
                />
              ) : (
                <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center font-bold text-white shadow-lg shadow-blue-500/30 text-base shrink-0">
                  {renderLogoIcon(20)}
                </div>
              )}
              <div className="overflow-hidden">
                <h1 className="font-extrabold text-sm text-white tracking-wide truncate group-hover:text-blue-400 transition-colors">
                  {appName}
                </h1>
                <p className="text-[10px] text-slate-400 truncate">{appSubtitle}</p>
              </div>
            </div>
          ) : (
            <div 
              onClick={handleOpenLogo}
              className="w-10 h-10 mx-auto rounded-xl bg-blue-600 flex items-center justify-center font-bold text-white shadow-lg text-lg cursor-pointer hover:bg-blue-500 transition-colors"
              title="Editar logotipo da empresa"
            >
              {branding?.logoUrl ? (
                <img
                  src={branding.logoUrl}
                  alt={appName}
                  className="w-10 h-10 rounded-xl object-contain bg-white/10 p-1"
                />
              ) : (
                renderLogoIcon(20)
              )}
            </div>
          )}
          
          {/* Controls: Mobile close or Desktop auto-retract / toggle */}
          {isMobileOpen ? (
            <button
              onClick={() => setIsMobileOpen?.(false)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors md:hidden"
            >
              <ChevronLeft size={20} />
            </button>
          ) : isEffectivelyExpanded && (
            <div className="flex items-center gap-1 hidden md:flex">
              <button
                onClick={toggleAutoRetract}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  autoRetract 
                    ? 'text-blue-400 bg-blue-500/10 hover:bg-blue-500/20' 
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
                title={autoRetract ? "Modo Retrátil Automático Ativo (Clique para Fixar Aberto)" : "Menu Fixado Aberto (Clique para Ativar Retrátil Automático)"}
              >
                {autoRetract ? <PinOff size={15} /> : <Pin size={15} />}
              </button>
              <button
                onClick={() => {
                  setIsCollapsed(!isCollapsed);
                  if (autoRetract) setAutoRetract(false);
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                title={isCollapsed ? "Expandir Menu" : "Recolher Menu"}
              >
                {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
              </button>
            </div>
          )}
        </div>

        {/* User info if logged in */}
        {currentUser && isEffectivelyExpanded && (
          <div className="px-3.5 py-2.5 bg-slate-950/50 border-b border-slate-800/80 flex items-center justify-between">
            <div className="truncate">
              <p className="text-[10px] text-slate-400 font-medium">Conectado como</p>
              <p className="text-xs font-bold text-white truncate">{currentUser.name || currentUser.login}</p>
              <span className="text-[9px] text-emerald-400 font-semibold uppercase tracking-wider">
                {currentUser.role === 'admin' ? 'Administrador' : currentUser.role === 'driver' ? 'Condutor' : 'Operador'}
              </span>
            </div>
            {onLogout && (
              <button
                onClick={onLogout}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors cursor-pointer"
                title="Sair da Conta"
              >
                <LogOut size={15} />
              </button>
            )}
          </div>
        )}

        {/* Navigation Menu */}
        <nav className="flex-1 overflow-y-auto p-2.5 space-y-1 custom-scrollbar">
          {/* SECTION 1: TOP DIRECT MENU ITEMS */}
          <div className="space-y-1">
            {topMenuItems.map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleTabSelect(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/70'
                  } ${!isEffectivelyExpanded ? 'justify-center px-2' : ''}`}
                  title={item.label}
                >
                  <Icon size={18} className="shrink-0" />
                  {isEffectivelyExpanded && (
                    <span className="truncate flex-1 text-left">{item.label}</span>
                  )}
                  {isEffectivelyExpanded && item.badge !== undefined && item.badge > 0 && (
                    <span className="text-[10px] font-extrabold bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded-full">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* DIVIDER */}
          <div className="pt-2 pb-1">
            <div className="border-t border-slate-800/80" />
          </div>

          {/* SECTION 2: PAINEL ADM WITH SUB-MENUS */}
          {isEffectivelyExpanded ? (
            <div className="space-y-1.5 pt-0.5">
              {/* PAINEL ADM Header / Toggle */}
              <div 
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'admin'
                    ? 'bg-slate-800 text-cyan-300 border border-cyan-500/30'
                    : isAnyAdminActive
                    ? 'text-white bg-slate-800/50'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/40'
                }`}
                onClick={() => setIsAdminExpanded(!isAdminExpanded)}
              >
                <div 
                  className="flex items-center gap-2.5 flex-1 min-w-0"
                  onClick={(e) => {
                    // Navigate to admin overview on direct click of title
                    e.stopPropagation();
                    handleTabSelect('admin');
                    setIsAdminExpanded(true);
                  }}
                  title="Abrir Visão Geral do Painel ADM"
                >
                  <div className={`p-1 rounded-lg ${isAnyAdminActive ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
                    <ShieldCheck size={16} />
                  </div>
                  <span className="truncate font-bold tracking-wide">PAINEL ADM</span>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsAdminExpanded(!isAdminExpanded);
                  }}
                  className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors"
                  title={isAdminExpanded ? "Recolher Painel ADM" : "Expandir Painel ADM"}
                >
                  <ChevronDown 
                    size={14} 
                    className={`transition-transform duration-200 ${isAdminExpanded ? 'rotate-0' : '-rotate-90'}`} 
                  />
                </button>
              </div>

              {/* Collapsible Content under PAINEL ADM */}
              {isAdminExpanded && (
                <div className="pl-2 space-y-2 pt-1 border-l border-slate-800/60 ml-3">
                  {/* SUB-MENU 1: CADASTRO */}
                  <div className="space-y-0.5">
                    <button
                      onClick={() => toggleSubmenu('cadastro')}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[11px] font-bold tracking-wider uppercase transition-colors cursor-pointer ${
                        isAnyCadastroActive ? 'text-cyan-400' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <FolderKanban size={13} className={isAnyCadastroActive ? 'text-cyan-400' : 'text-slate-500'} />
                        <span>CADASTRO</span>
                      </div>
                      <ChevronDown 
                        size={12} 
                        className={`transition-transform duration-200 text-slate-500 ${openSubmenus.cadastro ? 'rotate-0' : '-rotate-90'}`} 
                      />
                    </button>

                    {openSubmenus.cadastro && (
                      <div className="pl-3 space-y-0.5 pt-0.5 border-l border-slate-800/50 ml-2">
                        {cadastroSubmenuItems.map(subItem => {
                          const SubIcon = subItem.icon;
                          const isSubActive = activeTab === subItem.id;
                          return (
                            <button
                              key={subItem.id}
                              onClick={() => handleTabSelect(subItem.id)}
                              className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all cursor-pointer text-left ${
                                isSubActive
                                  ? 'bg-blue-600 text-white font-bold shadow-xs'
                                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                              }`}
                            >
                              <SubIcon size={14} className={isSubActive ? 'text-white' : 'text-slate-500'} />
                              <span className="truncate flex-1">{subItem.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* SUB-MENU 2: RELATÓRIOS & FINANCEIRO */}
                  <div className="space-y-0.5">
                    <button
                      onClick={() => toggleSubmenu('relatorios')}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[11px] font-bold tracking-wider uppercase transition-colors cursor-pointer ${
                        isAnyRelatoriosActive ? 'text-emerald-400' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <DollarSign size={13} className={isAnyRelatoriosActive ? 'text-emerald-400' : 'text-slate-500'} />
                        <span className="truncate">RELATÓRIOS & FINANCEIRO</span>
                      </div>
                      <ChevronDown 
                        size={12} 
                        className={`transition-transform duration-200 text-slate-500 ${openSubmenus.relatorios ? 'rotate-0' : '-rotate-90'}`} 
                      />
                    </button>

                    {openSubmenus.relatorios && (
                      <div className="pl-3 space-y-0.5 pt-0.5 border-l border-slate-800/50 ml-2">
                        {relatoriosSubmenuItems.map(subItem => {
                          const SubIcon = subItem.icon;
                          const isSubActive = activeTab === subItem.id;
                          return (
                            <button
                              key={subItem.id}
                              onClick={() => handleTabSelect(subItem.id)}
                              className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all cursor-pointer text-left ${
                                isSubActive
                                  ? 'bg-blue-600 text-white font-bold shadow-xs'
                                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                              }`}
                            >
                              <SubIcon size={14} className={isSubActive ? 'text-white' : 'text-slate-500'} />
                              <span className="truncate flex-1">{subItem.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* SUB-MENU 3: SISTEMA E INTEGRAÇÃO */}
                  <div className="space-y-0.5">
                    <button
                      onClick={() => toggleSubmenu('sistema')}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[11px] font-bold tracking-wider uppercase transition-colors cursor-pointer ${
                        isAnySistemaActive ? 'text-amber-400' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Sliders size={13} className={isAnySistemaActive ? 'text-amber-400' : 'text-slate-500'} />
                        <span className="truncate">SISTEMA E INTEGRAÇÃO</span>
                      </div>
                      <ChevronDown 
                        size={12} 
                        className={`transition-transform duration-200 text-slate-500 ${openSubmenus.sistema ? 'rotate-0' : '-rotate-90'}`} 
                      />
                    </button>

                    {openSubmenus.sistema && (
                      <div className="pl-3 space-y-0.5 pt-0.5 border-l border-slate-800/50 ml-2">
                        {sistemaSubmenuItems.map(subItem => {
                          const SubIcon = subItem.icon;
                          const isSubActive = activeTab === subItem.id;
                          return (
                            <button
                              key={subItem.id}
                              onClick={() => handleTabSelect(subItem.id)}
                              className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all cursor-pointer text-left ${
                                isSubActive
                                  ? 'bg-blue-600 text-white font-bold shadow-xs'
                                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                              }`}
                            >
                              <SubIcon size={14} className={isSubActive ? 'text-white' : 'text-slate-500'} />
                              <span className="truncate flex-1">{subItem.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* COMPACT / RETRACTED MODE FOR PAINEL ADM */
            <div className="pt-1 flex flex-col items-center gap-1.5">
              <button
                onClick={() => handleTabSelect('admin')}
                className={`p-2.5 rounded-xl transition-all cursor-pointer ${
                  isAnyAdminActive
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
                title="Painel ADM (Passe o mouse para expandir e ver sub-menus)"
              >
                <ShieldCheck size={18} />
              </button>

              <button
                onClick={() => handleTabSelect('operators')}
                className={`p-2 rounded-lg transition-all cursor-pointer ${
                  isAnyCadastroActive
                    ? 'text-cyan-400 bg-slate-800/80'
                    : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/40'
                }`}
                title="Cadastro (Operadores, Parceiros, Condutores, Hubs)"
              >
                <UserCheck size={16} />
              </button>

              <button
                onClick={() => handleTabSelect('finance')}
                className={`p-2 rounded-lg transition-all cursor-pointer ${
                  isAnyRelatoriosActive
                    ? 'text-emerald-400 bg-slate-800/80'
                    : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/40'
                }`}
                title="Relatórios & Financeiro (Financeiro, Tabela de Frete)"
              >
                <DollarSign size={16} />
              </button>

              <button
                onClick={() => handleTabSelect('integracoes')}
                className={`p-2 rounded-lg transition-all cursor-pointer ${
                  isAnySistemaActive
                    ? 'text-amber-400 bg-slate-800/80'
                    : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/40'
                }`}
                title="Sistema & Integração (Intelipost, Firebase, Conf App, Backup, SQL, GitHub)"
              >
                <Zap size={16} />
              </button>
            </div>
          )}
        </nav>

        {/* Footer actions */}
        <div className="p-3 border-t border-slate-800 space-y-2">
          {/* Mode indicator badge */}
          {isEffectivelyExpanded && (
            <div className="px-2 py-1.5 rounded-lg bg-slate-950/40 border border-slate-800/60 flex items-center justify-between text-[10px] text-slate-400">
              <span className="flex items-center gap-1.5 font-medium">
                <span className={`w-1.5 h-1.5 rounded-full ${autoRetract ? 'bg-emerald-400 animate-pulse' : 'bg-blue-400'}`}></span>
                {autoRetract ? 'Retrátil Automático' : 'Menu Fixado'}
              </span>
              <button
                onClick={toggleAutoRetract}
                className="text-[9px] font-bold text-blue-400 hover:text-blue-300 underline cursor-pointer"
              >
                {autoRetract ? 'Fixar' : 'Ativar Retrátil'}
              </button>
            </div>
          )}

          {handleOpenLogo && isEffectivelyExpanded && (
            <button
              onClick={handleOpenLogo}
              className="w-full flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-100 hover:bg-slate-800/80 transition-colors cursor-pointer"
            >
              <ImageIcon size={15} className="text-blue-400" />
              <span>Gerenciar Logotipo</span>
            </button>
          )}

          {onClearCache && isEffectivelyExpanded && (
            <button
              onClick={onClearCache}
              className="w-full flex items-center gap-2 px-3 py-1.5 rounded-xl text-[11px] font-semibold text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 transition-colors cursor-pointer"
              title="Limpar cache e forçar recarga"
            >
              <RotateCcw size={13} />
              <span>Limpar Cache Local</span>
            </button>
          )}
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
