import React, { useState, useEffect } from 'react';
import { Download, Smartphone, X, CheckCircle2, QrCode, Share2, ShieldCheck, Sparkles, Building2, ExternalLink, Check } from 'lucide-react';
import { AppBranding } from '../types';

interface DriverPwaInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  branding?: AppBranding;
  courierName?: string;
  courierPhone?: string;
}

export const DriverPwaInstallModal: React.FC<DriverPwaInstallModalProps> = ({ 
  isOpen, 
  onClose,
  branding,
  courierName,
  courierPhone
}) => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [hasDownloadedLauncher, setHasDownloadedLauncher] = useState(false);

  useEffect(() => {
    // Check if app is running as PWA / standalone
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
      setIsInstalled(true);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const appTitle = branding?.appName || 'ViniMap Fleet - App do Condutor';
  const logoSrc = branding?.logoUrl || `${baseUrl}/api/branding/logo`;
  const currentAppUrl = `${baseUrl}/?role=driver${courierPhone ? `&phone=${encodeURIComponent(courierPhone)}` : ''}`;

  // Automatic offline web app launcher file generator and downloader
  const handleDownloadAppLauncher = () => {
    const launcherHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
  <title>${appTitle}</title>
  <link rel="icon" href="${logoSrc}">
  <link rel="apple-touch-icon" href="${logoSrc}">
  <meta name="theme-color" content="${branding?.primaryColor || '#0284c7'}">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="mobile-web-app-capable" content="yes">
  <style>
    body {
      margin: 0;
      padding: 0;
      background: #090d16;
      color: #ffffff;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      text-align: center;
    }
    .card {
      background: #111827;
      border: 1px solid #1f2937;
      border-radius: 24px;
      padding: 32px 24px;
      max-width: 360px;
      width: 90%;
      box-shadow: 0 20px 40px rgba(0,0,0,0.5);
    }
    .logo {
      width: 84px;
      height: 84px;
      border-radius: 20px;
      object-fit: contain;
      background: #ffffff;
      padding: 8px;
      box-shadow: 0 10px 20px rgba(0,0,0,0.3);
      margin-bottom: 16px;
    }
    h1 {
      font-size: 20px;
      font-weight: 800;
      margin: 0 0 8px 0;
    }
    p {
      font-size: 13px;
      color: #9ca3af;
      margin: 0 0 24px 0;
      line-height: 1.4;
    }
    .btn {
      display: block;
      width: 100%;
      padding: 14px 0;
      background: linear-gradient(135deg, #059669, #0d9488);
      color: #ffffff;
      text-decoration: none;
      font-weight: bold;
      border-radius: 14px;
      font-size: 14px;
      box-shadow: 0 4px 14px rgba(5, 150, 105, 0.4);
    }
  </style>
</head>
<body>
  <div class="card">
    <img class="logo" src="${logoSrc}" alt="${appTitle}" onerror="this.src='/icon.svg'">
    <h1>${appTitle}</h1>
    <p>Iniciando o painel de entregas do condutor em tela cheia...</p>
    <a class="btn" href="${currentAppUrl}">Abrir Aplicativo</a>
  </div>
  <script>
    setTimeout(function() {
      window.location.href = "${currentAppUrl}";
    }, 600);
  </script>
</body>
</html>`;

    const blob = new Blob([launcherHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const cleanFileName = (branding?.appName || 'app-condutor')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-');
    a.href = url;
    a.download = `${cleanFileName}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setHasDownloadedLauncher(true);
  };

  const handleInstallClick = async () => {
    // 1. Trigger native PWA prompt if available
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const choiceResult = await deferredPrompt.userChoice;
        if (choiceResult.outcome === 'accepted') {
          setIsInstalled(true);
        }
        setDeferredPrompt(null);
      } catch (_) {}
    }
    
    // 2. Always trigger automatic launcher download for instant device saving
    handleDownloadAppLauncher();
  };

  const handleCopyAppUrl = () => {
    navigator.clipboard.writeText(currentAppUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  if (!isOpen) return null;

  const qrCodeApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(currentAppUrl)}`;

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 text-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden my-auto animate-scale-in">
        
        {/* Header with Registered Base Logo */}
        <div className="p-5 bg-gradient-to-r from-emerald-950/90 via-slate-900 to-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-13 h-13 rounded-2xl bg-white p-1.5 shadow-lg flex items-center justify-center shrink-0 border-2 border-emerald-500/40">
              <img 
                src={branding?.logoUrl || '/api/branding/logo'} 
                alt={branding?.appName || "Logotipo da Empresa"} 
                className="w-full h-full object-contain"
                onError={(e) => {
                  (e.target as any).src = '/icon.svg';
                }}
              />
            </div>
            <div className="overflow-hidden">
              <h3 className="font-extrabold text-base text-white truncate">
                {branding?.appName || 'App do Condutor'}
              </h3>
              <p className="text-xs text-emerald-400 font-bold truncate flex items-center gap-1">
                <span>Logotipo da Empresa Ativo</span>
                {courierName && <span className="text-slate-400">• {courierName}</span>}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5 max-h-[75vh] overflow-y-auto">

          {/* Installed Success Status */}
          {isInstalled && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center gap-3 text-emerald-300 text-xs font-bold">
              <CheckCircle2 size={20} className="text-emerald-400 shrink-0" />
              <span>O aplicativo com a logomarca da base já está instalado neste dispositivo em modo tela cheia!</span>
            </div>
          )}

          {/* Direct Install & Auto-Download Card */}
          <div className="p-4 bg-gradient-to-br from-emerald-950/40 to-slate-900 border border-emerald-500/30 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-emerald-300 flex items-center gap-1.5">
                <Sparkles size={16} className="text-emerald-400" /> Instalação do Aplicativo
              </span>
              <span className="text-[10px] bg-emerald-500 text-slate-950 font-black px-2 py-0.5 rounded-full">
                PWA / Nativo
              </span>
            </div>
            
            <p className="text-xs text-slate-300 leading-relaxed font-medium">
              Clique no botão abaixo para <strong>baixar e instalar automaticamente</strong> o aplicativo no dispositivo com a <strong>logomarca oficial da sua base</strong>.
            </p>

            <div className="space-y-2 pt-1">
              <button
                onClick={handleInstallClick}
                className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs rounded-xl shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Download size={17} className="animate-bounce" />
                <span>Baixar & Instalar App no Celular</span>
              </button>

              {hasDownloadedLauncher && (
                <p className="text-[11px] text-emerald-400 font-bold text-center flex items-center justify-center gap-1">
                  <Check size={14} /> Aplicativo da base baixado com sucesso!
                </p>
              )}
            </div>
          </div>

          {/* QR Code Section with Base Branding */}
          <div className="p-4 bg-slate-800/80 border border-slate-700 rounded-2xl flex flex-col sm:flex-row items-center gap-4">
            <div className="relative bg-white p-2 rounded-2xl shrink-0 shadow-md">
              <img src={qrCodeApiUrl} alt="QR Code App Condutor" className="w-24 h-24 object-contain" />
              {branding?.logoUrl && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-7 h-7 bg-white rounded-lg p-0.5 shadow-md border border-slate-300">
                    <img src={branding.logoUrl} alt="Base" className="w-full h-full object-contain" />
                  </div>
                </div>
              )}
            </div>
            <div className="space-y-2 text-center sm:text-left">
              <h4 className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center justify-center sm:justify-start gap-1">
                <QrCode size={14} className="text-emerald-400" />
                <span>Abrir no Celular do Motorista</span>
              </h4>
              <p className="text-[11px] text-slate-400 leading-tight">
                Aponte a câmera do smartphone para o QR Code para abrir o app personalizado da base diretamente no celular.
              </p>
              <button
                onClick={handleCopyAppUrl}
                className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-[11px] font-bold rounded-lg transition-colors cursor-pointer"
              >
                {copiedLink ? '✓ Link Copiado!' : 'Copiar Link para WhatsApp'}
              </button>
            </div>
          </div>

          {/* Step by Step installation instructions for Android & iOS */}
          <div className="space-y-3">
            <h4 className="text-xs font-extrabold text-slate-300 uppercase tracking-wider">
              Como Adicionar à Tela Inicial:
            </h4>

            {/* Android Guide */}
            <div className="p-3.5 bg-slate-800/50 border border-slate-700/80 rounded-2xl space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                <Smartphone size={14} />
                <span>Android (Google Chrome / Edge)</span>
              </div>
              <ol className="text-xs text-slate-400 space-y-1 list-decimal list-inside font-medium leading-relaxed">
                <li>Abra o link no navegador Chrome do smartphone</li>
                <li>Toque no menu de 3 pontos (<strong className="text-slate-200">⋮</strong>) no canto superior</li>
                <li>Selecione <strong className="text-slate-200">"Instalar aplicativo"</strong> ou <strong className="text-slate-200">"Adicionar à Tela inicial"</strong></li>
              </ol>
            </div>

            {/* iOS Guide */}
            <div className="p-3.5 bg-slate-800/50 border border-slate-700/80 rounded-2xl space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-blue-400">
                <Share2 size={14} />
                <span>iPhone / iPad (Safari)</span>
              </div>
              <ol className="text-xs text-slate-400 space-y-1 list-decimal list-inside font-medium leading-relaxed">
                <li>Abra o link no navegador <strong className="text-slate-200">Safari</strong></li>
                <li>Toque no botão <strong className="text-slate-200">Compartilhar</strong> (ícone de quadrado com seta para cima)</li>
                <li>Role para baixo e toque em <strong className="text-slate-200">"Adicionar à Tela de Início"</strong></li>
              </ol>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-semibold truncate pr-2">
            <ShieldCheck size={14} className="text-emerald-500 shrink-0" />
            <span className="truncate">{branding?.appName || 'ViniMap Fleet'} • Base Oficial</span>
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-extrabold text-xs rounded-xl transition-colors cursor-pointer shrink-0"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
};

export default DriverPwaInstallModal;

