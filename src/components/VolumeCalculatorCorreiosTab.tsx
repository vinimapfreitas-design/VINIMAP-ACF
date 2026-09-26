import React, { useState, useMemo, useEffect } from 'react';
import { 
  Box, 
  Package, 
  Truck, 
  Calculator, 
  Plus, 
  Trash2, 
  Copy, 
  Printer, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldCheck, 
  Send, 
  RotateCcw, 
  ExternalLink, 
  MapPin, 
  Info, 
  Sparkles, 
  ArrowRight, 
  Check, 
  Scale, 
  Maximize2, 
  HelpCircle,
  Clock,
  Layers,
  FileText
} from 'lucide-react';
import { Order, PartnerClient } from '../types';
import { formatToBrasiliaDate, formatToBrasiliaTime } from '../utils/dateUtils';

export interface VolumeItem {
  id: string;
  name: string;
  packageType: 'box' | 'envelope' | 'cylinder';
  length: number; // Comprimento em cm
  width: number;  // Largura em cm
  height: number; // Altura em cm
  diameter?: number; // Para cilindro em cm
  weightKg: number; // Peso Real em kg
  quantity: number;
}

export interface CorreiosServiceOption {
  code: string;
  name: string;
  badge: string;
  estimatedDays: string;
  basePrice: number;
  weightPrice: number;
  insurancePrice: number;
  additionalServicesPrice: number;
  totalPrice: number;
  isAvailable: boolean;
  unavailableReason?: string;
}

interface VolumeCalculatorCorreiosTabProps {
  orders?: Order[];
  onAddOrder?: (newOrderData: Omit<Order, 'id' | 'time'>) => Promise<void> | void;
  partnerClients?: PartnerClient[];
  currentUser?: any;
  onNavigateToTab?: (tab: string) => void;
}

// Predefinições de caixas padrão oficiais dos Correios
const CORREIOS_STANDARD_BOXES = [
  { id: 'box_1', name: 'Caixa Tipo 1 (P)', length: 16, width: 11, height: 3, desc: 'Pequenos itens, cabos, bijuterias' },
  { id: 'box_2', name: 'Caixa Tipo 2', length: 27, width: 18, height: 9, desc: 'Cosméticos, livros, peças pequenas' },
  { id: 'box_3', name: 'Caixa Tipo 3 (M)', length: 28, width: 21, height: 11, desc: 'Eletrônicos, roupas leves, calçados' },
  { id: 'box_4', name: 'Caixa Tipo 4', length: 36, width: 27, height: 18, desc: 'Vestuário volumoso, calçados com caixa' },
  { id: 'box_5', name: 'Caixa Tipo 5 (G)', length: 54, width: 36, height: 27, desc: 'Grandes volumes, casacos, eletros' },
  { id: 'envelope_1', name: 'Envelope de Segurança', length: 26, width: 18, height: 1, desc: 'Documentos e itens ultrafinos' },
  { id: 'cylinder_1', name: 'Tubo / Rolo Padrão', length: 50, width: 10, height: 10, diameter: 10, desc: 'Plantas, cartazes, tapetes' },
];

