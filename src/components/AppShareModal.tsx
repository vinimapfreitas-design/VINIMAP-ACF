import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Share2, 
  QrCode, 
  Copy, 
  Check, 
  MessageSquare, 
  Smartphone, 
  Lock, 
  Send, 
  User, 
  ExternalLink,
  Maximize2,
  Minimize2,
  Download,
  CheckCircle2,
  Sparkles,
  Printer
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Courier } from '../types';

interface AppShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  couriers?: Courier[];
  initialCourierId?: string;
}

export const AppShareModal: React.FC<AppShareModalProps> = ({
  isOpen,
  onClose,
  couriers = [],
  initialCourierId
}) => {
  const [selectedCourierId, setSelectedCourierId] = useState<string>(initialCourierId || couriers[0]?.id || '');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedMsg, setCopiedMsg] = useState(false);
  const [customPhone, setCustomPhone] = useState('');
  const [isQrZoomed, setIsQrZoomed] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);

  // Derive precise base URL ensuring no trailing slash or invalid route
  const getSafeBaseUrl = () => {
    if (typeof window !== 'undefined') {
      const savedCustom = localStorage.getItem('vinimap_custom_public_url');
      if (savedCustom && savedCustom.trim()) {
        return savedCustom.trim().replace(/\/+$/, '');
      }
      const origin = window.location.origin.replace(/\/+$/, '');
      // Automatically detect and convert AI Studio developer preview URL (ais-dev-) to public preview URL (ais-pre-)
      // This prevents 404 error when opening from external phones / devices outside the developer container
      if (origin.includes('ais-dev-')) {
        return origin.replace('ais-dev-', 'ais-pre-');
      }
      return origin;
    }
    return 'https://vinimap-fleet.app';
  };

  const [customBaseUrl, setCustomBaseUrl] = useState<string>(getSafeBaseUrl);
  const [isEditingUrl, setIsEditingUrl] = useState<boolean>(false);

  const selectedCourier = couriers.find(c => c.id === selectedCourierId) || couriers[0];

  useEffect(() => {
    if (initialCourierId) {
      setSelectedCourierId(initialCourierId);
    } else if (couriers.length > 0 && !selectedCourierId) {
      setSelectedCourierId(couriers[0].id);
    }
  }, [initialCourierId, couriers]);

  useEffect(() => {
    if (selectedCourier) {
      setCustomPhone(selectedCourier.phone || '');
    }
  }, [selectedCourierId, selectedCourier]);

  if (!isOpen) return null;

  const handleSaveCustomUrl = (newUrl: string) => {
    const clean = newUrl.trim().replace(/\/+$/, '');
    setCustomBaseUrl(clean);
    if (typeof window !== 'undefined') {
      localStorage.setItem('vinimap_custom_public_url', clean);
    }
    setIsEditingUrl(false);
  };

  const baseUrl = customBaseUrl || getSafeBaseUrl();
  
  // Directly point to driver portal with courier identification parameters
  const currentAppUrl = selectedCourier?.id 
    ? `${baseUrl}/?role=driver&driverId=${encodeURIComponent(selectedCourier.id)}`
    : `${baseUrl}/?role=driver`;

  // Clean phone number for WhatsApp wa.me link
  const rawPhone = customPhone || selectedCourier?.phone || '';
  const cleanPhone = rawPhone.replace(/\D/g, '');
  const formattedPhone = cleanPhone.length === 11 || cleanPhone.length === 10
    ? `55${cleanPhone}`
    : cleanPhone;

  // Generate complete WhatsApp dispatch message
  const driverName = selectedCourier?.name || 'Condutor';
  const driverLogin = selectedCourier?.phone || customPhone || 'Seu telefone';
  const driverPassword = selectedCourier?.password || '1234';

  const whatsappMessage = 
