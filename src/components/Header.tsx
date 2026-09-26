import React from 'react';
import { Search, Plus, Share2, QrCode, Bell, Menu, Image as ImageIcon, Sparkles } from 'lucide-react';
import { AppBranding } from '../types';

interface HeaderProps {
  searchTerm: string;
  setSearchTerm: (val: string) => void;
  onNewOrderClick: () => void;
  onShareClick: () => void;
  onToggleMobileMenu?: () => void;
  onOpenLogoManager?: () => void;
  onOpenLogoModal?: () => void;
  branding?: AppBranding;
  notificationCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  searchTerm,
  setSearchTerm,
  onNewOrderClick,
  onShareClick,
  onToggleMobileMenu,
  onOpenLogoManager,
  onOpenLogoModal,
  branding,
  notificationCount = 0
}) => {
  const handleOpenLogo = onOpenLogoManager || onOpenLogoModal;

  return (
    <header className="bg-white border-b border-slate-200 px-3 sm:px-6 py-3 sm:py-4 flex flex-wrap md:flex-nowrap items-center justify-between gap-2 sm:gap-4 sticky top-0 z-20 shadow-xs">
      <div className="flex items-center gap-2.5 w-full md:w-auto">
        {/* Mobile menu button */}
        {onToggleMobileMenu && (
          <button
            onClick={onToggleMobileMenu}
            className="p-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors md:hidden shrink-0 cursor-pointer"
            title="Abrir Menu Principal"
          >
            <Menu size={22} />
          </button>
        )}

        {/* Mobile Logo Branding Preview if on small screen */}
        {branding?.logoUrl ? (
          <div 
            onClick={handleOpenLogo}
            className="md:hidden shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
            title="Clique para alterar logotipo"
          >
            <img 
              src={branding.logoUrl} 
              alt={branding.appName || 'Logo'} 
              className="h-8 max-w-[100px] object-contain rounded-md"
            />
          </div>
        ) : (
          handleOpenLogo && (
            <button
              onClick={handleOpenLogo}
              className="md:hidden shrink-0 p-1.5 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 cursor-pointer"
              title="Configurar Logotipo"
            >
              <ImageIcon size={18} />
            </button>
          )
        )}

        {/* Search Input */}
        <div className="relative flex-1 md:w-96">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar cliente, CEP, pedido, motorista..."
            className="w-full pl-10 pr-3 py-2 bg-slate-100 hover:bg-slate-100/80 focus:bg-white text-slate-800 text-xs sm:text-sm rounded-xl border border-transparent focus:border-blue-500 focus:outline-none transition-all shadow-inner"
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-end">
        {/* Manage Logo Button */}
        {handleOpenLogo && (
          <button
            onClick={handleOpenLogo}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer border border-slate-200/60"
            title="Editar Logotipo e Identidade Visual da Empresa"
          >
            <ImageIcon size={15} className="text-blue-600" />
            <span className="hidden lg:inline">Logotipo da Marca</span>
          </button>
        )}

        <button
          onClick={onShareClick}
          className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-2 text-xs sm:text-sm font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 rounded-xl transition-all shadow-2xs cursor-pointer"
          title="Gerar QR Code de Acesso para Condutores"
        >
          <QrCode size={16} className="text-emerald-600" />
          <span className="hidden sm:inline">Gerar QR Condutor</span>
          <span className="sm:hidden">QR</span>
        </button>

        <button
          onClick={onNewOrderClick}
          className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-sm shadow-blue-500/30 cursor-pointer"
        >
          <Plus size={18} />
          <span className="whitespace-nowrap">Novo Pedido</span>
        </button>

        <div className="relative">
          <button
            className="p-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors relative cursor-pointer"
            title="Notificações"
          >
            <Bell size={20} />
            {notificationCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {notificationCount > 9 ? '9+' : notificationCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
