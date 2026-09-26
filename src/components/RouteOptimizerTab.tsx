import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Route,
  Navigation,
  MapPin,
  Play,
  RotateCcw,
  Upload,
  Download,
  Share2,
  ExternalLink,
  ChevronUp,
  ChevronDown,
  Trash2,
  Plus,
  Clock,
  Car,
  Fuel,
  TrendingDown,
  Building2,
  FileSpreadsheet,
  Package,
  Layers,
  Sparkles,
  Maximize2,
  CheckCircle2,
  AlertCircle,
  Copy,
  Printer
} from 'lucide-react';
import * as XLSX from 'xlsx';
import L from 'leaflet';
import { Courier, HubCentral, Order } from '../types';
import {
  RouteStop,
  RouteHubLocation,
  RouteOptimizationResult,
  DEFAULT_HUB_COORDS,
  geocodeStop,
  runFullRouteOptimization,
  generateGoogleMapsNavigationUrl,
  generateWazeNavigationUrl
} from '../utils/routeOptimizerEngine';

interface RouteOptimizerTabProps {
  orders?: Order[];
  couriers?: Courier[];
  hubs?: HubCentral[];
  onUpdateOrderSequence?: (orderId: string, sequencia: string) => Promise<void> | void;
  onAllocateCourier?: (orderId: string, courierId: string) => Promise<void> | void;
}