`🚚 *ViniMap Fleet - Aplicativo do Condutor*

Olá, *${driverName}*! Seu acesso ao aplicativo do condutor está liberado.

📲 *Acesse o aplicativo pelo seu celular:*
${currentAppUrl}

🔑 *Credenciais de Acesso:*
• *Telefone (Login):* ${driverLogin}
• *Senha Numérica:* ${driverPassword}

📌 *Como instalar no seu celular:*
1. Toque no link acima para abrir no seu navegador (Google Chrome ou Safari)
2. Toque no menu do navegador (ícone de 3 pontinhos no canto ou Compartilhar)
3. Selecione *"Adicionar à Tela Inicial"* ou *"Instalar Aplicativo"*

Boa rota e excelentes entregas! 📦🚀`;

  const whatsappLink = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(whatsappMessage)}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(currentAppUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyMsg = () => {
    navigator.clipboard.writeText(whatsappMessage);
    setCopiedMsg(true);
    setTimeout(() => setCopiedMsg(false), 2000);
  };

  const handleOpenWhatsApp = () => {
    window.open(whatsappLink, '_blank', 'noopener,noreferrer');
  };

  const handleDownloadQR = () => {
    try {
      const svgElement = qrRef.current?.querySelector('svg');
      if (!svgElement) return;
      
      const svgData = new XMLSerializer().serializeToString(svgElement);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        canvas.width = 600;
        canvas.height = 600;
        if (ctx) {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 50, 50, 500, 500);
          const pngFile = canvas.toDataURL('image/png');
          const downloadLink = document.createElement('a');
          downloadLink.download = `qrcode-condutor-${selectedCourier?.id || 'vinimap'}.png`;
          downloadLink.href = pngFile;
          downloadLink.click();
        }
      };
      img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
    } catch (e) {
      console.error('Erro ao baixar QR code:', e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 text-white rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden my-auto animate-scale-in">
        
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-emerald-950/80 via-slate-900 to-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shadow-inner">
              <QrCode size={24} />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-white flex items-center gap-2">
                <span>Gerador de QR Code do Condutor</span>
                <span className="text-[10px] bg-emerald-500 text-slate-950 px-2 py-0.5 rounded-full font-black">
                  PWA Mobile
                </span>
              </h3>
              <p className="text-xs text-slate-400 font-medium">Link direto e QR Code em alta definição para leitura rápida</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 space-y-4 max-h-[78vh] overflow-y-auto custom-scrollbar">

          {/* Select Driver */}
          {couriers.length > 0 && (
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <User size={14} className="text-blue-400" />
                <span>Selecione o Condutor Cadastrado</span>
              </label>

              <select
                value={selectedCourierId}
                onChange={(e) => setSelectedCourierId(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-xs font-bold text-white px-3.5 py-2.5 rounded-xl focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                {couriers.map(c => (
                  <option key={c.id} value={c.id} className="bg-slate-900 text-white">
                    {c.name} — Tel: {c.phone} (Senha: {c.password || '1234'})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Phone Number Input for WhatsApp */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Smartphone size={14} className="text-emerald-400" />
              <span>Número do WhatsApp do Condutor</span>
            </label>
            <input
              type="text"
              value={customPhone}
              onChange={(e) => setCustomPhone(e.target.value)}
              placeholder="Ex: (11) 98765-4321"
              className="w-full bg-slate-800 border border-slate-700 text-xs font-bold text-emerald-300 px-3.5 py-2.5 rounded-xl focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* QR Code Prominent High-Definition Display */}
          <div className="bg-gradient-to-b from-slate-800/90 to-slate-900/90 border border-slate-700 rounded-3xl p-5 text-center space-y-3.5 shadow-lg">
            <div className="flex items-center justify-between border-b border-slate-700/60 pb-2">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <QrCode size={16} className="text-emerald-400" />
                <span>QR Code de Leitura Instantânea</span>
              </span>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsQrZoomed(!isQrZoomed)}
                  className="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 text-[10.5px] font-bold rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                  title="Ampliar QR Code"
                >
                  {isQrZoomed ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                  <span>{isQrZoomed ? 'Reduzir' : 'Ampliar'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadQR}
                  className="px-2.5 py-1 bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-700/60 text-emerald-300 text-[10.5px] font-bold rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                  title="Baixar imagem em alta resolução"
                >
                  <Download size={13} />
                  <span>Salvar</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const printWindow = window.open('', '_blank');
                    if (!printWindow) return;
                    const svgHtml = qrRef.current?.innerHTML || '';
                    printWindow.document.write(`
                      <!DOCTYPE html>
                      <html>
                        <head>
                          <meta charset="utf-8">
                          <title>Crachá QR Code - ${driverName}</title>
                          <style>
                            body { font-family: system-ui, -apple-system, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; background: #f8fafc; }
                            .card { background: white; border: 2px solid #059669; border-radius: 20px; padding: 28px; text-align: center; max-width: 340px; width: 100%; box-shadow: 0 10px 25px rgba(0,0,0,0.08); }
                            h2 { margin: 0 0 4px; font-size: 22px; color: #065f46; font-weight: 800; }
                            .tag { display: inline-block; background: #d1fae5; color: #065f46; font-size: 11px; font-weight: 700; padding: 2px 10px; border-radius: 9999px; margin-bottom: 16px; }
                            .qr-box { background: #ffffff; padding: 12px; border-radius: 16px; border: 1px solid #e2e8f0; display: inline-block; margin: 12px 0; }
                            .qr-box svg { width: 200px; height: 200px; display: block; }
                            .driver-name { font-size: 17px; font-weight: 800; color: #0f172a; margin: 8px 0 2px; }
                            .driver-phone { font-size: 13px; font-weight: 700; color: #059669; font-family: monospace; margin: 0 0 12px; }
                            .instructions { font-size: 11px; color: #64748b; border-top: 1px dashed #cbd5e1; padding-top: 12px; line-height: 1.4; }
                          </style>
                        </head>
                        <body>
                          <div class="card">
                            <h2>ViniMap Logística</h2>
                            <div class="tag">Aplicativo do Condutor</div>
                            <div class="driver-name">${driverName}</div>
                            <div class="driver-phone">${driverLogin}</div>
                            <div class="qr-box">${svgHtml}</div>
                            <div class="instructions">
                              Aponte a câmera do celular para este QR Code para abrir o aplicativo e iniciar as rotas de entrega.
                            </div>
                          </div>
                          <script>
                            window.onload = function() { window.print(); }
                          </script>
                        </body>
                      </html>
                    `);
                    printWindow.document.close();
                  }}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-[10.5px] font-bold rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                  title="Imprimir crachá com QR Code"
                >
                  <Printer size={13} />
                  <span>Imprimir</span>
                </button>
              </div>
            </div>

            {/* Crisp Vector QR Code Container */}
            <div 
              ref={qrRef}
              className={`mx-auto bg-white p-3.5 rounded-2xl shadow-xl border-4 border-emerald-500/40 inline-flex items-center justify-center transition-all duration-300 ${
                isQrZoomed ? 'w-64 h-64 sm:w-72 sm:h-72 scale-105' : 'w-48 h-48 sm:w-52 sm:h-52'
              }`}
            >
              <QRCodeSVG 
                value={currentAppUrl}
                size={isQrZoomed ? 260 : 180}
                level="H"
                includeMargin={true}
                className="w-full h-full object-contain"
              />
            </div>

            <p className="text-[11px] text-slate-400 font-medium">
              Aponte a câmera do celular do condutor para abrir e instalar o aplicativo diretamente sem precisar digitar o link.
            </p>
          </div>

          {/* Direct URL Box & Test Action */}
          <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-2xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Link de Acesso Público do Condutor
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsEditingUrl(!isEditingUrl)}
                  className="text-[10.5px] font-bold text-slate-400 hover:text-white px-2 py-0.5 rounded bg-slate-800 transition-colors cursor-pointer"
                >
                  {isEditingUrl ? 'Fechar Edição' : 'Ajustar Domínio'}
                </button>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="text-[11px] font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1 bg-blue-950/40 border border-blue-800/60 px-2 py-0.5 rounded-md transition-colors cursor-pointer"
                >
                  {copiedLink ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                  <span>{copiedLink ? 'Copiado!' : 'Copiar URL'}</span>
                </button>
              </div>
            </div>

            {isEditingUrl && (
              <div className="p-2.5 bg-slate-900 border border-slate-700 rounded-xl space-y-2 text-xs">
                <label className="text-[11px] font-bold text-slate-300 block">
                  URL Base Pública da Aplicação (ex: https://meu-app.shardcloud.io ou domínio próprio):
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    defaultValue={customBaseUrl}
                    id="customUrlInput"
                    placeholder="https://..."
                    className="flex-1 px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono text-xs focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const input = document.getElementById('customUrlInput') as HTMLInputElement;
                      if (input) handleSaveCustomUrl(input.value);
                    }}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-xs cursor-pointer"
                  >
                    Salvar
                  </button>
                </div>
                <p className="text-[10px] text-slate-400">
                  Detecta automaticamente a URL pública para evitar erro 404 em acessos de celulares externos.
                </p>
              </div>
            )}

            <p className="text-xs font-mono text-emerald-300 bg-slate-900 p-2.5 rounded-xl border border-slate-800 break-all select-all">
              {currentAppUrl}
            </p>

            <div className="pt-1 flex items-center justify-between">
              <span className="text-[10px] text-slate-400">
                Abre diretamente a tela de login do condutor.
              </span>
              <a
                href={currentAppUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 underline underline-offset-2"
              >
                <span>Testar Acesso em Nova Aba</span>
                <ExternalLink size={11} />
              </a>
            </div>
          </div>

          {/* Credentials Preview Card */}
          {selectedCourier && (
            <div className="p-3.5 bg-slate-800/80 border border-slate-700 rounded-2xl flex items-center justify-between text-xs">
              <div className="space-y-0.5">
                <span className="text-[10px] text-slate-400 font-bold uppercase">Credenciais do Condutor</span>
                <p className="font-extrabold text-white">{selectedCourier.name}</p>
                <p className="text-[11px] text-slate-300 font-mono">
                  Login: <strong className="text-emerald-400">{selectedCourier.phone}</strong> | Senha: <strong className="text-amber-400">{selectedCourier.password || '1234'}</strong>
                </p>
              </div>
              <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-slate-300">
                <Lock size={16} />
              </div>
            </div>
          )}

          {/* WhatsApp Message Preview */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <MessageSquare size={14} className="text-emerald-400" />
                <span>Mensagem Formatada para WhatsApp</span>
              </label>

              <button
                type="button"
                onClick={handleCopyMsg}
                className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 bg-emerald-950/60 border border-emerald-800 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
              >
                {copiedMsg ? <Check size={12} /> : <Copy size={12} />}
                <span>{copiedMsg ? 'Copiada!' : 'Copiar Texto'}</span>
              </button>
            </div>

            <textarea
              readOnly
              value={whatsappMessage}
              rows={7}
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-xs font-mono text-emerald-200/90 leading-relaxed focus:outline-none resize-none"
            />
          </div>

          {/* Direct WhatsApp Send Big Button */}
          <button
            type="button"
            onClick={handleOpenWhatsApp}
            className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2.5 transition-all cursor-pointer"
          >
            <Send size={18} />
            <span>Enviar WhatsApp para {selectedCourier?.name || 'Condutor'}</span>
            <ExternalLink size={14} />
          </button>

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
            <CheckCircle2 size={14} />
            <span>Link pronto para instalação PWA</span>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
};

export default AppShareModal;

