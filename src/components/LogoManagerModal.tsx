import React, { useState, useEffect } from 'react';
import { 
  Image as ImageIcon, 
  Upload, 
  Trash2, 
  Check, 
  RotateCcw, 
  Sparkles, 
  Eye, 
  Smartphone, 
  LayoutDashboard, 
  Truck, 
  Building2, 
  Navigation, 
  ShieldCheck, 
  Box, 
  Map, 
  Palette,
  Save,
  CheckCircle2,
  X,
  Layers,
  HelpCircle
} from 'lucide-react';
import { AppBranding } from '../types';

export const DEFAULT_BRANDING: AppBranding = {
  appName: 'ViniMap Fleet',
  appSubtitle: 'Logística & Entregas Inteligentes',
  logoUrl: '',
  logoIconType: 'truck',
  primaryColor: '#2563eb', // Blue-600
  secondaryColor: '#10b981' // Emerald-500
};

export const getStoredBranding = (): AppBranding => {
  if (typeof window === 'undefined') return DEFAULT_BRANDING;
  try {
    const stored = localStorage.getItem('vinimap_app_branding');
    if (stored) {
      return { ...DEFAULT_BRANDING, ...JSON.parse(stored) };
    }
  } catch (e) {
    console.error('Falha ao ler branding do storage', e);
  }
  return DEFAULT_BRANDING;
};

export const saveStoredBranding = (branding: AppBranding): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('vinimap_app_branding', JSON.stringify(branding));
    window.dispatchEvent(new CustomEvent('vinimap_branding_changed', { detail: branding }));
  } catch (e) {
    console.error('Falha ao salvar branding no storage', e);
  }
};

interface LogoManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  branding: AppBranding;
  onSaveBranding: (newBranding: AppBranding) => void;
}

