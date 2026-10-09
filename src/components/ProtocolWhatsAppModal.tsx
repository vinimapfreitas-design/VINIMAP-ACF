import React, { useState, useEffect } from 'react';
import { 
  X, 
  Send, 
  Copy, 
  Check, 
  User, 
  Building2, 
  Bike, 
  Phone, 
  FileText, 
  CheckCircle2, 
  ExternalLink,
  MessageCircle,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import { Order, PartnerClient, Courier, matchClientCode } from '../types';
import { 
  buildWhatsAppProtocolMessage, 
  cleanPhoneForWhatsApp, 
  formatPhoneDisplay, 
  generateWhatsAppProtocolUrl 
} from '../utils/whatsappProtocol';

interface ProtocolWhatsAppModalProps {
  isOpen: boolean;
  order: Order | null;
  partnerClients?: PartnerClient[];
  couriers?: Courier[];
  onClose: () => void;
  onDownloadPDF?: () => void;
}

export const WhatsAppIcon: React.FC<{ className?: string }> = ({ className = "w-5 h-5" }) => (
  <svg 
    viewBox="0 0 24 24" 
    width="24" 
    height="24" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    fill="currentColor"
    className={className}
  >
    <path 
      d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"
      fill="currentColor"
    />
  </svg>
);

export const ProtocolWhatsAppModal: React.FC<ProtocolWhatsAppModalProps> = ({
  isOpen,
  order,
  partnerClients = [],
  couriers = [],
  onClose,
  onDownloadPDF
}) => {
  if (!isOpen || !order) return null;

  // Resolve matching partner
  const matchedPartner = partnerClients.find(p => 
    matchClientCode(p.codigoCliente, order.codigoCliente) ||
    (order.cliente && p.name.toLowerCase().includes(order.cliente.toLowerCase()))
  );

  // Resolve matching courier
  const matchedCourier = couriers.find(c => 
    c.id === order.courierId || 
    (order.courierName && c.name.toLowerCase() === order.courierName.toLowerCase())
  );

  // Available phone presets
  const recipientPhone = order.telefone || order.phone || '';
  const partnerPhone = matchedPartner?.phone || '';
  const courierPhone = matchedCourier?.phone || '';

  // Initial target selection: recipient first, then partner, then courier, or custom
  const [selectedTarget, setSelectedTarget] = useState<'recipient' | 'partner' | 'courier' | 'custom'>('recipient');
  const [phoneInput, setPhoneInput] = useState<string>('');
  const [includeFinancials, setIncludeFinancials] = useState<boolean>(false);
  const [customNotes, setCustomNotes] = useState<string>('');
  const [messageText, setMessageText] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  // Initialize phone and message on open
  useEffect(() => {
    let initialTarget: 'recipient' | 'partner' | 'courier' | 'custom' = 'recipient';
    let initialPhone = recipientPhone;

    if (!recipientPhone) {
      if (partnerPhone) {
        initialTarget = 'partner';
        initialPhone = partnerPhone;
      } else if (courierPhone) {
        initialTarget = 'courier';
        initialPhone = courierPhone;
      } else {
        initialTarget = 'custom';
        initialPhone = '';
      }
    }

    setSelectedTarget(initialTarget);
    setPhoneInput(initialPhone);
    setCustomNotes(order.deliveryProtocol?.notes || order.notes || '');
    setIncludeFinancials(Boolean(order.deliveryProtocol?.includeFinancialValues));
  }, [order?.id, isOpen]);

  // Rebuild message whenever options change
  useEffect(() => {
    const msg = buildWhatsAppProtocolMessage(order, {
      partnerName: matchedPartner?.name || order.cliente || order.customerName,
      includeFinancials,
      customNotes
    });
    setMessageText(msg);
  }, [order, matchedPartner, includeFinancials, customNotes]);

  // Handle phone preset selection
  const handleSelectPreset = (target: 'recipient' | 'partner' | 'courier' | 'custom') => {
    setSelectedTarget(target);
    if (target === 'recipient') setPhoneInput(recipientPhone);
    else if (target === 'partner') setPhoneInput(partnerPhone);
    else if (target === 'courier') setPhoneInput(courierPhone);
  };

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(messageText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch (err) {
      console.error('Falha ao copiar:', err);
    }
  };

  const handleSendWhatsApp = () => {
    const targetPhone = phoneInput.trim();
    const clean = cleanPhoneForWhatsApp(targetPhone);
    const url = generateWhatsAppProtocolUrl(clean, messageText);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-emerald-600 via-emerald-700 to-teal-700 text-white flex items-center justify-between shadow-md">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/15 rounded-2xl shadow-inner backdrop-blur-xs flex items-center justify-center">
              <WhatsAppIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-base tracking-tight">Enviar Protocolo via WhatsApp</h3>
                <span className="px-2 py-0.5 bg-emerald-500/40 text-emerald-100 text-[10px] font-extrabold rounded-full uppercase tracking-wider">
                  Homologado
                </span>
              </div>
              <p className="text-xs text-emerald-100/90 font-medium">
                Pedido <span className="font-bold font-mono">#{order.id}</span> • {order.customerName || 'Destinatário'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-all cursor-pointer"
            title="Fechar janela"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-slate-800 dark:text-slate-200">
          
          {/* Target Preset Selector */}
          <div>
            <label className="block text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              Destino do Envio
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {/* Recipient */}
              <button
                type="button"
                onClick={() => handleSelectPreset('recipient')}
                className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  selectedTarget === 'recipient'
                    ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-300 ring-2 ring-emerald-500/20 shadow-xs'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-bold mb-1">
                  <User className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Destinatário</span>
                </div>
                <div className="text-[10.5px] truncate font-semibold">
                  {order.customerName || 'Cliente'}
                </div>
                <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 mt-1">
                  {recipientPhone ? formatPhoneDisplay(recipientPhone) : '(Sem tel)'}
                </div>
              </button>

              {/* Partner */}
              <button
                type="button"
                onClick={() => handleSelectPreset('partner')}
                className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  selectedTarget === 'partner'
                    ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-300 ring-2 ring-emerald-500/20 shadow-xs'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-bold mb-1">
                  <Building2 className="w-3.5 h-3.5 text-blue-600" />
                  <span>Parceiro / Loja</span>
                </div>
                <div className="text-[10.5px] truncate font-semibold">
                  {matchedPartner?.name || order.cliente || 'Parceiro'}
                </div>
                <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 mt-1">
                  {partnerPhone ? formatPhoneDisplay(partnerPhone) : '(Sem tel)'}
                </div>
              </button>

              {/* Courier */}
              <button
                type="button"
                onClick={() => handleSelectPreset('courier')}
                className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  selectedTarget === 'courier'
                    ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-300 ring-2 ring-emerald-500/20 shadow-xs'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-bold mb-1">
                  <Bike className="w-3.5 h-3.5 text-amber-600" />
                  <span>Condutor</span>
                </div>
                <div className="text-[10.5px] truncate font-semibold">
                  {matchedCourier?.name || order.courierName || 'Condutor'}
                </div>
                <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 mt-1">
                  {courierPhone ? formatPhoneDisplay(courierPhone) : '(Sem tel)'}
                </div>
              </button>

              {/* Custom Number */}
              <button
                type="button"
                onClick={() => handleSelectPreset('custom')}
                className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  selectedTarget === 'custom'
                    ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-300 ring-2 ring-emerald-500/20 shadow-xs'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-bold mb-1">
                  <Phone className="w-3.5 h-3.5 text-slate-600" />
                  <span>Outro Número</span>
                </div>
                <div className="text-[10.5px] truncate font-semibold">
                  Digitar Telefone
                </div>
                <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 mt-1">
                  Qualquer WhatsApp
                </div>
              </button>
            </div>
          </div>

          {/* Target Phone Input */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-extrabold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                Número do WhatsApp com DDD
              </label>
              <span className="text-[10px] text-slate-400">
                {cleanPhoneForWhatsApp(phoneInput) ? `Destino formatado: +${cleanPhoneForWhatsApp(phoneInput)}` : 'Digite o DDD e número'}
              </span>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <WhatsAppIcon className="w-4 h-4 text-emerald-600" />
              </div>
              <input
                type="text"
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                placeholder="(11) 98765-4321 ou 11987654321"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-850 border border-slate-300 dark:border-slate-700 rounded-2xl text-xs font-semibold text-slate-900 dark:text-white focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition-all"
              />
            </div>
          </div>

          {/* Protocol Configuration Options */}
          <div className="flex flex-wrap items-center gap-4 p-3 bg-slate-50 dark:bg-slate-850/80 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs">
            <label className="flex items-center gap-2 cursor-pointer select-none font-semibold text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={includeFinancials}
                onChange={(e) => setIncludeFinancials(e.target.checked)}
                className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
              />
              <span>Incluir Valores Financeiros no Texto</span>
            </label>

            <button
              type="button"
              onClick={() => {
                const msg = buildWhatsAppProtocolMessage(order, {
                  partnerName: matchedPartner?.name || order.cliente || order.customerName,
                  includeFinancials,
                  customNotes
                });
                setMessageText(msg);
              }}
              className="ml-auto text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
              title="Restaurar modelo original"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Restaurar Mensagem</span>
            </button>
          </div>

          {/* Message Preview */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-extrabold text-slate-600 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                <span>Pré-visualização da Mensagem Formatada</span>
              </label>
              <span className="text-[10px] text-slate-400">Padrão com negrito e tópicos do WhatsApp</span>
            </div>
            
            <div className="relative">
              <textarea
                rows={8}
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                className="w-full p-3.5 bg-emerald-50/40 dark:bg-slate-950 border border-emerald-200 dark:border-slate-800 rounded-2xl text-[11.5px] font-mono leading-relaxed text-slate-800 dark:text-slate-200 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition-all shadow-inner"
              />
              <button
                type="button"
                onClick={handleCopyMessage}
                className="absolute top-3 right-3 px-2.5 py-1.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm hover:bg-slate-50 hover:border-slate-300 flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
                title="Copiar texto da mensagem"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-600 font-extrabold">Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-500" />
                    <span>Copiar</span>
                  </>
                )}
              </button>
            </div>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="px-5 py-4 bg-slate-50 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {onDownloadPDF && (
              <button
                type="button"
                onClick={onDownloadPDF}
                className="px-3.5 py-2.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 font-bold rounded-2xl border border-slate-300 dark:border-slate-700 text-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                title="Baixar também o arquivo PDF do comprovante assinado"
              >
                <FileText className="w-3.5 h-3.5 text-slate-500" />
                <span>Baixar PDF</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleCopyMessage}
              className="px-4 py-2.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 font-bold rounded-2xl border border-slate-300 dark:border-slate-700 text-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-500" />}
              <span>{copied ? 'Mensagem Copiada!' : 'Copiar Texto'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-xs font-bold rounded-2xl hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-all cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleSendWhatsApp}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-2xl text-xs shadow-lg shadow-emerald-600/25 transition-all flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <WhatsAppIcon className="w-4 h-4" />
              <span>Abrir no WhatsApp</span>
              <ExternalLink className="w-3.5 h-3.5 opacity-80" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ProtocolWhatsAppModal;