export const VolumeCalculatorCorreiosTab: React.FC<VolumeCalculatorCorreiosTabProps> = ({
  orders = [],
  onAddOrder,
  partnerClients = [],
  currentUser,
  onNavigateToTab
}) => {
  // Lista de Volumes
  const [volumes, setVolumes] = useState<VolumeItem[]>([
    {
      id: 'vol_1',
      name: 'Volume 1 (Caixa Padrão)',
      packageType: 'box',
      length: 28,
      width: 21,
      height: 11,
      weightKg: 0.850,
      quantity: 1
    }
  ]);

  // Fator cúbico dos Correios (padrão 6000 cm³/kg)
  const [cubicFactor, setCubicFactor] = useState<number>(6000);
  // Regra de isenção dos Correios: peso cubado <= 5kg não fatura por cubagem
  const [apply5KgExemption, setApply5KgExemption] = useState<boolean>(true);

  // Parâmetros de rota e cotação
  const [originCep, setOriginCep] = useState<string>('01001-000'); // Padrão São Paulo Capital
  const [originCity, setOriginCity] = useState<string>('São Paulo/SP');
  const [destCep, setDestCep] = useState<string>('20040-000'); // Padrão Rio de Janeiro
  const [destCity, setDestCity] = useState<string>('Rio de Janeiro/RJ');
  const [destAddress, setDestAddress] = useState<string>('Rua da Assembleia');
  const [destBairro, setDestBairro] = useState<string>('Centro');
  const [destNumber, setDestNumber] = useState<string>('10');
  const [destComplement, setDestComplement] = useState<string>('');
  const [recipientName, setRecipientName] = useState<string>('Cliente Exemplo');
  const [recipientPhone, setRecipientPhone] = useState<string>('11999998888');
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>('');
  const [declaredValue, setDeclaredValue] = useState<number>(150); // R$
  const [hasAR, setHasAR] = useState<boolean>(false); // Aviso de Recebimento
  const [hasMP, setHasMP] = useState<boolean>(false); // Mão Própria
  const [isLoadingCep, setIsLoadingCep] = useState<boolean>(false);
  const [selectedServiceCode, setSelectedServiceCode] = useState<string>('SEDEX');

  // Estado para feedback de cópia e modal de pedido
  const [copiedNotification, setCopiedNotification] = useState<string | null>(null);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState<boolean>(false);
  const [orderSuccessMessage, setOrderSuccessMessage] = useState<string | null>(null);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState<boolean>(false);

  // Função para consultar CEP via ViaCEP
  const handleFetchDestCep = async (cepInput: string) => {
    const cleaned = cepInput.replace(/\D/g, '');
    if (cleaned.length !== 8) return;

    setIsLoadingCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cleaned}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setDestCity(`${data.localidade}/${data.uf}`);
        setDestAddress(data.logradouro || '');
        setDestBairro(data.bairro || '');
      }
    } catch (err) {
      console.warn('Erro ao consultar ViaCEP:', err);
    } finally {
      setIsLoadingCep(false);
    }
  };

  // Funções para manipular volumes
  const handleAddVolume = () => {
    const newId = `vol_${Date.now()}`;
    setVolumes(prev => [
      ...prev,
      {
        id: newId,
        name: `Volume ${prev.length + 1}`,
        packageType: 'box',
        length: 27,
        width: 18,
        height: 9,
        weightKg: 0.500,
        quantity: 1
      }
    ]);
  };

  const handleRemoveVolume = (id: string) => {
    if (volumes.length <= 1) return;
    setVolumes(prev => prev.filter(v => v.id !== id));
  };

  const handleUpdateVolume = (id: string, updates: Partial<VolumeItem>) => {
    setVolumes(prev => prev.map(v => v.id === id ? { ...v, ...updates } : v));
  };

  const handleApplyStandardBox = (volumeId: string, boxId: string) => {
    const std = CORREIOS_STANDARD_BOXES.find(b => b.id === boxId);
    if (!std) return;

    handleUpdateVolume(volumeId, {
      name: std.name,
      packageType: std.id.includes('envelope') ? 'envelope' : std.id.includes('cylinder') ? 'cylinder' : 'box',
      length: std.length,
      width: std.width,
      height: std.height,
      diameter: std.diameter || std.width
    });
  };

  // CÁLCULOS TÉCNICOS DE CUBAGEM E LIMITES DOS CORREIOS 2026
  const volumeCalculations = useMemo(() => {
    let totalRealWeight = 0;
    let totalCubicWeight = 0;
    let totalVolumeCm3 = 0;
    let hasSpecialHandlingCharge = false;
    const warnings: string[] = [];

    volumes.forEach((vol, idx) => {
      const qty = Math.max(1, vol.quantity || 1);
      const c = vol.length;
      const l = vol.width;
      const a = vol.height;
      const weight = vol.weightKg;

      const singleVolumeCm3 = c * l * a;
      const singleCubicWeight = singleVolumeCm3 / cubicFactor;

      totalRealWeight += weight * qty;
      totalVolumeCm3 += singleVolumeCm3 * qty;
      totalCubicWeight += singleCubicWeight * qty;

      // Validação Limites Oficiais Correios 2026:
      // Comprimento: 15 a 100 cm | Largura: 10 a 100 cm | Altura: 1 a 100 cm
      // Soma (C + L + A): 26 a 200 cm
      const sumDimensions = c + l + a;

      if (c < 15 || l < 10 || a < 1) {
        warnings.push(`Volume ${idx + 1}: Dimensões abaixo do mínimo Correios (mín 15×10×1 cm).`);
      }
      if (c > 100 || l > 100 || a > 100) {
        warnings.push(`Volume ${idx + 1}: Alguma dimensão excede o limite máximo permitido de 100 cm.`);
      }
      if (sumDimensions < 26) {
        warnings.push(`Volume ${idx + 1}: Soma das dimensões (${sumDimensions.toFixed(0)}cm) inferior ao mínimo de 26 cm.`);
      }
      if (sumDimensions > 200) {
        warnings.push(`Volume ${idx + 1}: Soma das dimensões (${sumDimensions.toFixed(0)}cm) ultrapassa o limite de 200 cm.`);
      }

      // Taxa de Manuseio Especial / Grandes Formatos Correios (R$ 85,00):
      // Se qualquer dimensão > 70 cm ou formato cilíndrico
      if (c > 70 || l > 70 || a > 70 || vol.packageType === 'cylinder') {
        hasSpecialHandlingCharge = true;
      }
    });

    // Regra Oficial Correios de Peso Faturado / Tarifado:
    // Se o peso cúbico for menor ou igual a 5 kg, cobra o peso real.
    // Acima de 5 kg, cobra o maior entre peso real e peso cúbico.
    let billedWeight = totalRealWeight;
    let billedBy: 'real' | 'cubic' = 'real';

    if (apply5KgExemption) {
      if (totalCubicWeight <= 5.0) {
        billedWeight = totalRealWeight;
        billedBy = 'real';
      } else {
        billedWeight = Math.max(totalRealWeight, totalCubicWeight);
        billedBy = totalCubicWeight > totalRealWeight ? 'cubic' : 'real';
      }
    } else {
      billedWeight = Math.max(totalRealWeight, totalCubicWeight);
      billedBy = totalCubicWeight > totalRealWeight ? 'cubic' : 'real';
    }

    const totalVolumeM3 = totalVolumeCm3 / 1000000;

    return {
      totalRealWeight: Number(totalRealWeight.toFixed(3)),
      totalCubicWeight: Number(totalCubicWeight.toFixed(3)),
      totalVolumeCm3: Math.round(totalVolumeCm3),
      totalVolumeM3: Number(totalVolumeM3.toFixed(4)),
      billedWeight: Number(billedWeight.toFixed(3)),
      billedBy,
      hasSpecialHandlingCharge,
      warnings
    };
  }, [volumes, cubicFactor, apply5KgExemption]);

  // CÁLCULO DE TARIFAS CORREIOS 2026 (PAC, SEDEX, SEDEX 12, SEDEX 10, Mini Envios)
  const correiosServices = useMemo<CorreiosServiceOption[]>(() => {
    const { billedWeight, hasSpecialHandlingCharge } = volumeCalculations;

    // Detectar Região estimada a partir do CEP
    const origUf = originCity.split('/')[1] || 'SP';
    const destUf = destCity.split('/')[1] || 'RJ';
    const isSameState = origUf.toUpperCase() === destUf.toUpperCase();
    const isLocal = originCity.toLowerCase().includes('são paulo') && destCity.toLowerCase().includes('são paulo');

    // Taxa Adicional de Manuseio Especial / Grandes Formatos Correios (Portaria 2026)
    const specialHandlingFee = hasSpecialHandlingCharge ? 85.0 : 0.0;

    // Serviços Adicionais
    const arFee = hasAR ? 7.90 : 0.0;
    const mpFee = hasMP ? 9.50 : 0.0;
    const additionalServicesTotal = specialHandlingFee + arFee + mpFee;

    // Seguro Ad-Valorem Correios:
    // Gratuito até R$ 24,50 (PAC) ou R$ 49,00 (SEDEX). Excedente cobra 1.5%
    const declared = Math.max(0, declaredValue || 0);
    const pacInsurance = declared > 24.50 ? (declared - 24.50) * 0.015 : 0;
    const sedexInsurance = declared > 49.00 ? (declared - 49.00) * 0.015 : 0;

    // Coeficientes de Tarifas Correios 2026 (Base até 300g + adicional por kg tarifado)
    let sedexBase = isLocal ? 22.80 : isSameState ? 28.50 : 38.90;
    let sedexKgRate = isLocal ? 3.90 : isSameState ? 5.20 : 7.50;
    let sedexDays = isLocal ? '1 dia útil' : isSameState ? '1 a 2 dias úteis' : '2 a 3 dias úteis';

    let pacBase = isLocal ? 16.90 : isSameState ? 21.40 : 29.80;
    let pacKgRate = isLocal ? 2.50 : isSameState ? 3.40 : 4.80;
    let pacDays = isLocal ? '3 a 5 dias úteis' : isSameState ? '4 a 7 dias úteis' : '5 a 9 dias úteis';

    // Peso excedente (acima de 300g / 0.3kg)
    const excessWeight = Math.max(0, billedWeight - 0.3);
    const sedexWeightFee = excessWeight * sedexKgRate;
    const pacWeightFee = excessWeight * pacKgRate;

    // SEDEX Padrão
    const sedexTotal = sedexBase + sedexWeightFee + sedexInsurance + additionalServicesTotal;

    // PAC Padrão
    const pacTotal = pacBase + pacWeightFee + pacInsurance + additionalServicesTotal;

    // SEDEX 12 (+25% sobre SEDEX)
    const sedex12Total = sedexTotal * 1.25;

    // SEDEX 10 (+40% sobre SEDEX)
    const sedex10Total = sedexTotal * 1.40;

    // Mini Envios (PAC Mini): apenas pacotes com peso até 300g e sem manuseio especial
    const isMiniAvailable = billedWeight <= 0.3 && !hasSpecialHandlingCharge && volumes.length === 1 && volumes[0].height <= 4;
    const miniTotal = isMiniAvailable ? 14.90 + arFee : 0;

    return [
      {
        code: 'SEDEX',
        name: 'SEDEX Expresso',
        badge: 'Mais Rápido',
        estimatedDays: sedexDays,
        basePrice: sedexBase,
        weightPrice: sedexWeightFee,
        insurancePrice: sedexInsurance,
        additionalServicesPrice: additionalServicesTotal,
        totalPrice: Number(sedexTotal.toFixed(2)),
        isAvailable: billedWeight <= 30
      },
      {
        code: 'PAC',
        name: 'PAC Econômico',
        badge: 'Melhor Custo-Benefício',
        estimatedDays: pacDays,
        basePrice: pacBase,
        weightPrice: pacWeightFee,
        insurancePrice: pacInsurance,
        additionalServicesPrice: additionalServicesTotal,
        totalPrice: Number(pacTotal.toFixed(2)),
        isAvailable: billedWeight <= 30
      },
      {
        code: 'SEDEX_12',
        name: 'SEDEX 12',
        badge: 'Entrega até 12h',
        estimatedDays: 'Até as 12h do dia seguinte',
        basePrice: sedexBase * 1.25,
        weightPrice: sedexWeightFee * 1.25,
        insurancePrice: sedexInsurance,
        additionalServicesPrice: additionalServicesTotal,
        totalPrice: Number(sedex12Total.toFixed(2)),
        isAvailable: billedWeight <= 10 && (isLocal || isSameState),
        unavailableReason: billedWeight > 10 ? 'Limite 10kg' : 'Disponível apenas polos metropolitanos'
      },
      {
        code: 'SEDEX_10',
        name: 'SEDEX 10',
        badge: 'Entrega até 10h',
        estimatedDays: 'Até as 10h do dia seguinte',
        basePrice: sedexBase * 1.40,
        weightPrice: sedexWeightFee * 1.40,
        insurancePrice: sedexInsurance,
        additionalServicesPrice: additionalServicesTotal,
        totalPrice: Number(sedex10Total.toFixed(2)),
        isAvailable: billedWeight <= 10 && isLocal,
        unavailableReason: 'Disponível exclusivamente para capitais e polos habilitados'
      },
      {
        code: 'MINI_ENVIOS',
        name: 'PAC Mini (Mini Envios)',
        badge: 'Até 300g',
        estimatedDays: '5 a 12 dias úteis',
        basePrice: 14.90,
        weightPrice: 0,
        insurancePrice: 0,
        additionalServicesPrice: arFee,
        totalPrice: Number(miniTotal.toFixed(2)),
        isAvailable: isMiniAvailable,
        unavailableReason: !isMiniAvailable ? 'Apenas pacotes até 300g e espessura até 4cm' : undefined
      }
    ];
  }, [volumeCalculations, originCity, destCity, declaredValue, hasAR, hasMP, volumes]);

  const activeSelectedService = useMemo(() => {
    return correiosServices.find(s => s.code === selectedServiceCode) || correiosServices[0];
  }, [correiosServices, selectedServiceCode]);

  // COPIAR COTAÇÃO PROFISSIONAL PARA WHATSAPP
  const handleCopyQuote = () => {
    const text = `📦 *COTAÇÃO DE VOLUMES E FRETES - MODELO CORREIOS 2026*
📍 *Origem:* ${originCity} (CEP ${originCep})
🏁 *Destino:* ${destCity} (CEP ${destCep})
---------------------------------------
📦 *Resumo dos Volumes:*
• Qtd de Volumes: ${volumes.reduce((acc, v) => acc + (v.quantity || 1), 0)} vol(s)
• Peso Real Balança: ${volumeCalculations.totalRealWeight} kg
• Peso Cubado: ${volumeCalculations.totalCubicWeight} kg
• Peso Tarifado Faturado: *${volumeCalculations.billedWeight} kg* (${volumeCalculations.billedBy === 'cubic' ? 'Cobrança por Volume/Cubagem' : 'Cobrança por Peso Físico'})
• Dimensões: ${volumes.map(v => `${v.length}x${v.width}x${v.height}cm`).join(' | ')}
---------------------------------------
🚚 *Opções de Frete Vigentes:*
• *${activeSelectedService.name}*: R$ ${activeSelectedService.totalPrice.toFixed(2)} (${activeSelectedService.estimatedDays})
• *PAC Econômico*: R$ ${correiosServices.find(s => s.code === 'PAC')?.totalPrice.toFixed(2)}
• *SEDEX Expresso*: R$ ${correiosServices.find(s => s.code === 'SEDEX')?.totalPrice.toFixed(2)}
---------------------------------------
✅ Cotação gerada via *ViniMap Fleet* • Portaria Correios 2026`;

    navigator.clipboard.writeText(text);
    setCopiedNotification('Cotação copiada com sucesso para o WhatsApp!');
    setTimeout(() => setCopiedNotification(null), 3500);
  };

  // IMPRIMIR ESPELHO DE COTAÇÃO
  const handlePrintQuote = () => {
    window.print();
  };

  // GERAÇÃO INSTANTÂNEA DE PEDIDO
  const handleGenerateOrderInstant = async () => {
    if (!onAddOrder) {
      alert('Função de inclusão de pedidos não está disponível.');
      return;
    }

    setIsSubmittingOrder(true);
    try {
      const clientName = recipientName.trim() || 'Cliente sem nome';
      const fullAddress = `${destAddress}${destNumber ? `, ${destNumber}` : ''}${destBairro ? ` - ${destBairro}` : ''}${destComplement ? ` (${destComplement})` : ''} - ${destCity}`;
      
      const volumeSummary = `${volumes.length} vol(s) - ${volumes.map(v => `${v.length}x${v.width}x${v.height}cm (${v.weightKg}kg)`).join(', ')}`;
      const obsNote = `[MODELO CORREIOS 2026 - ${activeSelectedService.name}] P.Real: ${volumeCalculations.totalRealWeight}kg | P.Cubado: ${volumeCalculations.totalCubicWeight}kg | P.Tarifado: ${volumeCalculations.billedWeight}kg (${volumeCalculations.billedBy === 'cubic' ? 'Cubado' : 'Real'}) | Volumes: ${volumeSummary}`;

      const partnerObj = partnerClients.find(p => p.id === selectedPartnerId);

      const newOrderPayload: Omit<Order, 'id' | 'time'> = {
        customerName: clientName,
        address: fullAddress,
        status: 'pending',
        value: activeSelectedService.totalPrice,
        valorEntrega: activeSelectedService.totalPrice,
        valorNotaFiscal: declaredValue,
        region: destCity.split('/')[0] || 'Geral',
        cep: destCep,
        telefone: recipientPhone,
        procurarPor: clientName,
        dataSolicitacao: formatToBrasiliaDate(new Date()),
        volume: volumeSummary,
        weight: volumeCalculations.billedWeight,
        tipoServico: activeSelectedService.name,
        observacao: obsNote,
        codigoCliente: partnerObj?.codigoCliente || partnerObj?.id || 'AVULSO',
        cliente: partnerObj?.name || 'Cliente Direto',
        bairro: destBairro,
        cidadeMunicipio: destCity.split('/')[0] || '',
        estado: destCity.split('/')[1] || '',
        complemento: destComplement
      };

      await onAddOrder(newOrderPayload);

      setOrderSuccessMessage(`Pedido gerado instantaneamente no sistema com o serviço ${activeSelectedService.name} (R$ ${activeSelectedService.totalPrice.toFixed(2)})!`);
      setIsOrderModalOpen(false);
      setTimeout(() => setOrderSuccessMessage(null), 6000);
    } catch (err: any) {
      alert(`Falha ao gerar pedido: ${err?.message || 'Erro inesperado'}`);
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  return (
    <div id="volume-calculator-correios-tab" className="space-y-6 max-w-7xl mx-auto pb-16">
      
      {/* HEADER PRINCIPAL */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950/70 to-slate-900 border border-blue-500/30 rounded-3xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-6 w-72 h-72 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <div className="p-2.5 bg-blue-600/20 text-blue-400 rounded-2xl border border-blue-500/30 shadow-inner">
                <Box size={24} className="text-blue-400 animate-pulse" />
              </div>
              <span className="text-xs font-black uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-500/40 px-3 py-1 rounded-full">
                MODELO CORREIOS • TABELA VIGENTE 2026
              </span>
              <span className="text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2.5 py-1 rounded-full flex items-center gap-1">
                <ShieldCheck size={13} />
                Oficial
              </span>
            </div>

            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight flex items-center gap-2">
              <span>Cálculo de Volumes Profissional</span>
            </h1>
            <p className="text-slate-300 text-sm md:text-base font-medium mt-1 max-w-2xl leading-relaxed">
              Calcule cubagem, pesos tarifados, tarifas PAC/SEDEX e gere pedidos instantaneamente.
            </p>
          </div>

          {/* Ações Rápidas de Topo */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              id="btn-copy-quote"
              onClick={handleCopyQuote}
              className="px-4 py-2.5 bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-sm hover:shadow"
              title="Copiar cotação formatada para o WhatsApp"
            >
              <Copy size={14} className="text-blue-400" />
              <span>Copiar WhatsApp</span>
            </button>

            <button
              id="btn-print-quote"
              onClick={handlePrintQuote}
              className="px-4 py-2.5 bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-sm hover:shadow"
              title="Imprimir espelho de volumes e tarifas"
            >
              <Printer size={14} className="text-emerald-400" />
              <span>Imprimir</span>
            </button>

            <button
              id="btn-open-order-modal"
              onClick={() => setIsOrderModalOpen(true)}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-blue-600/30 active:scale-95"
            >
              <Send size={14} />
              <span>Gerar Pedido Instantaneamente</span>
            </button>
          </div>
        </div>

        {/* Notificações em banner flutuante */}
        {copiedNotification && (
          <div className="mt-4 p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-2xl text-emerald-300 text-xs font-bold flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 size={16} />
            <span>{copiedNotification}</span>
          </div>
        )}

        {orderSuccessMessage && (
          <div className="mt-4 p-3 bg-blue-500/20 border border-blue-500/40 rounded-2xl text-blue-200 text-xs font-bold flex items-center justify-between gap-2 animate-fadeIn">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-blue-400" />
              <span>{orderSuccessMessage}</span>
            </div>
            {onNavigateToTab && (
              <button
                onClick={() => onNavigateToTab('orders')}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-[11px] font-black cursor-pointer"
              >
                Ver em Pedidos
              </button>
            )}
          </div>
        )}
      </div>

      {/* GRID PRINCIPAL: VOLUMES + SIMULADOR 3D + TOTAIS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* COLUNA ESQUERDA: CADASTRO E GESTÃO DOS VOLUMES (7 Colunas) */}
        <div className="lg:col-span-7 space-y-6">
          
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Box size={18} className="text-blue-400" />
                <h3 className="text-base font-extrabold text-white">Volumes & Dimensões da Carga</h3>
                <span className="text-[11px] bg-slate-800 text-slate-300 px-2.5 py-0.5 rounded-full font-bold">
                  {volumes.length} {volumes.length === 1 ? 'Volume' : 'Volumes'}
                </span>
              </div>

              <button
                id="btn-add-volume"
                onClick={handleAddVolume}
                className="px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white border border-blue-500/30 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Plus size={14} />
                <span>Adicionar Volume</span>
              </button>
            </div>

            {/* Lista dos Volumes Cadastrados */}
            <div className="space-y-4">
              {volumes.map((vol, index) => {
                const volCm3 = vol.length * vol.width * vol.height;
                const volCubicKg = volCm3 / cubicFactor;
                const volBilledKg = apply5KgExemption && volCubicKg <= 5.0 ? vol.weightKg : Math.max(vol.weightKg, volCubicKg);
                const isOver70 = vol.length > 70 || vol.width > 70 || vol.height > 70;

                return (
                  <div 
                    key={vol.id} 
                    className="p-4 bg-slate-950/70 border border-slate-800 hover:border-slate-700 rounded-2xl space-y-3 transition-all relative"
                  >
                    {/* Cabeçalho do Volume com Predefinições Rápidas */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center text-xs font-black border border-blue-500/30">
                          {index + 1}
                        </span>
                        <input
                          type="text"
                          value={vol.name}
                          onChange={(e) => handleUpdateVolume(vol.id, { name: e.target.value })}
                          className="bg-transparent border-b border-transparent hover:border-slate-700 focus:border-blue-500 text-sm font-black text-white focus:outline-none"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Seletor de Caixas Padrão Correios */}
                        <select
                          onChange={(e) => {
                            if (e.target.value) handleApplyStandardBox(vol.id, e.target.value);
                          }}
                          defaultValue=""
                          className="bg-slate-900 border border-slate-700 text-[11px] font-bold text-slate-300 rounded-lg px-2 py-1 focus:outline-none focus:border-blue-500 cursor-pointer"
                        >
                          <option value="" disabled>Predefinições Correios...</option>
                          {CORREIOS_STANDARD_BOXES.map(b => (
                            <option key={b.id} value={b.id}>
                              {b.name} ({b.length}x{b.width}x{b.height}cm)
                            </option>
                          ))}
                        </select>

                        {volumes.length > 1 && (
                          <button
                            onClick={() => handleRemoveVolume(vol.id)}
                            className="p-1.5 text-slate-500 hover:text-red-400 rounded-lg transition-colors cursor-pointer"
                            title="Remover este volume"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Inputs de Dimensões e Peso */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-1">
                      <div>
                        <label className="text-[10px] text-slate-400 font-bold block mb-1">Comprimento (cm)</label>
                        <input
                          type="number"
                          min="1"
                          max="105"
                          step="0.5"
                          value={vol.length}
                          onChange={(e) => handleUpdateVolume(vol.id, { length: Math.max(1, parseFloat(e.target.value) || 0) })}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-2 text-xs font-black text-white focus:border-blue-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-slate-400 font-bold block mb-1">Largura (cm)</label>
                        <input
                          type="number"
                          min="1"
                          max="105"
                          step="0.5"
                          value={vol.width}
                          onChange={(e) => handleUpdateVolume(vol.id, { width: Math.max(1, parseFloat(e.target.value) || 0) })}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-2 text-xs font-black text-white focus:border-blue-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-slate-400 font-bold block mb-1">Altura (cm)</label>
                        <input
                          type="number"
                          min="0.5"
                          max="105"
                          step="0.5"
                          value={vol.height}
                          onChange={(e) => handleUpdateVolume(vol.id, { height: Math.max(0.5, parseFloat(e.target.value) || 0) })}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-2 text-xs font-black text-white focus:border-blue-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-slate-400 font-bold block mb-1">Peso Real (kg)</label>
                        <input
                          type="number"
                          min="0.05"
                          max="50"
                          step="0.05"
                          value={vol.weightKg}
                          onChange={(e) => handleUpdateVolume(vol.id, { weightKg: Math.max(0.01, parseFloat(e.target.value) || 0) })}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-2 text-xs font-black text-emerald-400 focus:border-blue-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-slate-400 font-bold block mb-1">Qtd Volumes</label>
                        <input
                          type="number"
                          min="1"
                          max="50"
                          value={vol.quantity || 1}
                          onChange={(e) => handleUpdateVolume(vol.id, { quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-2 text-xs font-black text-white focus:border-blue-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Resumo Dinâmico do Volume */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-900 text-[11px]">
                      <div className="flex items-center gap-3 text-slate-400 font-medium">
                        <span>Volume: <strong className="text-white font-bold">{volCm3.toLocaleString('pt-BR')} cm³</strong></span>
                        <span>Peso Cubado: <strong className="text-blue-300 font-bold">{volCubicKg.toFixed(3)} kg</strong></span>
                        <span>Faturado: <strong className="text-emerald-400 font-bold">{volBilledKg.toFixed(3)} kg</strong></span>
                      </div>

                      {isOver70 && (
                        <span className="text-[10px] font-black text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30 flex items-center gap-1">
                          <AlertTriangle size={11} />
                          Taxa Grandes Formatos (+R$ 85)
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Alertas Oficiais de Limites Correios */}
            {volumeCalculations.warnings.length > 0 && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-extrabold text-amber-300">
                  <AlertTriangle size={14} />
                  <span>Atenção aos Limites Operacionais Correios 2026:</span>
                </div>
                {volumeCalculations.warnings.map((w, idx) => (
                  <p key={idx} className="text-[11px] text-amber-200/90 pl-5">
                    • {w}
                  </p>
                ))}
              </div>
            )}
          </div>

          {/* REGRAS TÉCNICAS E CONFIGURAÇÕES DA PORTARIA CORREIOS */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-2">
                <Info size={14} className="text-blue-400" />
                Configurações da Portaria de Tarifação Correios 2026
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-start gap-3 p-3 bg-slate-950/60 rounded-2xl border border-slate-800/80">
                <input
                  type="checkbox"
                  id="chk-apply-5kg"
                  checked={apply5KgExemption}
                  onChange={(e) => setApply5KgExemption(e.target.checked)}
                  className="mt-1 w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <label htmlFor="chk-apply-5kg" className="cursor-pointer">
                  <span className="text-xs font-bold text-white block">Isenção de Cubagem até 5 kg</span>
                  <span className="text-[11px] text-slate-400 leading-relaxed block mt-0.5">
                    Se o peso cubado for ≤ 5,000 kg, prevalece o peso real balança. Acima de 5 kg, cobra o maior.
                  </span>
                </label>
              </div>

              <div className="p-3 bg-slate-950/60 rounded-2xl border border-slate-800/80">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-white">Fator Cúbico Correios</span>
                  <span className="text-xs font-black text-blue-400">{cubicFactor} cm³/kg</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Fator padrão nacional para transporte rodoviário e expresso dos Correios.
                </p>
              </div>
            </div>
          </div>

        </div>

        {/* COLUNA DIREITA: VISUALIZADOR 3D + TOTALIZADORES CONSOLIDADOS (5 Colunas) */}
        <div className="lg:col-span-5 space-y-6">

          {/* VISUALIZADOR GRÁFICO DO PACOTE EM PERSPECTIVA */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                <Layers size={14} className="text-blue-400" />
                Visualizador Gráfico do Pacote
              </span>
              <span className="text-[10px] font-bold text-slate-500">
                Perspectiva Isométrica
              </span>
            </div>

            {/* Canvas SVG com Caixa Isométrica Proporcional */}
            <div className="h-48 bg-slate-950/80 rounded-2xl border border-slate-800/80 flex items-center justify-center relative overflow-hidden p-4">
              <svg viewBox="0 0 240 160" className="w-full h-full max-w-[220px] drop-shadow-md">
                {/* Face Superior */}
                <polygon 
                  points="120,30 180,60 120,90 60,60" 
                  fill="#1e293b" 
                  stroke="#38bdf8" 
                  strokeWidth="1.5"
                  className="transition-all duration-300"
                />
                {/* Face Esquerda */}
                <polygon 
                  points="60,60 120,90 120,140 60,110" 
                  fill="#0f172a" 
                  stroke="#0284c7" 
                  strokeWidth="1.5" 
                  className="transition-all duration-300"
                />
                {/* Face Direita */}
                <polygon 
                  points="120,90 180,60 180,110 120,140" 
                  fill="#1e293b" 
                  stroke="#0369a1" 
                  strokeWidth="1.5" 
                  className="transition-all duration-300"
                />
                {/* Linhas de fita adesiva Correios */}
                <line x1="120" y1="30" x2="120" y2="90" stroke="#f59e0b" strokeWidth="2" strokeDasharray="3 3" />
                <line x1="120" y1="90" x2="120" y2="140" stroke="#f59e0b" strokeWidth="2" strokeDasharray="3 3" />

                {/* Etiquetas de Cotas */}
                <text x="120" y="22" textAnchor="middle" fill="#94a3b8" fontSize="10" fontWeight="bold">
                  C: {volumes[0]?.length || 0} cm
                </text>
                <text x="40" y="85" textAnchor="middle" fill="#94a3b8" fontSize="10" fontWeight="bold">
                  L: {volumes[0]?.width || 0} cm
                </text>
                <text x="200" y="100" textAnchor="middle" fill="#94a3b8" fontSize="10" fontWeight="bold">
                  A: {volumes[0]?.height || 0} cm
                </text>
              </svg>

              <div className="absolute bottom-2 left-3 text-[10px] font-bold text-slate-400">
                Volume Total: <span className="text-white">{volumeCalculations.totalVolumeM3} m³</span>
              </div>
              <div className="absolute bottom-2 right-3 text-[10px] font-bold text-blue-400">
                {volumeCalculations.totalVolumeCm3.toLocaleString('pt-BR')} cm³
              </div>
            </div>
          </div>

          {/* CARD PRINCIPAL: PESO TARIFADO FATURADO (CORREIOS 2026) */}
          <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950/70 border-2 border-blue-500/40 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase text-blue-300 tracking-wider flex items-center gap-1.5">
                <Scale size={15} className="text-blue-400" />
                Resultado de Faturamento Oficial
              </span>
              <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full border ${
                volumeCalculations.billedBy === 'cubic'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
              }`}>
                {volumeCalculations.billedBy === 'cubic' ? 'Faturado por Cubagem' : 'Faturado por Peso Real'}
              </span>
            </div>

            <div>
              <span className="text-[11px] text-slate-400 font-bold block uppercase tracking-wider">
                Peso Tarifado Final (Para Cálculo de Frete)
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-4xl font-black text-white tracking-tight">
                  {volumeCalculations.billedWeight.toFixed(3)}
                </span>
                <span className="text-lg font-bold text-slate-300">kg</span>
              </div>
              <p className="text-xs text-slate-400 mt-1 font-medium">
                {volumeCalculations.billedBy === 'cubic' 
                  ? `Prevaleceu a cubagem do pacote (${volumeCalculations.totalCubicWeight} kg) por exceder o peso real da balança (${volumeCalculations.totalRealWeight} kg).`
                  : `Prevaleceu o peso físico da balança (${volumeCalculations.totalRealWeight} kg)${volumeCalculations.totalCubicWeight <= 5.0 && apply5KgExemption ? ' (cubagem isenta por ser ≤ 5 kg).' : '.'}`}
              </p>
            </div>

            {/* Grid de Comparação Rápida Balança x Cubagem */}
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800">
              <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800">
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Peso Balança (Real)</span>
                <span className="text-base font-black text-emerald-400 mt-0.5 block">
                  {volumeCalculations.totalRealWeight.toFixed(3)} kg
                </span>
              </div>

              <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800">
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Peso Cúbico (Volumétrico)</span>
                <span className="text-base font-black text-blue-400 mt-0.5 block">
                  {volumeCalculations.totalCubicWeight.toFixed(3)} kg
                </span>
              </div>
            </div>

            {/* Taxa de Grandes Formatos */}
            {volumeCalculations.hasSpecialHandlingCharge && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-between text-xs font-bold text-amber-300">
                <span className="flex items-center gap-1.5">
                  <AlertTriangle size={14} />
                  Taxa de Manuseio Especial Correios:
                </span>
                <span className="font-black">+ R$ 85,00</span>
              </div>
            )}
          </div>

        </div>

      </div>

      {/* SEÇÃO 2: SIMULADOR DE TARIFAS CORREIOS 2026 (PAC, SEDEX, MINI) */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Truck size={20} className="text-blue-400" />
              <h2 className="text-lg font-black text-white">Simulador de Tarifas e Prazos Correios 2026</h2>
            </div>
            <p className="text-slate-400 text-xs font-medium mt-0.5">
              Cálculo baseado no peso tarifado de <strong>{volumeCalculations.billedWeight.toFixed(3)} kg</strong> com a tabela oficial de serviços expressos e econômicos.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
            <Clock size={14} className="text-blue-400" />
            <span>Prazos calculados a partir da postagem</span>
          </div>
        </div>

        {/* Formulário de Rota e Parâmetros de Envio */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* CEP Origem */}
          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1.5">CEP de Origem (Remetente)</label>
            <input
              type="text"
              value={originCep}
              onChange={(e) => setOriginCep(e.target.value)}
              placeholder="01001-000"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white focus:border-blue-500 focus:outline-none"
            />
            <span className="text-[11px] text-slate-400 mt-1 block truncate">{originCity}</span>
          </div>

          {/* CEP Destino com Busca Automática */}
          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1.5 flex items-center justify-between">
              <span>CEP Destino</span>
              {isLoadingCep && <span className="text-[10px] text-blue-400 animate-pulse">Buscando...</span>}
            </label>
            <input
              type="text"
              value={destCep}
              onChange={(e) => {
                setDestCep(e.target.value);
                if (e.target.value.replace(/\D/g, '').length === 8) {
                  handleFetchDestCep(e.target.value);
                }
              }}
              placeholder="20040-000"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white focus:border-blue-500 focus:outline-none"
            />
            <span className="text-[11px] text-blue-300 mt-1 block truncate">{destCity}</span>
          </div>

          {/* Valor Declarado / Seguro Ad-Valorem */}
          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1.5">Valor Declarado (NF-e)</label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">R$</span>
              <input
                type="number"
                min="0"
                step="10"
                value={declaredValue}
                onChange={(e) => setDeclaredValue(Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-2 text-xs font-bold text-emerald-400 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block">Seguro oficial Correios (1,5%)</span>
          </div>

          {/* Serviços Adicionais (AR & Mão Própria) */}
          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1.5">Serviços Adicionais</label>
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-300">
                <input
                  type="checkbox"
                  checked={hasAR}
                  onChange={(e) => setHasAR(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <span>Aviso de Recebimento (AR) +R$ 7,90</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-300">
                <input
                  type="checkbox"
                  checked={hasMP}
                  onChange={(e) => setHasMP(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <span>Mão Própria (MP) +R$ 9,50</span>
              </label>
            </div>
          </div>
        </div>

        {/* CARDS COMPARATIVOS DOS SERVIÇOS CORREIOS 2026 */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
          {correiosServices.map((srv) => {
            const isSelected = selectedServiceCode === srv.code;

            return (
              <div
                key={srv.code}
                onClick={() => {
                  if (srv.isAvailable) setSelectedServiceCode(srv.code);
                }}
                className={`p-4 rounded-2xl border transition-all relative flex flex-col justify-between ${
                  !srv.isAvailable
                    ? 'bg-slate-950/40 border-slate-800/60 opacity-60 cursor-not-allowed'
                    : isSelected
                    ? 'bg-gradient-to-b from-blue-950/80 to-slate-900 border-blue-500 shadow-lg shadow-blue-600/20 cursor-pointer'
                    : 'bg-slate-950/70 border-slate-800 hover:border-slate-700 cursor-pointer'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${
                      srv.code.includes('SEDEX') 
                        ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                        : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    }`}>
                      {srv.badge}
                    </span>

                    {isSelected && srv.isAvailable && (
                      <span className="w-4 h-4 rounded-full bg-blue-500 text-white flex items-center justify-center">
                        <Check size={11} />
                      </span>
                    )}
                  </div>

                  <h3 className="font-extrabold text-sm text-white">{srv.name}</h3>
                  <p className="text-xs text-slate-400 font-medium mt-0.5 flex items-center gap-1">
                    <Clock size={11} className="text-blue-400 shrink-0" />
                    <span>{srv.estimatedDays}</span>
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800">
                  {srv.isAvailable ? (
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold">Valor Total</span>
                      <div className="flex items-baseline gap-1">
                        <span className="text-xs font-bold text-slate-300">R$</span>
                        <span className="text-2xl font-black text-white tracking-tight">
                          {srv.totalPrice.toFixed(2)}
                        </span>
                      </div>
                      <span className="text-[9.5px] text-slate-500 block mt-0.5">
                        Base: R$ {srv.basePrice.toFixed(2)} + P.Adic: R$ {srv.weightPrice.toFixed(2)}
                      </span>
                    </div>
                  ) : (
                    <div className="text-[11px] text-red-400 font-bold py-1">
                      {srv.unavailableReason || 'Indisponível'}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* AÇÃO DE GERAÇÃO INSTANTÂNEA EM DESTAQUE */}
        <div className="p-5 bg-gradient-to-r from-blue-950/60 via-slate-900 to-indigo-950/60 border border-blue-500/30 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center shrink-0">
              <Sparkles size={22} className="text-blue-400" />
            </div>
            <div>
              <h4 className="font-black text-base text-white">
                Pronto para enviar com {activeSelectedService.name}?
              </h4>
              <p className="text-xs text-slate-300 mt-0.5">
                Tarifa total calculada: <strong>R$ {activeSelectedService.totalPrice.toFixed(2)}</strong> • Prazo estimado: <strong>{activeSelectedService.estimatedDays}</strong>
              </p>
            </div>
          </div>

          <button
            id="btn-trigger-order-generation"
            onClick={() => setIsOrderModalOpen(true)}
            className="w-full sm:w-auto px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black rounded-xl shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95"
          >
            <span>Gerar Pedido Instantaneamente</span>
            <ArrowRight size={14} />
          </button>
        </div>

      </div>

      {/* MODAL DE GERAÇÃO INSTANTÂNEA DE PEDIDO */}
      {isOrderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-xl w-full shadow-2xl space-y-5 relative">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-600/20 text-blue-400 rounded-xl">
                  <Send size={18} />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">Gerar Pedido Instantâneo</h3>
                  <p className="text-xs text-slate-400">Confirmação de dados para emissão no ViniMap Fleet</p>
                </div>
              </div>

              <button
                onClick={() => setIsOrderModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Resumo do Frete Selecionado */}
            <div className="p-3.5 bg-blue-950/60 border border-blue-500/30 rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-[10px] text-blue-300 font-bold uppercase tracking-wider block">Serviço Selecionado</span>
                <span className="text-sm font-black text-white">{activeSelectedService.name}</span>
                <span className="text-xs text-slate-300 block">Prazo: {activeSelectedService.estimatedDays}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Valor do Frete</span>
                <span className="text-xl font-black text-emerald-400">R$ {activeSelectedService.totalPrice.toFixed(2)}</span>
              </div>
            </div>

            {/* Campos do Destinatário */}
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">Destinatário</label>
                  <input
                    type="text"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    placeholder="Nome completo do cliente"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">Telefone / WhatsApp</label>
                  <input
                    type="text"
                    value={recipientPhone}
                    onChange={(e) => setRecipientPhone(e.target.value)}
                    placeholder="11999998888"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Endereço */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">Endereço (Logradouro)</label>
                  <input
                    type="text"
                    value={destAddress}
                    onChange={(e) => setDestAddress(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">Número</label>
                  <input
                    type="text"
                    value={destNumber}
                    onChange={(e) => setDestNumber(e.target.value)}
                    placeholder="123"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">Bairro</label>
                  <input
                    type="text"
                    value={destBairro}
                    onChange={(e) => setDestBairro(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">Cidade / UF</label>
                  <input
                    type="text"
                    value={destCity}
                    onChange={(e) => setDestCity(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">Complemento</label>
                  <input
                    type="text"
                    value={destComplement}
                    onChange={(e) => setDestComplement(e.target.value)}
                    placeholder="Apto, Sala..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Cliente Parceiro Remetente */}
              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">Cliente Parceiro (Remetente / Conta)</label>
                <select
                  value={selectedPartnerId}
                  onChange={(e) => setSelectedPartnerId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white focus:border-blue-500 focus:outline-none cursor-pointer"
                >
                  <option value="">Cliente Direto / Avulso (Sem parceiro vinculado)</option>
                  {partnerClients.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.codigoCliente || p.id})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Ações do Modal */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsOrderModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="button"
                id="btn-confirm-instant-order"
                disabled={isSubmittingOrder}
                onClick={handleGenerateOrderInstant}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-black rounded-xl shadow-lg shadow-blue-600/30 flex items-center gap-2 cursor-pointer"
              >
                {isSubmittingOrder ? (
                  <span>Cadastrando...</span>
                ) : (
                  <>
                    <CheckCircle2 size={15} />
                    <span>Confirmar e Inserir Pedido</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default VolumeCalculatorCorreiosTab;