export const LogoManagerModal: React.FC<LogoManagerModalProps> = ({
  isOpen,
  onClose,
  branding,
  onSaveBranding
}) => {
  const [formData, setFormData] = useState<AppBranding>(branding);
  const [previewError, setPreviewError] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    setFormData(branding);
    setPreviewError(false);
  }, [branding, isOpen]);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Por favor, selecione um arquivo de imagem válido (PNG, JPG, SVG, WebP, GIF).');
      return;
    }

    // Limit to 5MB for base64 storage
    if (file.size > 5 * 1024 * 1024) {
      alert('A imagem deve ter no máximo 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setFormData(prev => ({ ...prev, logoUrl: result }));
      setPreviewError(false);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setFormData(prev => ({ ...prev, logoUrl: '' }));
    setPreviewError(false);
  };

  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    onSaveBranding(formData);
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      onClose();
    }, 600);
  };

  const handleResetDefaults = () => {
    if (confirm('Deseja restaurar a identidade visual padrão do ViniMap?')) {
      setFormData(DEFAULT_BRANDING);
      setPreviewError(false);
    }
  };

  const renderIcon = (type?: string, size = 20) => {
    switch (type) {
      case 'building': return <Building2 size={size} />;
      case 'navigation': return <Navigation size={size} />;
      case 'box': return <Box size={size} />;
      case 'map': return <Map size={size} />;
      case 'shield': return <ShieldCheck size={size} />;
      case 'truck':
      default: return <Truck size={size} />;
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-3xl border border-slate-200 max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto">
        
        {/* Sticky Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-md shadow-blue-600/20">
              <ImageIcon size={22} />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-800 text-base sm:text-lg">
                Identidade Visual & Logotipo da Empresa
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Altere o logotipo, nome e marca exibidos no painel web e no app do condutor
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
            title="Fechar"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSave} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="p-5 sm:p-6 space-y-5 overflow-y-auto flex-1 custom-scrollbar">
            
            {/* Logo Upload / URL Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Logotipo da Marca (Upload de Arquivo ou URL)
                </label>
                {formData.logoUrl && (
                  <button
                    type="button"
                    onClick={handleRemoveLogo}
                    className="inline-flex items-center gap-1 text-[11px] text-rose-600 hover:text-rose-700 font-bold cursor-pointer"
                  >
                    <Trash2 size={13} />
                    <span>Remover Logo</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Dropzone Upload */}
                <label className="border-2 border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50/40 rounded-2xl p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-all group min-h-[120px] bg-slate-50/50">
                  <input
                    type="file"
                    accept="image/png, image/jpeg, image/svg+xml, image/webp, image/gif"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 group-hover:scale-110 flex items-center justify-center mb-2 transition-transform">
                    <Upload size={18} />
                  </div>
                  <span className="text-xs font-bold text-slate-700 group-hover:text-blue-600">
                    Clique para Enviar Imagem
                  </span>
                  <span className="text-[10px] text-slate-400 mt-0.5">
                    PNG, JPG, SVG ou WebP (Máx. 5MB)
                  </span>
                </label>

                {/* Direct URL Input & Current Thumbnail */}
                <div className="flex flex-col justify-between bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 space-y-2">
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">
                      Ou Cole o Link da Imagem / Logo:
                    </label>
                    <input
                      type="text"
                      value={formData.logoUrl}
                      onChange={(e) => {
                        setFormData({ ...formData, logoUrl: e.target.value });
                        setPreviewError(false);
                      }}
                      placeholder="https://exemplo.com/logo.png ou data:image/..."
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-800 focus:border-blue-500 focus:outline-none"
                    />
                  </div>

                  {/* Thumbnail */}
                  <div className="flex items-center justify-between gap-2 pt-1 text-[11px] text-slate-500">
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="font-semibold shrink-0">Status:</span>
                      {formData.logoUrl ? (
                        <span className="text-emerald-600 font-bold flex items-center gap-1 truncate">
                          <Check size={13} className="shrink-0" /> Logo ativo
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">Ícone padrão</span>
                      )}
                    </div>

                    {formData.logoUrl && (
                      <button
                        type="button"
                        onClick={handleRemoveLogo}
                        className="text-[10px] text-rose-600 hover:text-rose-700 font-bold hover:underline shrink-0 cursor-pointer"
                      >
                        Limpar
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Sample Logistics Logos (1-Click Selector) */}
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80 space-y-1.5">
                <span className="text-[11px] font-bold text-slate-600 block">
                  Ou selecione um modelo de logotipo pronto:
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { 
                      id: 'blue_fast', 
                      name: 'Express Blue', 
                      url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=160&q=80' 
                    },
                    { 
                      id: 'emerald_eco', 
                      name: 'Eco Logistics', 
                      url: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&w=160&q=80' 
                    },
                    { 
                      id: 'amber_cargo', 
                      name: 'Cargo Fleet', 
                      url: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&w=160&q=80' 
                    },
                    { 
                      id: 'dark_pro', 
                      name: 'Black Tech', 
                      url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=160&q=80' 
                    }
                  ].map((sample) => (
                    <button
                      key={sample.id}
                      type="button"
                      onClick={() => {
                        setFormData(prev => ({ ...prev, logoUrl: sample.url }));
                        setPreviewError(false);
                      }}
                      className={`p-1.5 rounded-xl border flex items-center gap-2 transition-all cursor-pointer text-left ${
                        formData.logoUrl === sample.url
                          ? 'border-blue-600 bg-blue-50/80 text-blue-700 font-bold shadow-2xs'
                          : 'border-slate-200 bg-white hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      <img src={sample.url} alt={sample.name} className="w-6 h-6 rounded-lg object-cover" />
                      <span className="text-[10px] truncate">{sample.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Names */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nome do Sistema / Empresa *
                </label>
                <input
                  type="text"
                  required
                  value={formData.appName}
                  onChange={(e) => setFormData({ ...formData, appName: e.target.value })}
                  placeholder="Ex: ViniMap Fleet"
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-none font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Slogan / Subtítulo
                </label>
                <input
                  type="text"
                  value={formData.appSubtitle || ''}
                  onChange={(e) => setFormData({ ...formData, appSubtitle: e.target.value })}
                  placeholder="Ex: Logística & Entregas Inteligentes"
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Icon selection */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Ícone Padrão do Sistema
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {[
                  { id: 'truck', label: 'Caminhão' },
                  { id: 'building', label: 'Hub/Base' },
                  { id: 'navigation', label: 'GPS Rota' },
                  { id: 'box', label: 'Encomenda' },
                  { id: 'map', label: 'Mapa' },
                  { id: 'shield', label: 'Segurança' }
                ].map(item => {
                  const isSelected = (formData.logoIconType || 'truck') === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setFormData({ ...formData, logoIconType: item.id as any })}
                      className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                        isSelected 
                          ? 'border-blue-600 bg-blue-50 text-blue-600 font-bold shadow-xs' 
                          : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {renderIcon(item.id, 18)}
                      <span className="text-[10px]">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Live Preview Card */}
            <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800 text-white space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-bold uppercase tracking-wider flex items-center gap-1.5 text-emerald-400">
                  <Eye size={14} />
                  Pré-visualização da Sua Marca
                </span>
                <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded-md text-slate-300">
                  Ao vivo
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {/* Header Preview */}
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center gap-3">
                  {formData.logoUrl && !previewError ? (
                    <img
                      src={formData.logoUrl}
                      alt="Logo Preview"
                      onError={() => setPreviewError(true)}
                      className="w-10 h-10 rounded-xl object-contain bg-white/10 p-1 border border-slate-700"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center font-bold text-white shadow-md text-lg">
                      {renderIcon(formData.logoIconType, 20)}
                    </div>
                  )}
                  <div className="overflow-hidden">
                    <h4 className="font-extrabold text-sm text-white truncate">{formData.appName || 'ViniMap Fleet'}</h4>
                    <p className="text-[10.5px] text-slate-400 truncate">{formData.appSubtitle || 'Logística Inteligente'}</p>
                  </div>
                </div>

                {/* Driver App Mobile Preview */}
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white shrink-0">
                    <Smartphone size={16} />
                  </div>
                  <div className="text-xs truncate">
                    <span className="text-[10px] text-emerald-400 font-bold uppercase block">App do Condutor</span>
                    <span className="font-bold text-white truncate block">{formData.appName || 'ViniMap'}</span>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Sticky Footer with Save / Cancel always visible */}
          <div className="p-4 sm:px-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
            <button
              type="button"
              onClick={handleResetDefaults}
              className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 font-semibold cursor-pointer"
            >
              <RotateCcw size={13} />
              <span>Restaurar Padrão</span>
            </button>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer ${
                  saveSuccess 
                    ? 'bg-emerald-600 text-white' 
                    : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20'
                }`}
              >
                {saveSuccess ? <CheckCircle2 size={16} /> : <Save size={16} />}
                <span>{saveSuccess ? 'Salvo com Sucesso!' : 'Salvar Logotipo'}</span>
              </button>
            </div>
          </div>
        </form>

      </div>
    </div>
  );
};

export default LogoManagerModal;