export const RouteOptimizerTab: React.FC<RouteOptimizerTabProps> = ({
  orders = [],
  couriers = [],
  hubs = [],
  onUpdateOrderSequence,
  onAllocateCourier
}) => {
  // Configuração do Ponto de Origem (Hub)
  const activeHub = useMemo<RouteHubLocation>(() => {
    const primary = hubs.find(h => h.isActive) || hubs[0];
    if (primary && primary.latitude && primary.longitude) {
      return {
        id: primary.id,
        name: primary.name,
        address: primary.address || 'São Paulo - SP',
        lat: Number(primary.latitude),
        lng: Number(primary.longitude)
      };
    }
    return DEFAULT_HUB_COORDS;
  }, [hubs]);

  // Estados principais da rota
  const [stops, setStops] = useState<RouteStop[]>([]);
  const [returnToHub, setReturnToHub] = useState<boolean>(false);
  const [startTime, setStartTime] = useState<string>('08:00');
  const [serviceTimeMin, setServiceTimeMin] = useState<number>(6);
  const [selectedCourierId, setSelectedCourierId] = useState<string>('');
  
  // Resultados da Otimização
  const [optimizationResult, setOptimizationResult] = useState<RouteOptimizationResult | null>(null);
  const [isOptimizing, setIsOptimizing] = useState<boolean>(false);
  const [optimizationMessage, setOptimizationMessage] = useState<string>('');
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);

  // Modais de Entrada
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [isSystemOrdersModalOpen, setIsSystemOrdersModalOpen] = useState<boolean>(false);
  const [isManualInputModalOpen, setIsManualInputModalOpen] = useState<boolean>(false);
  const [manualText, setManualText] = useState<string>('');
  const [systemOrdersFilterCourier, setSystemOrdersFilterCourier] = useState<string>('all');
  const [systemOrdersFilterDate, setSystemOrdersFilterDate] = useState<string>('today');
  const [selectedSystemOrderIds, setSelectedSystemOrderIds] = useState<string[]>([]);
  const [isApplyingToSystem, setIsApplyingToSystem] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Referência do Mapa Leaflet
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const routePolylineRef = useRef<L.Polyline | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Inicialização do Mapa Leaflet
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [activeHub.lat, activeHub.lng],
        zoom: 13,
        zoomControl: true
      });

      // Camada CartoDB Voyager / OpenStreetMap limpa e profissional para roteirização
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        maxZoom: 19
      }).addTo(map);

      const markersGroup = L.layerGroup().addTo(map);
      markersLayerRef.current = markersGroup;
      mapInstanceRef.current = map;
    }

    return () => {
      // Cleanup map on unmount
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Atualizar marcadores e traçado no mapa sempre que as paradas ou rota mudarem
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersGroup = markersLayerRef.current;
    if (!map || !markersGroup) return;

    markersGroup.clearLayers();
    if (routePolylineRef.current) {
      routePolylineRef.current.remove();
      routePolylineRef.current = null;
    }

    const bounds = L.latLngBounds([L.latLng(activeHub.lat, activeHub.lng)]);

    // 1. Marcador da Origem / HUB
    const hubIcon = L.divIcon({
      className: 'custom-hub-marker',
      html: `
        <div style="background-color: #0f172a; color: white; border: 2.5px solid #38bdf8; border-radius: 12px; padding: 6px; box-shadow: 0 4px 14px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; width: 38px; height: 38px;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
            <polyline points="9 22 9 12 15 12 15 22"></polyline>
          </svg>
        </div>
      `,
      iconSize: [38, 38],
      iconAnchor: [19, 19]
    });

    const hubMarker = L.marker([activeHub.lat, activeHub.lng], { icon: hubIcon })
      .bindPopup(`
        <div style="font-family: sans-serif; font-size: 12px; min-width: 180px;">
          <strong style="color: #0284c7; display: block; font-size: 13px;">Ponto de Saída (Base)</strong>
          <span>${activeHub.name}</span>
          <div style="color: #64748b; font-size: 11px; margin-top: 4px;">${activeHub.address}</div>
          <div style="margin-top: 6px; font-weight: bold; color: #0f172a;">Saída prevista: ${startTime}</div>
        </div>
      `);
    markersGroup.addLayer(hubMarker);

    // 2. Marcadores das Paradas
    stops.forEach((stop) => {
      bounds.extend([stop.lat, stop.lng]);

      const isSelected = stop.id === selectedStopId;
      const isCompleted = stop.status === 'completed';
      const bgColor = isCompleted ? '#10b981' : isSelected ? '#f59e0b' : '#3b82f6';

      const stopIcon = L.divIcon({
        className: 'custom-stop-marker',
        html: `
          <div style="background-color: ${bgColor}; color: white; border: 2.5px solid white; border-radius: 50%; display: flex; align-items: center; justify-content: center; width: 34px; height: 34px; font-weight: 800; font-size: 13px; box-shadow: 0 4px 12px rgba(0,0,0,0.35); transition: transform 0.2s; ${isSelected ? 'transform: scale(1.25); border-color: #1e293b;' : ''}">
            ${stop.sequence}
          </div>
        `,
        iconSize: [34, 34],
        iconAnchor: [17, 17]
      });

      const stopMarker = L.marker([stop.lat, stop.lng], { icon: stopIcon })
        .on('click', () => setSelectedStopId(stop.id))
        .bindPopup(`
          <div style="font-family: sans-serif; font-size: 12px; min-width: 200px; padding: 2px;">
            <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 6px;">
              <span style="background: #3b82f6; color: white; border-radius: 6px; padding: 2px 6px; font-weight: bold; font-size: 11px;">Parada #${stop.sequence}</span>
              ${stop.estimatedArrival ? `<span style="font-weight: bold; color: #1e293b;">ETA: ${stop.estimatedArrival}</span>` : ''}
            </div>
            <strong style="color: #0f172a; font-size: 13px; display: block;">${stop.recipientName}</strong>
            <div style="color: #475569; font-size: 11px; margin-top: 2px;">${stop.address}</div>
            <div style="color: #64748b; font-size: 10.5px; margin-top: 2px;">CEP: ${stop.cep || '-'}</div>
            ${stop.distanceFromPreviousKm ? `<div style="margin-top: 6px; font-size: 11px; color: #2563eb; font-weight: 600;">+${stop.distanceFromPreviousKm} km (${stop.durationFromPreviousMin} min de trajeto)</div>` : ''}
            <div style="display: flex; gap: 6px; margin-top: 8px;">
              <a href="${generateGoogleMapsNavigationUrl(activeHub, [stop])}" target="_blank" style="flex: 1; text-align: center; background: #0284c7; color: white; padding: 4px 6px; border-radius: 6px; text-decoration: none; font-size: 10.5px; font-weight: bold;">Google Maps</a>
              <a href="${generateWazeNavigationUrl(stop)}" target="_blank" style="flex: 1; text-align: center; background: #059669; color: white; padding: 4px 6px; border-radius: 6px; text-decoration: none; font-size: 10.5px; font-weight: bold;">Waze</a>
            </div>
          </div>
        `);

      markersGroup.addLayer(stopMarker);
    });

    // 3. Traçado da Rota (Polyline de Rua)
    if (optimizationResult && optimizationResult.geometryCoordinates.length > 0) {
      const poly = L.polyline(optimizationResult.geometryCoordinates, {
        color: '#2563eb',
        weight: 5,
        opacity: 0.85,
        lineJoin: 'round',
        dashArray: undefined
      }).addTo(map);

      routePolylineRef.current = poly;
    } else if (stops.length > 0) {
      // Linha direta entre pontos se ainda não otimizado
      const directPoints: [number, number][] = [
        [activeHub.lat, activeHub.lng],
        ...stops.map(s => [s.lat, s.lng] as [number, number])
      ];
      if (returnToHub) {
        directPoints.push([activeHub.lat, activeHub.lng]);
      }

      const poly = L.polyline(directPoints, {
        color: '#94a3b8',
        weight: 3,
        opacity: 0.6,
        dashArray: '6, 8'
      }).addTo(map);

      routePolylineRef.current = poly;
    }

    // Ajustar zoom para enquadrar todas as paradas e o Hub
    if (stops.length > 0) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }, [stops, optimizationResult, activeHub, returnToHub, selectedStopId, startTime]);

  // Executar Otimização Automática
  const handleRunOptimization = async () => {
    if (stops.length === 0) {
      alert('Adicione ou importe pelo menos uma parada de entrega para otimizar.');
      return;
    }

    setIsOptimizing(true);
    setOptimizationMessage('Geocodificando endereços e calculando matriz de distâncias...');

    try {
      // Garantir geocodificação de todas as paradas
      const geocodedStops: RouteStop[] = [];
      for (let i = 0; i < stops.length; i++) {
        const s = stops[i];
        if (s.lat === 0 || s.lng === 0 || !s.lat || !s.lng) {
          setOptimizationMessage(`Localizando parada ${i + 1} de ${stops.length}: ${s.cep || s.address}...`);
          const coords = await geocodeStop(s.cep, s.address, activeHub);
          geocodedStops.push({ ...s, lat: coords.lat, lng: coords.lng });
        } else {
          geocodedStops.push(s);
        }
      }

      setOptimizationMessage('Executando algoritmo TSP e calculando melhor rota pelas vias...');
      
      const result = await runFullRouteOptimization(activeHub, geocodedStops, {
        returnToHub,
        startTime,
        defaultServiceTimeMin: serviceTimeMin
      });

      setStops(result.stops);
      setOptimizationResult(result);
      showToast(`✓ Rota otimizada com sucesso! Economia de ${result.savedDistanceKm} km (${result.savedPercent}%).`);
    } catch (err) {
      console.error('Erro na otimização:', err);
      alert('Ocorreu um erro ao calcular a rota. O algoritmo local foi mantido.');
    } finally {
      setIsOptimizing(false);
      setOptimizationMessage('');
    }
  };

  // Reordenação manual de parada
  const handleMoveStop = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= stops.length) return;

    const newStops = [...stops];
    const temp = newStops[index];
    newStops[index] = newStops[targetIndex];
    newStops[targetIndex] = temp;

    // Recalcular numeração sequencial
    const updated = newStops.map((s, idx) => ({ ...s, sequence: idx + 1 }));
    setStops(updated);
  };

  // Remover parada
  const handleRemoveStop = (id: string) => {
    const remaining = stops.filter(s => s.id !== id).map((s, idx) => ({ ...s, sequence: idx + 1 }));
    setStops(remaining);
    if (selectedStopId === id) setSelectedStopId(null);
  };

  // Limpar tudo
  const handleClearRoute = () => {
    if (stops.length > 0 && !confirm('Deseja limpar todas as paradas da rota atual?')) return;
    setStops([]);
    setOptimizationResult(null);
    setSelectedStopId(null);
  };

  // Importar Planilha Excel / CSV
  const handleFileSpreadsheetUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const rawJson: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

        if (!rawJson || rawJson.length === 0) {
          alert('O arquivo selecionado está vazio.');
          return;
        }

        const newStops: RouteStop[] = [];

        for (let i = 0; i < rawJson.length; i++) {
          const row = rawJson[i];
          const keys = Object.keys(row);

          // Localizar colunas de forma inteligente e flexível
          const findCol = (synonyms: string[]) => {
            const key = keys.find(k => synonyms.includes(k.toLowerCase().replace(/[\s_-]/g, '')));
            return key ? String(row[key]).trim() : '';
          };

          const address = findCol(['endereco', 'logradouro', 'rua', 'address', 'local', 'entrega', 'enderecocompleto']);
          const cep = findCol(['cep', 'postalcode', 'codigopostal', 'cependereco']);
          const recipient = findCol(['destinatario', 'nome', 'cliente', 'procurarpor', 'recipient', 'nomedestinatario']) || `Entrega #${i + 1}`;
          const orderId = findCol(['pedido', 'id', 'numpedido', 'pedidoexterno', 'codigo', 'chamado']) || `PED-ROTA-${i + 1}`;
          const phone = findCol(['telefone', 'celular', 'fone', 'tel', 'whatsapp']);
          const notes = findCol(['observacao', 'obs', 'detalhe', 'complemento', 'notas']);
          const bairro = findCol(['bairro']);
          const cidade = findCol(['cidade', 'municipio', 'cidademunicipio']);

          if (!address && !cep) continue;

          newStops.push({
            id: `stop-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
            orderId,
            title: `Parada #${stops.length + i + 1}`,
            recipientName: recipient,
            address: address || `CEP: ${cep}`,
            cep: cep,
            bairro,
            cidade,
            phone,
            notes,
            lat: 0, // Será geocodificado ao otimizar
            lng: 0,
            sequence: stops.length + i + 1,
            originalIndex: stops.length + i,
            serviceTimeMinutes: serviceTimeMin,
            status: 'pending'
          });
        }

        if (newStops.length === 0) {
          alert('Nenhum endereço ou CEP válido encontrado na planilha.');
          return;
        }

        setStops(prev => [...prev, ...newStops]);
        setIsImportModalOpen(false);
        showToast(`✓ ${newStops.length} paradas importadas com sucesso! Clique em "Otimizar Rota Automática".`);
      } catch (err) {
        console.error('Erro ao ler planilha:', err);
        alert('Falha ao processar arquivo. Verifique se o formato é .xlsx, .csv ou .xls válido.');
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  // Carregar Pedidos Ativos do Próprio Sistema ViniMap
  const systemAvailableOrders = useMemo(() => {
    return orders.filter(o => {
      if (o.status === 'delivered' || o.status === 'cancelled') return false;
      if (systemOrdersFilterCourier !== 'all') {
        if (systemOrdersFilterCourier === 'unallocated') {
          if (o.courierId) return false;
        } else if (o.courierId !== systemOrdersFilterCourier) {
          return false;
        }
      }
      return true;
    });
  }, [orders, systemOrdersFilterCourier]);

  const handleConfirmSystemOrders = () => {
    const selected = orders.filter(o => selectedSystemOrderIds.includes(o.id));
    if (selected.length === 0) {
      alert('Selecione pelo menos um pedido do sistema.');
      return;
    }

    const newStops: RouteStop[] = selected.map((o, idx) => ({
      id: `stop-sys-${o.id}`,
      orderId: o.id,
      title: o.pedido || o.id,
      recipientName: o.procurarPor || o.customerName || 'Destinatário',
      address: o.address,
      cep: o.cep || '',
      bairro: o.bairro,
      cidade: o.cidade || o.cidadeMunicipio,
      phone: o.telefone,
      notes: o.detalhe || o.observacao,
      lat: Number(o.latitude) || 0,
      lng: Number(o.longitude) || 0,
      sequence: stops.length + idx + 1,
      originalIndex: stops.length + idx,
      serviceTimeMinutes: serviceTimeMin,
      status: 'pending'
    }));

    setStops(prev => [...prev, ...newStops]);
    setIsSystemOrdersModalOpen(false);
    setSelectedSystemOrderIds([]);
    showToast(`✓ ${newStops.length} pedidos do sistema carregados no roteirizador!`);
  };

  // Processar Colar Texto Rápido
  const handleProcessManualText = () => {
    if (!manualText.trim()) return;

    const lines = manualText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const newStops: RouteStop[] = lines.map((line, idx) => {
      // Formatos suportados: "Av. Paulista, 1000 - 01311-000 - João Silva" ou apenas endereço
      const parts = line.split(/[-–;,|]/).map(p => p.trim());
      const address = parts[0] || line;
      const cepMatch = line.match(/\b\d{5}-?\d{3}\b/);
      const cep = cepMatch ? cepMatch[0] : '';
      const recipient = parts.length > 2 ? parts[2] : (parts.length > 1 && !parts[1].match(/^\d/)) ? parts[1] : `Parada #${stops.length + idx + 1}`;

      return {
        id: `stop-man-${Date.now()}-${idx}`,
        title: `Parada #${stops.length + idx + 1}`,
        recipientName: recipient,
        address: address,
        cep: cep,
        lat: 0,
        lng: 0,
        sequence: stops.length + idx + 1,
        originalIndex: stops.length + idx,
        serviceTimeMinutes: serviceTimeMin,
        status: 'pending'
      };
    });

    setStops(prev => [...prev, ...newStops]);
    setManualText('');
    setIsManualInputModalOpen(false);
    showToast(`✓ ${newStops.length} paradas adicionadas com sucesso!`);
  };

  // Baixar Modelo Padrão de Planilha para Roteirização
  const handleDownloadTemplate = () => {
    const sampleData = [
      {
        Pedido: 'PED-101',
        Destinatario: 'Carlos Eduardo Oliveira',
        Endereco: 'Av. Paulista, 1578',
        CEP: '01310-200',
        Bairro: 'Bela Vista',
        Cidade: 'São Paulo',
        Telefone: '(11) 98765-4321',
        Observacoes: 'Portaria comercial'
      },
      {
        Pedido: 'PED-102',
        Destinatario: 'Mariana Souza',
        Endereco: 'Rua Augusta, 1200',
        CEP: '01304-001',
        Bairro: 'Consolação',
        Cidade: 'São Paulo',
        Telefone: '(11) 97777-8888',
        Observacoes: 'Apto 42'
      },
      {
        Pedido: 'PED-103',
        Destinatario: 'Restaurante Sabor & Arte',
        Endereco: 'Rua Oscar Freire, 800',
        CEP: '01426-000',
        Bairro: 'Cerqueira César',
        Cidade: 'São Paulo',
        Telefone: '(11) 96666-5555',
        Observacoes: 'Entregar nos fundos'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Planilha_Roteirizacao');
    XLSX.writeFile(wb, 'modelo_planilha_roteirizador_vinimap.xlsx');
  };

  // Exportar Roteiro Otimizado para Excel
  const handleExportRouteExcel = () => {
    if (stops.length === 0) return;

    const dataToExport = stops.map(s => ({
      Ordem_Entrega: s.sequence,
      Horario_Previsto_ETA: s.estimatedArrival || '-',
      Saida_Estimada: s.estimatedDeparture || '-',
      Destinatario: s.recipientName,
      Endereco_Completo: s.address,
      CEP: s.cep || '-',
      Distancia_Parada_KM: s.distanceFromPreviousKm ? `${s.distanceFromPreviousKm} km` : 'Ponto de Partida',
      Tempo_Viagem_Min: s.durationFromPreviousMin ? `${s.durationFromPreviousMin} min` : '-',
      Telefone: s.phone || '-',
      Observacoes: s.notes || '-',
      Pedido_ID: s.orderId || s.title
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Roteiro_Otimizado');
    XLSX.writeFile(wb, `roteiro_otimizado_${new Date().toISOString().slice(0, 10)}.xlsx`);
    showToast('✓ Roteiro exportado para Excel com sucesso!');
  };

  // Aplicar Sequência Otimizada aos Pedidos do Sistema
  const handleApplySequenceToSystem = async () => {
    const stopsWithOrders = stops.filter(s => s.orderId && s.orderId.startsWith('PED-') || s.orderId?.startsWith('CLI-') || orders.some(o => o.id === s.orderId));
    if (stopsWithOrders.length === 0) {
      alert('Nenhuma das paradas atuais possui vínculo direto com pedidos cadastrados no sistema.');
      return;
    }

    if (!confirm(`Deseja sincronizar a sequência de ${stopsWithOrders.length} pedidos no sistema para atualizar as rotas dos motoristas?`)) return;

    setIsApplyingToSystem(true);
    try {
      for (const s of stopsWithOrders) {
        if (s.orderId && onUpdateOrderSequence) {
          await onUpdateOrderSequence(s.orderId, String(s.sequence));
        }
        if (s.orderId && selectedCourierId && onAllocateCourier) {
          await onAllocateCourier(s.orderId, selectedCourierId);
        }
      }
      showToast('✓ Sequência sincronizada no banco de dados e enviada ao app do condutor!');
    } catch (err) {
      console.error('Erro ao salvar sequenciamento:', err);
      alert('Falha ao sincronizar pedidos.');
    } finally {
      setIsApplyingToSystem(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-12">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-2 text-xs font-bold animate-in slide-in-from-top-4">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header & Ações Rápidas */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/30">
              <Route className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-slate-800 tracking-tight">Roteirizador Pro Inteligente</h2>
                <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200/80 rounded-full text-[10px] font-extrabold uppercase tracking-wider">
                  OSRM + 2-Opt TSP
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Otimizador de trajetos com menor quilometragem e tempo real de trânsito pelas vias
              </p>
            </div>
          </div>
        </div>

        {/* Botões de Importação e Ações */}
        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
          <button
            type="button"
            onClick={() => setIsSystemOrdersModalOpen(true)}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200/70 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs"
          >
            <Package className="h-4 w-4" />
            <span>Puxar Pedidos do Sistema</span>
          </button>

          <button
            type="button"
            onClick={() => setIsImportModalOpen(true)}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/70 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs"
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span>Importar Planilha</span>
          </button>

          <button
            type="button"
            onClick={() => setIsManualInputModalOpen(true)}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Colar Endereços</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadTemplate}
            title="Baixar Modelo de Planilha"
            className="p-2.5 text-slate-400 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200/60 rounded-xl transition-all cursor-pointer"
          >
            <Download className="h-4 w-4" />
          </button>

          {stops.length > 0 && (
            <button
              type="button"
              onClick={handleClearRoute}
              title="Limpar Rota"
              className="p-2.5 text-rose-500 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-xl transition-all cursor-pointer"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Cards de Métricas e Comparativo de Economia */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total de Paradas */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Paradas na Rota</span>
            <MapPin className="h-4 w-4 text-blue-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-800">{stops.length}</span>
            <span className="text-xs text-slate-400 font-medium">destinos</span>
          </div>
          <div className="mt-2 text-[10.5px] text-slate-500 truncate">
            Partida: <strong className="text-slate-700">{activeHub.name}</strong>
          </div>
        </div>

        {/* Quilometragem Total */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Distância Prevista</span>
            <Car className="h-4 w-4 text-indigo-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-800">
              {optimizationResult ? `${optimizationResult.totalDistanceKm} km` : stops.length > 0 ? '~ km' : '0 km'}
            </span>
            {optimizationResult && (
              <span className="text-xs text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded-md">
                -{optimizationResult.savedPercent}%
              </span>
            )}
          </div>
          <div className="mt-2 text-[10.5px] text-slate-500">
            {optimizationResult
              ? `Economia de ${optimizationResult.savedDistanceKm} km`
              : 'Execute a otimização'}
          </div>
        </div>

        {/* Tempo Total de Rota */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Tempo Estimado Total</span>
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-800">
              {optimizationResult
                ? `${Math.floor(optimizationResult.totalDurationMinutes / 60)}h ${optimizationResult.totalDurationMinutes % 60}m`
                : '0h 0m'}
            </span>
          </div>
          <div className="mt-2 text-[10.5px] text-slate-500">
            Saída: {startTime} • Termina: {stops.length > 0 && stops[stops.length - 1]?.estimatedDeparture ? stops[stops.length - 1].estimatedDeparture : '--:--'}
          </div>
        </div>

        {/* Economia de Combustível / Eficiência */}
        <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white p-4 rounded-2xl shadow-xs border border-indigo-950">
          <div className="flex items-center justify-between text-indigo-200 text-xs font-semibold">
            <span>Eficiência do Trajeto</span>
            <Sparkles className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-white">
              {optimizationResult ? `${optimizationResult.savedPercent}%` : '100%'}
            </span>
            <span className="text-xs text-indigo-200 font-medium">otimizado</span>
          </div>
          <div className="mt-2 text-[10.5px] text-indigo-200/80 flex items-center gap-1 truncate">
            <Fuel className="h-3 w-3 text-emerald-400 shrink-0" />
            <span>{optimizationResult ? `Motor: ${optimizationResult.usedEngine.toUpperCase()}` : 'Pronto para calcular'}</span>
          </div>
        </div>
      </div>

      {/* Barra de Parâmetros e Execução da Otimização */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-700">
          {/* Horário de Início */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
            <Clock className="h-3.5 w-3.5 text-slate-400" />
            <span>Saída:</span>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="bg-transparent font-bold text-slate-800 focus:outline-none cursor-pointer"
            />
          </div>

          {/* Tempo por Parada */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
            <span>Atendimento:</span>
            <select
              value={serviceTimeMin}
              onChange={(e) => setServiceTimeMin(Number(e.target.value))}
              className="bg-transparent font-bold text-slate-800 focus:outline-none cursor-pointer"
            >
              <option value={4}>4 min / cliente</option>
              <option value={6}>6 min / cliente</option>
              <option value={8}>8 min / cliente</option>
              <option value={10}>10 min / cliente</option>
              <option value={15}>15 min / cliente</option>
            </select>
          </div>

          {/* Retornar ao Hub */}
          <label className="flex items-center gap-2 cursor-pointer bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl select-none">
            <input
              type="checkbox"
              checked={returnToHub}
              onChange={(e) => setReturnToHub(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
            />
            <span className="text-xs">Retornar ao Hub no final</span>
          </label>
        </div>

        {/* Botão Principal de Otimização */}
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            type="button"
            onClick={handleRunOptimization}
            disabled={isOptimizing || stops.length === 0}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-2xl text-xs font-black shadow-lg shadow-indigo-600/30 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]"
          >
            {isOptimizing ? (
              <>
                <RotateCcw className="h-4 w-4 animate-spin" />
                <span>Otimizando Rota pelas Vias...</span>
              </>
            ) : (
              <>
                <Play className="h-4 w-4 fill-white" />
                <span>Otimizar Rota Automática</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Área Principal: Painel de Paradas (Esquerda) + Mapa Leaflet (Direita) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Coluna da Esquerda: Lista de Paradas Sequenciadas (5 Colunas) */}
        <div className="lg:col-span-5 bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden flex flex-col h-[640px]">
          {/* Header da Lista */}
          <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
            <div>
              <h3 className="font-bold text-sm flex items-center gap-2">
                <span>Sequência de Entregas</span>
                <span className="px-2 py-0.5 bg-slate-800 rounded-full text-xs text-slate-300">
                  {stops.length}
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">Arraste ou use as setas para ajustar a ordem</p>
            </div>

            {stops.length > 0 && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleExportRouteExcel}
                  title="Exportar Roteiro Excel"
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                </button>
                <a
                  href={generateGoogleMapsNavigationUrl(activeHub, stops, returnToHub)}
                  target="_blank"
                  rel="noreferrer"
                  title="Abrir Rota Completa no Google Maps"
                  className="p-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors cursor-pointer"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            )}
          </div>

          {/* Ponto de Partida Fixo */}
          <div className="bg-slate-50 border-b border-slate-100 p-3 flex items-center gap-3 shrink-0">
            <div className="w-8 h-8 rounded-xl bg-slate-900 text-sky-400 flex items-center justify-center shrink-0 font-bold text-xs shadow-xs">
              <Building2 className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-sky-600 uppercase tracking-wider">Partida (Base)</span>
                <span className="text-[10px] font-bold text-slate-500">{startTime}</span>
              </div>
              <h4 className="text-xs font-bold text-slate-800 truncate">{activeHub.name}</h4>
              <p className="text-[10px] text-slate-500 truncate">{activeHub.address}</p>
            </div>
          </div>

          {/* Lista Rolável de Paradas */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
            {stops.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
                <Route className="h-12 w-12 text-slate-300 stroke-1 mb-2" />
                <h4 className="text-sm font-bold text-slate-700">Nenhuma parada carregada</h4>
                <p className="text-xs text-slate-400 max-w-xs mt-1">
                  Puxe pedidos do sistema ou importe uma planilha com endereços/CEPs para iniciar a roteirização.
                </p>
                <div className="flex gap-2 mt-4">
                  <button
                    type="button"
                    onClick={() => setIsSystemOrdersModalOpen(true)}
                    className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-xl text-xs font-bold hover:bg-blue-100 cursor-pointer"
                  >
                    Puxar Pedidos
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsImportModalOpen(true)}
                    className="px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-bold hover:bg-emerald-100 cursor-pointer"
                  >
                    Importar Planilha
                  </button>
                </div>
              </div>
            ) : (
              stops.map((stop, idx) => {
                const isSelected = stop.id === selectedStopId;
                return (
                  <div
                    key={stop.id}
                    onClick={() => setSelectedStopId(stop.id)}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${
                      isSelected
                        ? 'bg-blue-50/70 border-blue-300 shadow-xs ring-1 ring-blue-400/40'
                        : 'bg-white hover:bg-slate-50/80 border-slate-200/80'
                    }`}
                  >
                    {/* Badge da Ordem */}
                    <div className="w-7 h-7 rounded-full bg-blue-600 text-white font-extrabold text-xs flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                      {stop.sequence}
                    </div>

                    {/* Informações da Parada */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <h4 className="text-xs font-bold text-slate-800 truncate" title={stop.recipientName}>
                          {stop.recipientName}
                        </h4>
                        {stop.estimatedArrival && (
                          <span className="text-[11px] font-black text-blue-700 bg-blue-100/70 px-1.5 py-0.5 rounded-md shrink-0">
                            ETA: {stop.estimatedArrival}
                          </span>
                        )}
                      </div>

                      <p className="text-[11px] text-slate-600 truncate mt-0.5 leading-tight" title={stop.address}>
                        {stop.address}
                      </p>

                      <div className="flex items-center gap-2 mt-1.5 text-[10px] text-slate-400 font-medium">
                        {stop.cep && <span>CEP: {stop.cep}</span>}
                        {stop.distanceFromPreviousKm && (
                          <span className="text-slate-500 font-semibold">
                            • +{stop.distanceFromPreviousKm} km ({stop.durationFromPreviousMin} min)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Ações Rápidas por Parada */}
                    <div className="flex flex-col items-center gap-1 shrink-0 ml-1">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleMoveStop(idx, 'up'); }}
                        disabled={idx === 0}
                        title="Subir na Ordem"
                        className="p-1 hover:bg-slate-200 rounded text-slate-500 disabled:opacity-20 cursor-pointer"
                      >
                        <ChevronUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleMoveStop(idx, 'down'); }}
                        disabled={idx === stops.length - 1}
                        title="Descer na Ordem"
                        className="p-1 hover:bg-slate-200 rounded text-slate-500 disabled:opacity-20 cursor-pointer"
                      >
                        <ChevronDown className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleRemoveStop(stop.id); }}
                        title="Excluir Parada"
                        className="p-1 hover:bg-rose-100 text-rose-500 rounded cursor-pointer"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Rodapé com Ações de Sincronização */}
          {stops.length > 0 && (
            <div className="p-3.5 bg-slate-50 border-t border-slate-200/80 flex flex-col gap-2 shrink-0">
              <div className="flex items-center gap-2">
                <select
                  value={selectedCourierId}
                  onChange={(e) => setSelectedCourierId(e.target.value)}
                  className="flex-1 bg-white border border-slate-200 text-slate-800 text-xs px-3 py-2 rounded-xl font-medium focus:outline-none"
                >
                  <option value="">Atribuir a um Entregador (Opcional)...</option>
                  {couriers.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.vehicle || 'Moto'})</option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={handleApplySequenceToSystem}
                  disabled={isApplyingToSystem}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shrink-0"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Salvar nos Pedidos</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Coluna da Direita: Mapa Interativo com Traçado Leaflet (7 Colunas) */}
        <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden flex flex-col h-[640px]">
          {/* Header do Mapa */}
          <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
            <div className="flex items-center gap-2">
              <Navigation className="h-4 w-4 text-sky-400" />
              <span className="font-bold text-xs uppercase tracking-wider">Mapa Interativo de Roteamento</span>
            </div>

            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-sky-300">
                <span className="h-2.5 w-2.5 rounded-full bg-sky-400"></span>
                Base: {activeHub.name}
              </span>
              <span className="flex items-center gap-1.5 text-blue-300">
                <span className="h-2.5 w-2.5 rounded-full bg-blue-500"></span>
                Paradas ({stops.length})
              </span>
            </div>
          </div>

          {/* Div do Container Leaflet */}
          <div className="flex-1 relative bg-slate-100">
            <div ref={mapContainerRef} className="absolute inset-0 w-full h-full z-0" />

            {/* Overlay de carregamento ao otimizar */}
            {isOptimizing && (
              <div className="absolute inset-0 z-20 bg-slate-950/60 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-white text-center">
                <div className="h-12 w-12 rounded-full border-3 border-indigo-400 border-t-transparent animate-spin mb-4" />
                <h4 className="text-base font-bold">Roteirizando Trajeto pelas Vias</h4>
                <p className="text-xs text-indigo-200 mt-1 max-w-sm">{optimizationMessage || 'Processando algoritmo TSP...'}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal: Importar Planilha de Endereços */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
                  <FileSpreadsheet className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-800">Importar Planilha de Endereços</h3>
                  <p className="text-xs text-slate-400">Arquivos Excel (.xlsx, .xls) ou CSV (.csv)</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="border-2 border-dashed border-slate-200 hover:border-emerald-500 rounded-2xl p-8 text-center bg-slate-50/50 hover:bg-emerald-50/20 transition-all cursor-pointer relative">
              <input
                type="file"
                accept=".xlsx,.xls,.csv,.tsv,.txt"
                onChange={handleFileSpreadsheetUpload}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <Upload className="h-10 w-10 text-emerald-600 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-700">Clique para selecionar ou arraste o arquivo aqui</p>
              <p className="text-[11px] text-slate-400 mt-1">Colunas reconhecidas: Endereço, CEP, Destinatário, Número/ID</p>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="text-xs text-emerald-700 font-bold hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Baixar modelo de planilha (.xlsx)</span>
              </button>
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-200 cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Puxar Pedidos do Sistema */}
      {isSystemOrdersModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                  <Package className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-800">Puxar Pedidos Cadastrados no Sistema</h3>
                  <p className="text-xs text-slate-400">Selecione os pedidos em aberto para roteirizar</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSystemOrdersModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {/* Filtros do Sistema */}
            <div className="flex flex-wrap items-center gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-100 shrink-0 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-600">Entregador:</span>
                <select
                  value={systemOrdersFilterCourier}
                  onChange={(e) => setSystemOrdersFilterCourier(e.target.value)}
                  className="bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 font-medium"
                >
                  <option value="all">Todos os Pedidos</option>
                  <option value="unallocated">Não Alocados (Sem motorista)</option>
                  {couriers.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex-1 text-right">
                <button
                  type="button"
                  onClick={() => {
                    if (selectedSystemOrderIds.length === systemAvailableOrders.length) {
                      setSelectedSystemOrderIds([]);
                    } else {
                      setSelectedSystemOrderIds(systemAvailableOrders.map(o => o.id));
                    }
                  }}
                  className="text-blue-600 font-bold hover:underline cursor-pointer"
                >
                  {selectedSystemOrderIds.length === systemAvailableOrders.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
                </button>
              </div>
            </div>

            {/* Lista com Checkboxes */}
            <div className="flex-1 overflow-y-auto space-y-1.5 custom-scrollbar pr-1">
              {systemAvailableOrders.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  Nenhum pedido pendente encontrado com os filtros selecionados.
                </div>
              ) : (
                systemAvailableOrders.map((o) => {
                  const isChecked = selectedSystemOrderIds.includes(o.id);
                  return (
                    <label
                      key={o.id}
                      className={`p-2.5 rounded-xl border flex items-center gap-3 cursor-pointer transition-all ${
                        isChecked ? 'bg-blue-50/60 border-blue-200' : 'bg-white hover:bg-slate-50 border-slate-200/70'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedSystemOrderIds(prev => [...prev, o.id]);
                          } else {
                            setSelectedSystemOrderIds(prev => prev.filter(id => id !== o.id));
                          }
                        }}
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                      <div className="flex-1 min-w-0 text-xs">
                        <div className="flex items-center justify-between">
                          <strong className="text-slate-800 font-bold truncate">{o.procurarPor || o.customerName || 'Destinatário'}</strong>
                          <span className="font-mono text-slate-400 text-[10.5px]">{o.pedido || o.id}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 truncate">{o.address}</p>
                        <span className="text-[10px] text-slate-400">CEP: {o.cep || '-'}</span>
                      </div>
                    </label>
                  );
                })
              )}
            </div>

            {/* Rodapé com botão de confirmação */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100 shrink-0">
              <span className="text-xs font-semibold text-slate-500">
                {selectedSystemOrderIds.length} pedidos selecionados
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsSystemOrdersModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-200 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSystemOrders}
                  disabled={selectedSystemOrderIds.length === 0}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-40"
                >
                  Carregar no Roteirizador
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Digitação Rápida / Colar Lista de Endereços */}
      {isManualInputModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Plus className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-800">Colar Lista de Endereços</h3>
                  <p className="text-xs text-slate-400">Cole uma linha para cada entrega</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsManualInputModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <textarea
              rows={8}
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              placeholder="Cole aqui os endereços (1 por linha), por exemplo:&#10;Av. Paulista, 1000 - Bela Vista - São Paulo&#10;Rua Augusta, 500 - Consolação&#10;01452-000, Priscila Uchoa&#10;Rua Oscar Freire, 800"
              className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-800 font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsManualInputModalOpen(false)}
                className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-200 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleProcessManualText}
                disabled={!manualText.trim()}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-40"
              >
                Adicionar Paradas
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RouteOptimizerTab;
