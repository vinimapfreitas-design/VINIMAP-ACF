import React, { useState, useRef, useEffect } from 'react';
import { Camera, PenTool, CheckCircle2, X, RefreshCw, Trash2, ShieldCheck, User, FileText, Image as ImageIcon, Building2, Loader2, Calendar, Clock } from 'lucide-react';
import { Order } from '../types';
import { compressImageFile } from '../lib/imageCompression';
import { formatToBrasiliaDate, formatToBrasiliaTime } from '../utils/dateUtils';

interface DeliveryProtocolModalProps {
  order: Order;
  partnerName?: string;
  isOpen: boolean;
  onClose: () => void;
  onConfirmProtocol: (orderId: string, protocolData: {
    photoUrl?: string;
    signatureData: string;
    signedName: string;
    signedDoc: string;
    notes?: string;
  }) => void;
}

export const DeliveryProtocolModal: React.FC<DeliveryProtocolModalProps> = ({
  order,
  partnerName,
  isOpen,
  onClose,
  onConfirmProtocol
}) => {
  const [signedName, setSignedName] = useState(order.customerName || '');
  const [signedDoc, setSignedDoc] = useState(order.destinatarioCnpjCpf || '');
  const [notes, setNotes] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(order.deliveryProtocol?.photoUrl || order.proofPhotoUrl);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSignedName(order.customerName || '');
      setSignedDoc(order.destinatarioCnpjCpf || '');
      setNotes('');
      setPhotoUrl(order.deliveryProtocol?.photoUrl || order.proofPhotoUrl);
      setErrorMsg(null);
      setTimeout(() => {
        clearCanvas();
      }, 100);
    }
  }, [isOpen, order?.id]);

  // Canvas Drawing logic
  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    if ('touches' in e && e.touches.length > 0) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top
      };
    } else if ('clientX' in e) {
      return {
        x: (e as React.MouseEvent<HTMLCanvasElement>).clientX - rect.left,
        y: (e as React.MouseEvent<HTMLCanvasElement>).clientY - rect.top
      };
    }
    return { x: 0, y: 0 };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    setHasSignature(true);
    const { x, y } = getCoordinates(e);

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.strokeStyle = '#1e3a8a'; // Deep blue signature stroke
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = (e?: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (e) e.preventDefault();
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw subtle baseline line
    ctx.beginPath();
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.moveTo(20, canvas.height - 30);
    ctx.lineTo(canvas.width - 20, canvas.height - 30);
    ctx.stroke();

    // Reset signature text
    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('Assine digitalmente aqui dentro', 30, canvas.height - 12);

    setHasSignature(false);
  };

  const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsProcessingPhoto(true);
      setErrorMsg(null);
      try {
        const compressed = await compressImageFile(file, 1200, 1200, 0.75);
        setPhotoUrl(compressed);
      } catch (err) {
        console.warn('Erro ao otimizar foto, usando fallback:', err);
        const reader = new FileReader();
        reader.onloadend = () => {
          setPhotoUrl(reader.result as string);
        };
        reader.readAsDataURL(file);
      } finally {
        setIsProcessingPhoto(false);
      }
    }
  };

  const handleSaveProtocol = () => {
    setErrorMsg(null);

    // 1. Foto é obrigatória
    if (!photoUrl) {
      setErrorMsg('A Foto do comprovante ou canhoto é OBRIGATÓRIA para confirmar a entrega.');
      return;
    }

    // 2. Nome do recebedor é obrigatório
    if (!signedName.trim()) {
      setErrorMsg('Por favor, informe o Nome Completo de quem recebeu o pedido (obrigatório).');
      return;
    }

    // 3. Assinatura digital é opcional
    const canvas = canvasRef.current;
    let signatureData = '';
    if (hasSignature && canvas) {
      signatureData = canvas.toDataURL('image/png');
    }

    onConfirmProtocol(order.id, {
      photoUrl,
      signatureData,
      signedName: signedName.trim(),
      signedDoc: signedDoc.trim(),
      notes: notes.trim()
    });

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-3 md:p-6 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden border border-slate-200 animate-scale-in my-auto">
        
        {/* Header */}
        <div className="bg-slate-900 text-white p-4 md:p-5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
              <ShieldCheck size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-extrabold text-base text-white flex items-center gap-2">
                  <span>Protocolo de Entrega</span>
                  <span className="text-xs bg-emerald-500 text-slate-950 px-2 py-0.5 rounded-full font-black">
                    #{order.id}
                  </span>
                </h3>
                {partnerName && (
                  <span className="text-[10px] font-bold bg-blue-950/90 text-blue-300 border border-blue-700/80 px-2 py-0.5 rounded-md flex items-center gap-1">
                    <Building2 size={10} className="text-blue-400" />
                    <span>{partnerName}</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 font-medium truncate max-w-xs md:max-w-sm mt-0.5">
                Destinatário: <span className="text-slate-200 font-semibold">{order.customerName}</span> • {order.address}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 md:p-6 space-y-5 max-h-[80vh] overflow-y-auto">

          {errorMsg && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-2xl flex items-center gap-2">
              <span className="text-base">⚠️</span>
              <span>{errorMsg}</span>
            </div>
          )}

          {/* SEQUÊNCIA 1: Foto Comprovante / Canhoto (OBRIGATÓRIO) */}
          <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-900 font-extrabold text-xs uppercase tracking-wider">
                <Camera size={16} className="text-blue-600" />
                <span>1. Foto do Comprovante ou Canhoto</span>
              </div>
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200">
                Obrigatório *
              </span>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              capture="environment"
              onChange={handlePhotoCapture}
              className="hidden"
            />

            {isProcessingPhoto ? (
              <div className="w-full py-6 px-4 bg-blue-50/80 border-2 border-dashed border-blue-400 rounded-2xl flex flex-col items-center justify-center gap-2.5">
                <Loader2 size={28} className="animate-spin text-blue-600" />
                <div className="text-center">
                  <span className="text-xs font-black text-blue-900 block">Otimizando foto do comprovante...</span>
                  <span className="text-[11px] text-blue-600 font-medium block mt-0.5">Compactando em alta definição para envio instantâneo</span>
                </div>
              </div>
            ) : photoUrl ? (
              <div className="relative rounded-2xl overflow-hidden border-2 border-emerald-500 bg-slate-950 group max-h-52 flex items-center justify-center shadow-md">
                <img src={photoUrl} alt="Comprovante de entrega" className="w-full h-52 object-cover" />
                <div className="absolute top-2.5 left-2.5 bg-emerald-600 text-white font-black text-[10px] px-2.5 py-0.5 rounded-full shadow-md flex items-center gap-1">
                  <CheckCircle2 size={12} /> Foto Anexada com Sucesso
                </div>
                <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3.5 py-2 bg-white text-slate-900 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg cursor-pointer hover:bg-slate-100"
                  >
                    <RefreshCw size={14} /> Tirar Outra Foto
                  </button>
                  <button
                    type="button"
                    onClick={() => setPhotoUrl(undefined)}
                    className="px-3.5 py-2 bg-red-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg cursor-pointer hover:bg-red-700"
                  >
                    <Trash2 size={14} /> Remover
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-5 px-4 border-2 border-dashed border-blue-300 hover:border-blue-600 bg-white hover:bg-blue-50/60 rounded-2xl flex flex-col items-center justify-center gap-2.5 transition-all group cursor-pointer shadow-xs"
              >
                <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform shadow-xs">
                  <Camera size={24} />
                </div>
                <div className="text-center">
                  <span className="text-xs font-extrabold text-slate-800 block">Tirar Foto do Canhoto / Comprovante</span>
                  <span className="text-[11px] text-blue-600 font-semibold block mt-0.5">Toque aqui para abrir a câmera do celular</span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">Obrigatório registrar a foto física do pacote ou documento assinado</span>
                </div>
              </button>
            )}
          </div>

          {/* SEQUÊNCIA 2: Nome do Recebedor (OBRIGATÓRIO) */}
          <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-900 font-extrabold text-xs uppercase tracking-wider">
                <User size={16} className="text-blue-600" />
                <span>2. Dados de Quem Recebeu</span>
              </div>
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200">
                Nome Obrigatório *
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-extrabold text-slate-700 mb-1">
                  Nome Completo do Recebedor <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  value={signedName}
                  onChange={(e) => { setSignedName(e.target.value); setErrorMsg(null); }}
                  placeholder="Nome de quem recebeu"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none shadow-xs"
                  required
                />
              </div>

              {/* CARD DE DATA E HORA DO PROTOCOLO (IMEDIATAMENTE APÓS O NOME DO RECEBEDOR) */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <Clock size={12} className="text-blue-600" />
                  <span>Data e Hora da Entrega</span>
                </label>
                <div className="w-full px-3.5 py-2.5 bg-slate-100/90 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 flex items-center gap-1.5 shadow-xs">
                  <Calendar size={12} className="text-slate-500" />
                  <span>{formatToBrasiliaDate(new Date())} {formatToBrasiliaTime(new Date())}</span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Documento (CPF / RG / Matrícula) <span className="text-slate-400 font-normal">(Opcional)</span>
                </label>
                <input
                  type="text"
                  value={signedDoc}
                  onChange={(e) => setSignedDoc(e.target.value)}
                  placeholder="Ex: 12.345.678-9"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none shadow-xs"
                />
              </div>
            </div>
          </div>

          {/* SEQUÊNCIA 3: Assinatura Digital na Tela (OPCIONAL) */}
          <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-900 font-extrabold text-xs uppercase tracking-wider">
                <PenTool size={16} className="text-slate-600" />
                <span>3. Assinatura Digital na Tela</span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                  Opcional
                </span>
                {hasSignature && (
                  <button
                    type="button"
                    onClick={clearCanvas}
                    className="text-[10px] text-slate-500 hover:text-red-600 font-bold flex items-center gap-1 bg-white hover:bg-red-50 px-2 py-0.5 rounded-lg border border-slate-200 transition-colors cursor-pointer"
                  >
                    <Trash2 size={11} />
                    <span>Limpar</span>
                  </button>
                )}
              </div>
            </div>

            <p className="text-[10px] text-slate-500">
              Caso o recebedor prefira assinar no celular, use o espaço abaixo com o dedo. (Não obrigatório se a foto do comprovante foi tirada).
            </p>

            <div className="border-2 border-dashed border-slate-300 rounded-2xl bg-white relative overflow-hidden select-none touch-none shadow-inner">
              <canvas
                ref={canvasRef}
                width={440}
                height={140}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                className="w-full h-36 cursor-crosshair bg-white"
              />

              {hasSignature && (
                <div className="absolute top-2 right-2 bg-emerald-500 text-slate-950 font-extrabold text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                  <CheckCircle2 size={12} /> Assinatura Coletada
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Observações da Entrega (Opcional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Entregue na portaria, recebido pelo zelador..."
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:border-blue-600 focus:outline-none"
            />
          </div>

        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          
          <button
            type="button"
            onClick={handleSaveProtocol}
            disabled={isProcessingPhoto}
            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 disabled:cursor-not-allowed text-white font-extrabold text-xs rounded-xl shadow-lg shadow-emerald-600/20 flex items-center gap-2 transition-all cursor-pointer active:scale-95"
          >
            {isProcessingPhoto ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
            <span>{isProcessingPhoto ? 'Processando Foto...' : 'Concluir e Finalizar Entrega'}</span>
          </button>
        </div>

      </div>
    </div>
  );
};

export default DeliveryProtocolModal;
