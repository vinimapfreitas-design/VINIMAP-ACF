import React, { useState, useMemo, useRef } from 'react';
import { 
  PartnerClient, 
  FreightRule, 
  Order, 
  Operator, 
  FreightImportHistory 
} from '../types';
import { 
  Settings, 
  DollarSign, 
  Calculator, 
  RefreshCw, 
  Upload, 
  Download, 
  Plus, 
  Trash2, 
  Edit3, 
  Search, 
  CheckCircle2, 
  AlertTriangle, 
  AlertCircle, 
  FileSpreadsheet, 
  ArrowRight, 
  Building2, 
  MapPin, 
  Clock, 
  HelpCircle, 
  Filter, 
  ChevronRight, 
  Info,
  Sparkles,
  Layers,
  X,
  FileText,
  TrendingUp,
  History,
  ShieldCheck,
  Check
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { 
  formatCep, 
  cleanCep, 
  parseFreightSpreadsheetData, 
  ParsedFreightRow, 
  downloadFreightTemplateXLSX, 
  exportPartnerFreightRulesToXLSX, 
  exportPartnerFreightRulesToCSV, 
  testCepMatchInRules 
} from '../utils/freightUtils';
import { db, isFirestoreQuotaExceeded, handleFirestoreError } from '../lib/firebase';
import { doc, setDoc as rawSetDoc, deleteDoc as rawDeleteDoc, writeBatch } from 'firebase/firestore';

const setDoc = async (docRef: any, data: any, options?: any) => {
  if (!db || isFirestoreQuotaExceeded()) return;
  try {
    return await rawSetDoc(docRef, data, options);
  } catch (err: any) {
    handleFirestoreError(err, 'write', docRef?.path);
  }
};

const deleteDoc = async (docRef: any) => {
  if (!db || isFirestoreQuotaExceeded()) return;
  try {
    return await rawDeleteDoc(docRef);
  } catch (err: any) {
    handleFirestoreError(err, 'delete', docRef?.path);
  }
};

interface FreightConfigTabProps {
  partnerClients: PartnerClient[];
  currentUser?: Operator | null;
  initialSelectedPartnerId?: string | null;
  onSelectPartnerId?: (id: string) => void;
  onRefetchDatabase?: () => void;
  onRecalculateOrdersFreight?: (partnerId: string, updatedRules: FreightRule[]) => Promise<void> | void;
  orders?: Order[];
  freightRules?: FreightRule[];
  onUpdateFreightRules?: (rules: FreightRule[]) => void;
}

export const FreightConfigTab: React.FC<FreightConfigTabProps> = ({
  partnerClients = [],
  currentUser,
  initialSelectedPartnerId,
  onSelectPartnerId,
  onRefetchDatabase,
  onRecalculateOrdersFreight,
  orders = [],
  freightRules = [],
  onUpdateFreightRules
}) => {
  // Active partner selection
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>(() => {
    if (initialSelectedPartnerId) return initialSelectedPartnerId;
    return partnerClients[0]?.id || '';
  });

  // Keep local state in sync if prop changes
  React.useEffect(() => {
    if (initialSelectedPartnerId && initialSelectedPartnerId !== selectedPartnerId) {
      setSelectedPartnerId(initialSelectedPartnerId);
    }
  }, [initialSelectedPartnerId]);

  // Active view sub-mode: 'rules_table' | 'import_wizard' | 'all_partners_summary' | 'import_history'
  const [activeViewMode, setActiveViewMode] = useState<'rules_table' | 'import_wizard' | 'all_partners_summary' | 'import_history'>('rules_table');

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [regionFilter, setRegionFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'cep_asc' | 'cep_desc' | 'value_asc' | 'value_desc'>('cep_asc');

  // Live CEP Sandbox Simulator state
  const [testCepInput, setTestCepInput] = useState<string>('');
  const [testCepResult, setTestCepResult] = useState<{
    tested: boolean;
    matched: boolean;
    rule?: FreightRule;
    cepFormatted: string;
    message: string;
  } | null>(null);

  // Import Wizard State
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importFileName, setImportFileName] = useState<string>('');
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [parsedRows, setParsedRows] = useState<ParsedFreightRow[]>([]);
  const [importHeaders, setImportHeaders] = useState<string[]>([]);
  const [importMode, setImportMode] = useState<'replace' | 'merge'>('replace');
  const [importValidCount, setImportValidCount] = useState<number>(0);
  const [importWarningCount, setImportWarningCount] = useState<number>(0);
  const [importErrorCount, setImportErrorCount] = useState<number>(0);
  const [isSubmittingImport, setIsSubmittingImport] = useState<boolean>(false);
  const [importSuccessBanner, setImportSuccessBanner] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Manual Rule Modal State (Create / Edit)
  const [isRuleModalOpen, setIsRuleModalOpen] = useState<boolean>(false);
  const [editingRule, setEditingRule] = useState<FreightRule | null>(null);
  const [ruleFormData, setRuleFormData] = useState<{
    cepMin: string;
    cepMax: string;
    value: string;
    valorRepasse: string;
    prioridade: string;
    regiao: string;
    prazoDias: string;
    pesoMaximo: string;
    observacao: string;
  }>({
    cepMin: '',
    cepMax: '',
    value: '',
    valorRepasse: '',
    prioridade: '',
    regiao: '',
    prazoDias: '1',
    pesoMaximo: '',
    observacao: ''
  });
  const [ruleFormError, setRuleFormError] = useState<string | null>(null);

  // Recalculation modal/toast state
  const [isRecalculating, setIsRecalculating] = useState<boolean>(false);
  const [recalcSummary, setRecalcSummary] = useState<{ count: number; partnerName: string } | null>(null);

  // Import History Logs state
  const [importHistory, setImportHistory] = useState<FreightImportHistory[]>(() => {
    try {
      const stored = localStorage.getItem('vinimap_freight_import_history');
      return stored ? JSON.parse(stored) : [
        {
          id: 'hist-init-1',
          partnerId: 'part-1',
          partnerName: 'Droga Raia SP',
          importedAt: '2026-07-26 09:00',
          fileName: 'Tabela_Frete_SP_Capital.xlsx',
          rulesCount: 5,
          mode: 'replace',
          status: 'success',
          details: '5 faixas de CEP importadas com sucesso',
          importedBy: 'Sistema ViniMap'
        }
      ];
    } catch (e) {
      return [];
    }
  });

  const saveImportHistory = (newEntry: FreightImportHistory) => {
    const updated = [newEntry, ...importHistory].slice(0, 50);
    setImportHistory(updated);
    try {
      localStorage.setItem('vinimap_freight_import_history', JSON.stringify(updated));
    } catch (e) {}
  };

  // Selected Partner Object
  const selectedPartner = useMemo(() => {
    return partnerClients.find(p => p.id === selectedPartnerId) || partnerClients[0] || null;
  }, [partnerClients, selectedPartnerId]);

  // Rules matching current selected partner
  const currentPartnerRules = useMemo(() => {
    if (!selectedPartner) return [];
    const pId = selectedPartner.id;
    const pCode = selectedPartner.codigoCliente;

    return freightRules.filter(r => {
      if (r.partnerId === pId) return true;
      if (pCode && (r.codigoCliente === pCode || r.partnerId === pCode)) return true;
      return false;
    });
  }, [freightRules, selectedPartner]);

  // Distinct regions available in current client rules
  const availableRegions = useMemo(() => {
    const set = new Set<string>();
    currentPartnerRules.forEach(r => {
      if (r.regiao && r.regiao.trim()) set.add(r.regiao.trim());
    });
    return Array.from(set);
  }, [currentPartnerRules]);

  // Filtered and sorted rules
  const displayedRules = useMemo(() => {
    let list = [...currentPartnerRules];

    // Filter by search term (CEP, region, or note)
    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      const qDigits = q.replace(/\D/g, '');
      list = list.filter(r => {
        const minClean = cleanCep(r.cepMin);
        const maxClean = cleanCep(r.cepMax);
        const reg = (r.regiao || '').toLowerCase();
        const obs = (r.observacao || r.description || '').toLowerCase();
        const clientCode = (r.codigoCliente || '').toLowerCase();

        if (qDigits && (minClean.includes(qDigits) || maxClean.includes(qDigits))) {
          return true;
        }
        return reg.includes(q) || obs.includes(q) || clientCode.includes(q);
      });
    }

    // Filter by region
    if (regionFilter !== 'all') {
      list = list.filter(r => (r.regiao || '').trim() === regionFilter);
    }

    // Sort
    list.sort((a, b) => {
      const aMin = parseInt(cleanCep(a.cepMin), 10) || 0;
      const bMin = parseInt(cleanCep(b.cepMin), 10) || 0;
      const aVal = Number(a.value) || 0;
      const bVal = Number(b.value) || 0;

      switch (sortBy) {
        case 'cep_asc': return aMin - bMin;
        case 'cep_desc': return bMin - aMin;
        case 'value_asc': return aVal - bVal;
        case 'value_desc': return bVal - aVal;
        default: return 0;
      }
    });

    return list;
  }, [currentPartnerRules, searchTerm, regionFilter, sortBy]);

  // Statistics for the selected partner's freight table
  const partnerStats = useMemo(() => {
    const count = currentPartnerRules.length;
    if (count === 0) {
      return {
        totalRules: 0,
        minFreight: 0,
        maxFreight: 0,
        avgFreight: 0,
        avgRepasse: 0,
        avgPrioridade: 0
      };
    }

    let minF = Infinity;
    let maxF = -Infinity;
    let sumF = 0;
    let sumRepasse = 0;
    let repasseCount = 0;
    let sumPrioridade = 0;
    let prioridadeCount = 0;

    currentPartnerRules.forEach(r => {
      const val = Number(r.value) || 0;
      if (val < minF) minF = val;
      if (val > maxF) maxF = val;
      sumF += val;

      if (r.valorRepasse !== undefined && r.valorRepasse !== null && Number(r.valorRepasse) > 0) {
        sumRepasse += Number(r.valorRepasse);
        repasseCount++;
      }

      if (r.prioridade !== undefined && r.prioridade !== null && Number(r.prioridade) > 0) {
        sumPrioridade += Number(r.prioridade);
        prioridadeCount++;
      }
    });

    return {
      totalRules: count,
      minFreight: minF === Infinity ? 0 : minF,
      maxFreight: maxF === -Infinity ? 0 : maxF,
      avgFreight: Math.round((sumF / count) * 100) / 100,
      avgRepasse: repasseCount > 0 ? Math.round((sumRepasse / repasseCount) * 100) / 100 : 0,
      avgPrioridade: prioridadeCount > 0 ? Math.round((sumPrioridade / prioridadeCount) * 100) / 100 : 0
    };
  }, [currentPartnerRules]);

  // Orders count related to this partner
  const partnerOrdersCount = useMemo(() => {
    if (!selectedPartner) return 0;
    const pId = selectedPartner.id;
    const pCode = selectedPartner.codigoCliente;
    return orders.filter(o => {
      const c = o.codigoCliente || '';
      return c === pId || (pCode && c === pCode);
    }).length;
  }, [orders, selectedPartner]);

  // Handle partner selection
  const handlePartnerSelect = (id: string) => {
    setSelectedPartnerId(id);
    onSelectPartnerId?.(id);
    setTestCepResult(null);
    setSearchTerm('');
    setRegionFilter('all');
  };

  // Run CEP Sandbox Simulation Test
  const handleTestCep = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!testCepInput.trim()) return;

    const result = testCepMatchInRules(testCepInput, currentPartnerRules);
    setTestCepResult({
      tested: true,
      ...result
    });
  };

  // Open Add Rule Modal
  const handleOpenAddModal = () => {
    setEditingRule(null);
    setRuleFormData({
      cepMin: '',
      cepMax: '',
      value: '',
      valorRepasse: '',
      prioridade: '',
      regiao: '',
      prazoDias: '1',
      pesoMaximo: '',
      observacao: ''
    });
    setRuleFormError(null);
    setIsRuleModalOpen(true);
  };

  // Open Edit Rule Modal
  const handleOpenEditModal = (rule: FreightRule) => {
    setEditingRule(rule);
    setRuleFormData({
      cepMin: formatCep(rule.cepMin),
      cepMax: formatCep(rule.cepMax),
      value: rule.value !== undefined ? String(rule.value) : '',
      valorRepasse: rule.valorRepasse !== undefined ? String(rule.valorRepasse) : '',
      prioridade: rule.prioridade !== undefined ? String(rule.prioridade) : '',
      regiao: rule.regiao || '',
      prazoDias: rule.prazoDias !== undefined ? String(rule.prazoDias) : '1',
      pesoMaximo: rule.pesoMaximo !== undefined ? String(rule.pesoMaximo) : '',
      observacao: rule.observacao || rule.description || ''
    });
    setRuleFormError(null);
    setIsRuleModalOpen(true);
  };

  // Save Rule (Add or Edit)
  const handleSaveRule = async () => {
    if (!selectedPartner) {
      setRuleFormError('Selecione um cliente parceiro.');
      return;
    }

    const minClean = cleanCep(ruleFormData.cepMin);
    const maxClean = cleanCep(ruleFormData.cepMax);

    if (!minClean || minClean.length !== 8) {
      setRuleFormError('CEP Inicial deve conter 8 dígitos.');
      return;
    }

    if (!maxClean || maxClean.length !== 8) {
      setRuleFormError('CEP Final deve conter 8 dígitos.');
      return;
    }

    const valNum = parseFloat(ruleFormData.value.replace(',', '.'));
    if (isNaN(valNum) || valNum < 0) {
      setRuleFormError('Informe um valor de frete válido (R$).');
      return;
    }

    let minNum = parseInt(minClean, 10);
    let maxNum = parseInt(maxClean, 10);
    let finalMin = minClean;
    let finalMax = maxClean;

    // Invert if user inverted
    if (minNum > maxNum) {
      finalMin = maxClean;
      finalMax = minClean;
    }

    const repasseNum = ruleFormData.valorRepasse ? parseFloat(ruleFormData.valorRepasse.replace(',', '.')) : undefined;
    const prioridadeNum = ruleFormData.prioridade ? parseFloat(ruleFormData.prioridade.replace(',', '.')) : undefined;
    const prazoNum = ruleFormData.prazoDias ? parseInt(ruleFormData.prazoDias, 10) : 1;
    const pesoNum = ruleFormData.pesoMaximo ? parseFloat(ruleFormData.pesoMaximo.replace(',', '.')) : undefined;

    const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 16);
    const opName = currentUser?.name || 'Administrador';

    const ruleObj: FreightRule = {
      id: editingRule ? editingRule.id : `fr-${selectedPartner.id}-${Date.now()}`,
      partnerId: selectedPartner.id,
      codigoCliente: selectedPartner.codigoCliente || selectedPartner.id,
      cepMin: finalMin,
      cepMax: finalMax,
      value: valNum,
      valorRepasse: repasseNum,
      prioridade: prioridadeNum,
      regiao: ruleFormData.regiao.trim() || undefined,
      prazoDias: isNaN(prazoNum) ? 1 : prazoNum,
      pesoMaximo: isNaN(pesoNum || 0) ? undefined : pesoNum,
      observacao: ruleFormData.observacao.trim() || undefined,
      lastUpdated: nowStr,
      lastUpdatedBy: opName
    };

    let updatedRules: FreightRule[];
    if (editingRule) {
      updatedRules = freightRules.map(r => r.id === editingRule.id ? ruleObj : r);
    } else {
      updatedRules = [...freightRules, ruleObj];
    }

    // Persist
    if (onUpdateFreightRules) {
      onUpdateFreightRules(updatedRules);
    }
    try {
      localStorage.setItem('vinimap_freight_rules', JSON.stringify(updatedRules));
    } catch (e) {}

    // Save to Firestore if available
    if (db) {
      try {
        const cleanDoc: Record<string, any> = {};
        Object.entries(ruleObj).forEach(([k, v]) => {
          if (v !== undefined) cleanDoc[k] = v;
        });
        await setDoc(doc(db, 'freightRules', ruleObj.id), cleanDoc);
      } catch (err) {
        console.error('[Firestore Save Rule Error]', err);
      }
    }

    setIsRuleModalOpen(false);
    setEditingRule(null);
  };

  // Delete Single Rule
  const handleDeleteRule = async (ruleId: string) => {
    if (!confirm('Deseja realmente excluir esta faixa de CEP?')) return;

    const updatedRules = freightRules.filter(r => r.id !== ruleId);
    if (onUpdateFreightRules) {
      onUpdateFreightRules(updatedRules);
    }
    try {
      localStorage.setItem('vinimap_freight_rules', JSON.stringify(updatedRules));
    } catch (e) {}

    if (db) {
      try {
        await deleteDoc(doc(db, 'freightRules', ruleId));
      } catch (err) {
        console.error('[Firestore Delete Rule Error]', err);
      }
    }
  };

  // Clear all rules for current partner
  const handleClearAllPartnerRules = async () => {
    if (!selectedPartner) return;
    const count = currentPartnerRules.length;
    if (count === 0) return;

    const confirmation = prompt(
      `ATENÇÃO: Você está prestes a excluir TODAS as ${count} faixas de CEP cadastradas para o cliente "${selectedPartner.name}".\n\nDigite "CONFIRMAR" para prosseguir:`
    );

    if (confirmation !== 'CONFIRMAR') return;

    const updatedRules = freightRules.filter(r => {
      const pId = selectedPartner.id;
      const pCode = selectedPartner.codigoCliente;
      if (r.partnerId === pId) return false;
      if (pCode && (r.codigoCliente === pCode || r.partnerId === pCode)) return false;
      return true;
    });

    if (onUpdateFreightRules) {
      onUpdateFreightRules(updatedRules);
    }
    try {
      localStorage.setItem('vinimap_freight_rules', JSON.stringify(updatedRules));
    } catch (e) {}

    // Delete from Firestore batch
    if (db && !isFirestoreQuotaExceeded() && currentPartnerRules.length > 0) {
      try {
        const batch = writeBatch(db);
        currentPartnerRules.forEach(r => {
          batch.delete(doc(db, 'freightRules', r.id));
        });
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, 'delete', 'freightRules');
      }
    }

    saveImportHistory({
      id: `hist-clear-${Date.now()}`,
      partnerId: selectedPartner.id,
      partnerName: selectedPartner.name,
      importedAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
      fileName: 'Exclusão Total',
      rulesCount: count,
      mode: 'replace',
      status: 'warning',
      details: `${count} regras foram removidas manualmente do cliente.`,
      importedBy: currentUser?.name || 'Administrador'
    });

    alert(`Todas as ${count} regras foram excluídas com sucesso.`);
  };

  // Recalculate freight for orders of this partner
  const handleTriggerRecalculate = async () => {
    if (!selectedPartner) return;
    setIsRecalculating(true);
    try {
      if (onRecalculateOrdersFreight) {
        await onRecalculateOrdersFreight(selectedPartner.id, currentPartnerRules);
      }
      setRecalcSummary({
        count: partnerOrdersCount,
        partnerName: selectedPartner.name
      });
      setTimeout(() => {
        setRecalcSummary(null);
      }, 6000);
    } catch (e) {
      console.error('[Recalculate Error]', e);
    } finally {
      setIsRecalculating(false);
    }
  };

  // File Upload & Parse for Import
  const handleProcessFile = (file: File) => {
    setImportFile(file);
    setImportFileName(file.name);
    setIsParsing(true);
    setImportSuccessBanner(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buffer = e.target?.result;
        const workbook = XLSX.read(buffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rawJson: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        const result = parseFreightSpreadsheetData(rawJson);
        setParsedRows(result.rules);
        setImportHeaders(result.headersFound);
        setImportValidCount(result.validCount);
        setImportWarningCount(result.warningCount);
        setImportErrorCount(result.errorCount);
      } catch (err) {
        console.error('[Spreadsheet Parse Error]', err);
        alert('Falha ao ler o arquivo. Verifique se o formato é uma planilha Excel (.xlsx, .xls) ou CSV válido.');
      } finally {
        setIsParsing(false);
      }
    };
    reader.onerror = () => {
      setIsParsing(false);
      alert('Erro ao carregar o arquivo.');
    };
    reader.readAsArrayBuffer(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleProcessFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleProcessFile(file);
    }
  };

  // Commit Parsed Rules to System State and Database
  const handleCommitImport = async () => {
    if (!selectedPartner) {
      alert('Selecione um cliente parceiro antes de salvar a importação.');
      return;
    }

    const validRulesToImport = parsedRows.filter(r => r.isValid);
    if (validRulesToImport.length === 0) {
      alert('Nenhuma regra válida para importar. Corrija os erros na planilha.');
      return;
    }

    setIsSubmittingImport(true);
    const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 16);
    const opName = currentUser?.name || 'Administrador';

    const formattedNewRules: FreightRule[] = validRulesToImport.map((row, idx) => ({
      id: `fr-${selectedPartner.id}-${Date.now()}-${idx}`,
      partnerId: selectedPartner.id,
      codigoCliente: selectedPartner.codigoCliente || selectedPartner.id,
      cepMin: row.cepMin,
      cepMax: row.cepMax,
      value: Number(row.value) || 0,
      valorRepasse: row.valorRepasse !== undefined ? Number(row.valorRepasse) : 0,
      prioridade: row.prioridade !== undefined ? Number(row.prioridade) : 0,
      regiao: row.regiao || '',
      prazoDias: row.prazoDias || 1,
      pesoMaximo: row.pesoMaximo !== undefined ? Number(row.pesoMaximo) : 0,
      observacao: row.observacao || '',
      lastUpdated: nowStr,
      lastUpdatedBy: opName
    }));

    let nextRules: FreightRule[];
    if (importMode === 'replace') {
      // Remove previous rules of this partner
      const otherPartnersRules = freightRules.filter(r => {
        const pId = selectedPartner.id;
        const pCode = selectedPartner.codigoCliente;
        if (r.partnerId === pId) return false;
        if (pCode && (r.codigoCliente === pCode || r.partnerId === pCode)) return false;
        return true;
      });
      nextRules = [...otherPartnersRules, ...formattedNewRules];
    } else {
      // Merge mode
      nextRules = [...freightRules, ...formattedNewRules];
    }

    // Save to state
    if (onUpdateFreightRules) {
      onUpdateFreightRules(nextRules);
    }
    try {
      localStorage.setItem('vinimap_freight_rules', JSON.stringify(nextRules));
    } catch (e) {}

    // Save to Firestore in chunks of up to 400 operations per batch to prevent 500 limit
    if (db && !isFirestoreQuotaExceeded()) {
      try {
        let currentBatch = writeBatch(db);
        let batchCount = 0;

        if (importMode === 'replace' && currentPartnerRules.length > 0) {
          for (const oldR of currentPartnerRules) {
            currentBatch.delete(doc(db, 'freightRules', oldR.id));
            batchCount++;
            if (batchCount >= 400) {
              await currentBatch.commit();
              currentBatch = writeBatch(db);
              batchCount = 0;
            }
          }
        }

        for (const newR of formattedNewRules) {
          const cleanDoc: Record<string, any> = {};
          Object.entries(newR).forEach(([k, v]) => {
            if (v !== undefined) cleanDoc[k] = v;
          });
          currentBatch.set(doc(db, 'freightRules', newR.id), cleanDoc);
          batchCount++;
          if (batchCount >= 400) {
            await currentBatch.commit();
            currentBatch = writeBatch(db);
            batchCount = 0;
          }
        }

        if (batchCount > 0) {
          await currentBatch.commit();
        }
      } catch (err) {
        handleFirestoreError(err, 'write', 'freightRules');
      }
    }

    // Call Backend endpoint /api/freight-rules as proxy
    try {
      await fetch('/api/freight-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partnerId: selectedPartner.id,
          codigoCliente: selectedPartner.codigoCliente || selectedPartner.id,
          rules: formattedNewRules,
          mode: importMode
        })
      });
    } catch (err) {
      console.warn('[Backend Freight Sync Warning]', err);
    }

    // Automatically recalculate open orders for this partner
    if (onRecalculateOrdersFreight) {
      try {
        await onRecalculateOrdersFreight(selectedPartner.id, formattedNewRules);
      } catch (e) {}
    }

    // Save to history audit log
    saveImportHistory({
      id: `hist-${Date.now()}`,
      partnerId: selectedPartner.id,
      partnerName: selectedPartner.name,
      importedAt: nowStr,
      fileName: importFileName || 'Importação Manual',
      rulesCount: formattedNewRules.length,
      mode: importMode,
      status: importErrorCount > 0 ? 'warning' : 'success',
      details: `${formattedNewRules.length} faixas de CEP importadas no modo ${importMode === 'replace' ? 'Substituição Completa' : 'Mesclagem'}.`,
      importedBy: opName
    });

    // Refresh database state if callback provided
    if (onRefetchDatabase) {
      try {
        onRefetchDatabase();
      } catch (e) {}
    }

    setIsSubmittingImport(false);
    setImportSuccessBanner(
      `Sucesso! ${formattedNewRules.length} faixas de CEP foram importadas e vinculadas ao cliente "${selectedPartner.name}". Tabela atualizada com sucesso.`
    );

    // Clear import file state immediately and switch to table view
    setImportFile(null);
    setParsedRows([]);
    setActiveViewMode('rules_table');
  };

  return (
    <div className="space-y-6 animate-fade-in" id="freight-control-center">
      {/* Top Header & Title */}
      <div className="pb-4 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-xl shadow-md shadow-blue-500/20">
              <FileSpreadsheet className="h-6 w-6" />
            </span>
            <div>
              <h2 className="text-xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
                Central de Controle de Importação de Tabela de Frete
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200/60 rounded-full">
                  Por Cliente
                </span>
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Gestão e parametrização tarifária de fretes por faixa de CEP, repasses a condutores e regras de entrega por parceiro
              </p>
            </div>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center flex-wrap gap-2">
          <button
            onClick={() => downloadFreightTemplateXLSX(selectedPartner?.name)}
            className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold shadow-xs cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99]"
            title="Baixar modelo de planilha (.xlsx) com colunas prontas para preenchimento"
          >
            <Download className="h-4 w-4 text-emerald-600" />
            <span>Baixar Modelo (.xlsx)</span>
          </button>

          <button
            onClick={() => {
              if (activeViewMode === 'import_wizard') {
                setActiveViewMode('rules_table');
              } else {
                setActiveViewMode('import_wizard');
              }
            }}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold shadow-sm cursor-pointer transition-all ${
              activeViewMode === 'import_wizard'
                ? 'bg-indigo-600 text-white shadow-indigo-200'
                : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-blue-500/20'
            }`}
          >
            <Upload className="h-4 w-4" />
            <span>{activeViewMode === 'import_wizard' ? 'Ver Tabela Atual' : 'Importar Planilha'}</span>
          </button>

          <button
            onClick={handleOpenAddModal}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer transition-all"
          >
            <Plus className="h-4 w-4 text-cyan-400" />
            <span>Nova Faixa CEP</span>
          </button>
        </div>
      </div>

      {/* Recalculate Toast / Banner Feedback */}
      {recalcSummary && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl flex items-center justify-between shadow-sm animate-fade-in">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            <div>
              <p className="text-xs font-bold">Frete dos Pedidos Recalculado com Sucesso!</p>
              <p className="text-[11px] text-emerald-700">
                Os pedidos em aberto vinculados ao cliente <strong>{recalcSummary.partnerName}</strong> foram atualizados com as tarifas vigentes.
              </p>
            </div>
          </div>
          <button 
            onClick={() => setRecalcSummary(null)} 
            className="text-emerald-600 hover:text-emerald-900 text-xs font-bold px-2 py-1 cursor-pointer"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Success Banner if import just finished */}
      {importSuccessBanner && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl flex items-center justify-between shadow-sm animate-fade-in">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0" />
            <div>
              <p className="text-xs font-bold">{importSuccessBanner}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setImportSuccessBanner(null)}
            className="text-emerald-700 hover:text-emerald-950 text-xs font-bold px-2.5 py-1 bg-emerald-100/60 hover:bg-emerald-100 rounded-lg transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveViewMode('rules_table')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
            activeViewMode === 'rules_table'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Layers className="h-4 w-4" />
          <span>Tabela de Faixas ({currentPartnerRules.length})</span>
        </button>

        <button
          onClick={() => setActiveViewMode('import_wizard')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
            activeViewMode === 'import_wizard'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Upload className="h-4 w-4 text-cyan-400" />
          <span>Central de Importação</span>
        </button>

        <button
          onClick={() => setActiveViewMode('all_partners_summary')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
            activeViewMode === 'all_partners_summary'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Building2 className="h-4 w-4 text-indigo-400" />
          <span>Visão Geral dos Clientes ({partnerClients.length})</span>
        </button>

        <button
          onClick={() => setActiveViewMode('import_history')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
            activeViewMode === 'import_history'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <History className="h-4 w-4 text-amber-400" />
          <span>Histórico & Auditoria</span>
        </button>
      </div>

      {/* Partner Client Selection Card (Top Executive Widget) */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
              Cliente Parceiro Selecionado:
            </label>
            <div className="flex items-center gap-3">
              <div className="relative min-w-[280px] max-w-md">
                <select
                  value={selectedPartnerId}
                  onChange={(e) => handlePartnerSelect(e.target.value)}
                  className="w-full pl-3.5 pr-8 py-2.5 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer transition-all"
                >
                  {partnerClients.map(p => {
                    const clientRulesCount = freightRules.filter(r => r.partnerId === p.id || (p.codigoCliente && r.codigoCliente === p.codigoCliente)).length;
                    return (
                      <option key={p.id} value={p.id}>
                        {p.name} — [{p.codigoCliente || p.id}] ({clientRulesCount} faixas)
                      </option>
                    );
                  })}
                </select>
              </div>

              {selectedPartner && (
                <div className="hidden sm:flex items-center gap-2">
                  <span className="text-xs px-2.5 py-1 bg-blue-50 text-blue-700 font-bold border border-blue-200/60 rounded-lg">
                    Código: {selectedPartner.codigoCliente || selectedPartner.id}
                  </span>
                  {selectedPartner.cnpjCpf && (
                    <span className="text-xs px-2.5 py-1 bg-slate-100 text-slate-600 font-medium rounded-lg">
                      CNPJ: {selectedPartner.cnpjCpf}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Quick Action Utilities for the selected partner */}
          <div className="flex items-center flex-wrap gap-2">
            <button
              onClick={handleTriggerRecalculate}
              disabled={isRecalculating || currentPartnerRules.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-100/80 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold shadow-xs cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              title="Aplica a tabela de frete atualizada em todos os pedidos pendentes/em rota deste parceiro"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRecalculating ? 'animate-spin' : ''}`} />
              <span>{isRecalculating ? 'Recalculando...' : 'Recalcular Pedidos'}</span>
            </button>

            <button
              onClick={() => exportPartnerFreightRulesToXLSX(currentPartnerRules, selectedPartner || undefined)}
              disabled={currentPartnerRules.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold shadow-xs cursor-pointer transition-all disabled:opacity-50"
              title="Exportar as regras cadastradas deste parceiro para Excel (.xlsx)"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
              <span>Exportar Excel</span>
            </button>

            <button
              onClick={() => exportPartnerFreightRulesToCSV(currentPartnerRules, selectedPartner || undefined)}
              disabled={currentPartnerRules.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold shadow-xs cursor-pointer transition-all disabled:opacity-50"
              title="Exportar as regras cadastradas deste parceiro para CSV (.csv)"
            >
              <FileText className="h-3.5 w-3.5 text-slate-600" />
              <span>Exportar CSV</span>
            </button>

            {currentPartnerRules.length > 0 && (
              <button
                onClick={handleClearAllPartnerRules}
                className="flex items-center gap-1.5 px-2.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold shadow-xs cursor-pointer transition-all"
                title="Excluir todas as faixas de CEP deste cliente"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Limpar Tabela</span>
              </button>
            )}
          </div>
        </div>

        {/* Stats Metrics Bento Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-2 border-t border-slate-100">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Faixas de CEP</p>
            <p className="text-lg font-extrabold text-slate-800 mt-0.5">{partnerStats.totalRules}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">{partnerOrdersCount} pedidos vinculados</p>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Frete Mínimo</p>
            <p className="text-lg font-extrabold text-emerald-700 mt-0.5">
              R$ {partnerStats.minFreight.toFixed(2)}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">Menor tarifa cadastrada</p>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Frete Médio</p>
            <p className="text-lg font-extrabold text-blue-700 mt-0.5">
              R$ {partnerStats.avgFreight.toFixed(2)}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">Média ponderada</p>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Frete Máximo</p>
            <p className="text-lg font-extrabold text-indigo-700 mt-0.5">
              R$ {partnerStats.maxFreight.toFixed(2)}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">Maior tarifa cadastrada</p>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Repasse Médio</p>
            <p className="text-lg font-extrabold text-cyan-700 mt-0.5">
              R$ {partnerStats.avgRepasse.toFixed(2)}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">Ganho do condutor</p>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tarifa Prioridade</p>
            <p className="text-lg font-extrabold text-amber-700 mt-0.5">
              R$ {partnerStats.avgPrioridade.toFixed(2)}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">Média entrega expressa</p>
          </div>
        </div>
      </div>

      {/* Live CEP Sandbox Simulator */}
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950 p-5 rounded-2xl text-white shadow-md space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-cyan-500/20 text-cyan-300 rounded-lg">
              <Calculator className="h-4 w-4" />
            </span>
            <h4 className="text-sm font-bold text-white">Simulador de Consulta de Frete por CEP</h4>
          </div>
          <span className="text-[11px] text-slate-300">
            Testando na tabela do cliente: <strong className="text-cyan-300">{selectedPartner?.name}</strong>
          </span>
        </div>

        <form onSubmit={handleTestCep} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Digite um CEP para simular (ex: 01310-100 ou 04538-132)..."
              value={testCepInput}
              onChange={(e) => setTestCepInput(e.target.value)}
              className="w-full px-4 py-2.5 bg-white/10 border border-white/20 rounded-xl text-sm font-medium text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-400"
            />
            {testCepInput && (
              <button
                type="button"
                onClick={() => {
                  setTestCepInput('');
                  setTestCepResult(null);
                }}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-white text-xs font-bold"
              >
                Limpar
              </button>
            )}
          </div>

          <button
            type="submit"
            className="px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-xl text-sm shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <Sparkles className="h-4 w-4" />
            <span>Consultar Tarifa</span>
          </button>
        </form>

        {/* Simulator Result Output Card */}
        {testCepResult && testCepResult.tested && (
          <div className={`p-4 rounded-xl border transition-all ${
            testCepResult.matched 
              ? 'bg-white/10 border-emerald-400/40 text-white' 
              : 'bg-rose-950/40 border-rose-500/40 text-rose-200'
          }`}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-extrabold px-2.5 py-0.5 rounded-full ${
                    testCepResult.matched ? 'bg-emerald-500 text-slate-950' : 'bg-rose-500 text-white'
                  }`}>
                    {testCepResult.matched ? 'FAIXA ENCONTRADA' : 'FORA DA COBERTURA'}
                  </span>
                  <span className="text-xs font-mono font-bold text-cyan-300">CEP: {testCepResult.cepFormatted}</span>
                </div>
                <p className="text-xs text-slate-200">{testCepResult.message}</p>
              </div>

              {testCepResult.matched && testCepResult.rule && (
                <div className="flex items-center gap-4 bg-white/10 px-4 py-2 rounded-xl border border-white/10 shrink-0">
                  <div>
                    <span className="text-[10px] text-slate-300 uppercase block">Frete Cliente</span>
                    <span className="text-base font-extrabold text-emerald-300">
                      R$ {Number(testCepResult.rule.value).toFixed(2)}
                    </span>
                  </div>

                  {testCepResult.rule.valorRepasse !== undefined && (
                    <div className="border-l border-white/10 pl-4">
                      <span className="text-[10px] text-slate-300 uppercase block">Repasse Condutor</span>
                      <span className="text-base font-extrabold text-cyan-300">
                        R$ {Number(testCepResult.rule.valorRepasse).toFixed(2)}
                      </span>
                    </div>
                  )}

                  {testCepResult.rule.prioridade !== undefined && (
                    <div className="border-l border-white/10 pl-4">
                      <span className="text-[10px] text-slate-300 uppercase block">Express / Prioridade</span>
                      <span className="text-base font-extrabold text-amber-300">
                        R$ {Number(testCepResult.rule.prioridade).toFixed(2)}
                      </span>
                    </div>
                  )}

                  {testCepResult.rule.prazoDias && (
                    <div className="border-l border-white/10 pl-4">
                      <span className="text-[10px] text-slate-300 uppercase block">Prazo SLA</span>
                      <span className="text-xs font-bold text-slate-200">
                        {testCepResult.rule.prazoDias} dia(s)
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* VIEW MODE 1: RULES TABLE (MAIN CRUD VIEW)                                */}
      {/* ========================================================================= */}
      {activeViewMode === 'rules_table' && (
        <div className="space-y-4">
          {/* Filter & Search Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200">
            <div className="relative flex-1">
              <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder="Filtrar por CEP, bairro, região ou código..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center gap-2">
              {availableRegions.length > 0 && (
                <select
                  value={regionFilter}
                  onChange={(e) => setRegionFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
                >
                  <option value="all">Todas as Regiões ({availableRegions.length})</option>
                  {availableRegions.map(reg => (
                    <option key={reg} value={reg}>{reg}</option>
                  ))}
                </select>
              )}

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="cep_asc">CEP Inicial (Crescente)</option>
                <option value="cep_desc">CEP Inicial (Decrescente)</option>
                <option value="value_asc">Valor Frete (Menor Primeiro)</option>
                <option value="value_desc">Valor Frete (Maior Primeiro)</option>
              </select>
            </div>
          </div>

          {/* Rules Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                    <th className="py-3 px-4">#</th>
                    <th className="py-3 px-4">Faixa de CEP (De - Até)</th>
                    <th className="py-3 px-4">Região / Bairro</th>
                    <th className="py-3 px-4 text-right">Frete Cliente</th>
                    <th className="py-3 px-4 text-right">Repasse Condutor</th>
                    <th className="py-3 px-4 text-right">Tarifa Expressa</th>
                    <th className="py-3 px-4 text-center">Prazo</th>
                    <th className="py-3 px-4">Observações</th>
                    <th className="py-3 px-4 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {displayedRules.map((rule, idx) => (
                    <tr key={rule.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                      
                      <td className="py-3 px-4 font-mono font-bold text-slate-800">
                        <div className="flex items-center gap-1.5">
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md border border-blue-100">
                            {formatCep(rule.cepMin)}
                          </span>
                          <span className="text-slate-400">até</span>
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md border border-blue-100">
                            {formatCep(rule.cepMax)}
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-4 font-medium text-slate-700">
                        {rule.regiao ? (
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md font-semibold">
                            {rule.regiao}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">Padrão Geral</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right font-extrabold text-slate-900">
                        R$ {Number(rule.value).toFixed(2)}
                      </td>

                      <td className="py-3 px-4 text-right font-bold text-cyan-700">
                        {rule.valorRepasse !== undefined && rule.valorRepasse !== null
                          ? `R$ ${Number(rule.valorRepasse).toFixed(2)}`
                          : <span className="text-slate-400">-</span>
                        }
                      </td>

                      <td className="py-3 px-4 text-right font-bold text-amber-700">
                        {rule.prioridade !== undefined && rule.prioridade !== null
                          ? `R$ ${Number(rule.prioridade).toFixed(2)}`
                          : <span className="text-slate-400">-</span>
                        }
                      </td>

                      <td className="py-3 px-4 text-center font-medium text-slate-600">
                        {rule.prazoDias ? `${rule.prazoDias} dia(s)` : '1 dia'}
                      </td>

                      <td className="py-3 px-4 text-slate-500 max-w-xs truncate" title={rule.observacao || rule.description || ''}>
                        {rule.observacao || rule.description || <span className="text-slate-300">-</span>}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleOpenEditModal(rule)}
                            className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Editar esta faixa de CEP"
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteRule(rule.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Excluir esta faixa"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {displayedRules.length === 0 && (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400">
                        <div className="max-w-md mx-auto space-y-3">
                          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                            <FileSpreadsheet className="h-6 w-6" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-700">Nenhuma faixa de CEP cadastrada</p>
                            <p className="text-xs text-slate-400 mt-0.5">
                              {searchTerm 
                                ? 'Nenhum resultado corresponde à sua pesquisa.' 
                                : `O cliente "${selectedPartner?.name}" ainda não possui tabela tarifária cadastrada.`
                              }
                            </p>
                          </div>
                          <div className="flex items-center justify-center gap-2 pt-2">
                            <button
                              onClick={() => setActiveViewMode('import_wizard')}
                              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                            >
                              Importar Planilha (.xlsx)
                            </button>
                            <button
                              onClick={handleOpenAddModal}
                              className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
                            >
                              Cadastrar Faixa Manual
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer Summary */}
            <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
              <p>
                Exibindo <span className="font-bold text-slate-800">{displayedRules.length}</span> de <span className="font-bold text-slate-800">{currentPartnerRules.length}</span> faixas cadastradas para <strong>{selectedPartner?.name}</strong>.
              </p>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                  Tarifas Sincronizadas
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW MODE 2: IMPORT WIZARD (SPREADSHEET DRAG & DROP + PREVIEW)            */}
      {/* ========================================================================= */}
      {activeViewMode === 'import_wizard' && (
        <div className="space-y-6 animate-fade-in">
          {/* Success Banner if import just finished */}
          {importSuccessBanner && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl flex items-center gap-3 shadow-sm animate-fade-in">
              <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0" />
              <div>
                <p className="text-xs font-bold">{importSuccessBanner}</p>
              </div>
            </div>
          )}

          {/* Import Setup Box */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-800">
                  Carregar Planilha de Frete para: <span className="text-blue-600">{selectedPartner?.name}</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Arraste ou selecione a planilha de frete fornecida pelo cliente parceiro. O sistema mapeará as faixas de CEP e valores automaticamente.
                </p>
              </div>

              {/* Mode Selector (Replace vs Merge) */}
              <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setImportMode('replace')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    importMode === 'replace'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Substituir Tabela Inteira
                </button>
                <button
                  type="button"
                  onClick={() => setImportMode('merge')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    importMode === 'merge'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Mesclar / Adicionar
                </button>
              </div>
            </div>

            {/* Drag and Drop Zone */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".xlsx,.xls,.csv"
              className="hidden"
            />

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                isDragging
                  ? 'border-blue-500 bg-blue-50/50 scale-[1.01]'
                  : 'border-slate-300 hover:border-blue-400 bg-slate-50/50 hover:bg-slate-50'
              }`}
            >
              <div className="max-w-md mx-auto space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center mx-auto shadow-inner">
                  <Upload className="h-7 w-7" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">
                    {importFileName ? importFileName : 'Clique ou arraste sua planilha de frete aqui'}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Formatos suportados: Microsoft Excel (.xlsx, .xls) ou Texto Separado por Vírgula (.csv)
                  </p>
                </div>

                <div className="pt-2 flex items-center justify-center gap-2">
                  <span className="px-2.5 py-1 bg-white border border-slate-200 text-[11px] font-semibold text-slate-600 rounded-lg shadow-xs">
                    CEP Inicial
                  </span>
                  <span className="px-2.5 py-1 bg-white border border-slate-200 text-[11px] font-semibold text-slate-600 rounded-lg shadow-xs">
                    CEP Final
                  </span>
                  <span className="px-2.5 py-1 bg-white border border-slate-200 text-[11px] font-semibold text-slate-600 rounded-lg shadow-xs">
                    Valor Frete (R$)
                  </span>
                  <span className="px-2.5 py-1 bg-white border border-slate-200 text-[11px] font-semibold text-slate-600 rounded-lg shadow-xs">
                    Repasse Condutor (R$)
                  </span>
                </div>
              </div>
            </div>

            {/* Template Download Prompt */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <Info className="h-4 w-4 text-blue-600 shrink-0" />
                <span className="text-slate-600">
                  Precisa de um arquivo modelo? Baixe a planilha padrão com as faixas de CEP e exemplos prontos.
                </span>
              </div>
              <button
                type="button"
                onClick={() => downloadFreightTemplateXLSX(selectedPartner?.name)}
                className="px-3 py-1.5 bg-white hover:bg-slate-100 text-blue-700 border border-blue-200 rounded-lg font-bold shrink-0 transition-colors shadow-xs"
              >
                Baixar Planilha Modelo (.xlsx)
              </button>
            </div>
          </div>

          {/* Interactive Parsing & Preview Section */}
          {parsedRows.length > 0 && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div>
                  <h4 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
                    Pré-visualização da Planilha
                    <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-700 font-bold rounded-md">
                      {parsedRows.length} linhas lidas
                    </span>
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Revise os dados detectados antes de confirmar a importação para o cliente <strong>{selectedPartner?.name}</strong>.
                  </p>
                </div>

                {/* Validation Summary Badges */}
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {importValidCount} Válidas
                  </span>
                  {importWarningCount > 0 && (
                    <span className="px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-xs font-bold flex items-center gap-1">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      {importWarningCount} Avisos
                    </span>
                  )}
                  {importErrorCount > 0 && (
                    <span className="px-2.5 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold flex items-center gap-1">
                      <AlertCircle className="h-3.5 w-3.5" />
                      {importErrorCount} Erros
                    </span>
                  )}
                </div>
              </div>

              {/* Preview Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-96 overflow-y-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3">Linha</th>
                      <th className="py-2.5 px-3">CEP Inicial</th>
                      <th className="py-2.5 px-3">CEP Final</th>
                      <th className="py-2.5 px-3 text-right">Valor Frete</th>
                      <th className="py-2.5 px-3 text-right">Repasse Condutor</th>
                      <th className="py-2.5 px-3 text-right">Prioridade</th>
                      <th className="py-2.5 px-3">Região</th>
                      <th className="py-2.5 px-3 text-center">Prazo</th>
                      <th className="py-2.5 px-3">Validação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parsedRows.slice(0, 100).map((row) => (
                      <tr key={row.index} className={row.isValid ? 'hover:bg-slate-50' : 'bg-rose-50/50'}>
                        <td className="py-2 px-3 text-slate-400 font-mono text-[11px]">{row.index}</td>
                        <td className="py-2 px-3 font-mono font-bold text-slate-800">{row.cepMinFormatted}</td>
                        <td className="py-2 px-3 font-mono font-bold text-slate-800">{row.cepMaxFormatted}</td>
                        <td className="py-2 px-3 text-right font-extrabold text-slate-900">R$ {row.value.toFixed(2)}</td>
                        <td className="py-2 px-3 text-right font-bold text-cyan-700">
                          {row.valorRepasse !== undefined ? `R$ ${row.valorRepasse.toFixed(2)}` : '-'}
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-amber-700">
                          {row.prioridade !== undefined ? `R$ ${row.prioridade.toFixed(2)}` : '-'}
                        </td>
                        <td className="py-2 px-3 text-slate-700 font-medium">{row.regiao || '-'}</td>
                        <td className="py-2 px-3 text-center text-slate-600">{row.prazoDias}d</td>
                        <td className="py-2 px-3">
                          {row.error ? (
                            <span className="text-[11px] font-bold text-rose-600 flex items-center gap-1">
                              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                              {row.error}
                            </span>
                          ) : row.warning ? (
                            <span className="text-[11px] font-semibold text-amber-600 flex items-center gap-1">
                              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                              {row.warning}
                            </span>
                          ) : (
                            <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                              Pronto
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Action Commit Buttons */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setImportFile(null);
                    setParsedRows([]);
                  }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-all cursor-pointer"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={handleCommitImport}
                  disabled={isSubmittingImport || importValidCount === 0}
                  className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold rounded-xl text-sm shadow-md shadow-emerald-500/20 transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
                >
                  {isSubmittingImport ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>Gravando e Sincronizando...</span>
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      <span>Confirmar Importação de {importValidCount} Faixas</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW MODE 3: ALL PARTNERS SUMMARY                                        */}
      {/* ========================================================================= */}
      {activeViewMode === 'all_partners_summary' && (
        <div className="space-y-4 animate-fade-in">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div>
              <h3 className="text-base font-bold text-slate-800">Visão Geral dos Clientes Parceiros & Tabelas de Frete</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Consolidação de todos os clientes cadastrados no ViniMap, status da tabela de frete e atalhos rápidos de importação.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {partnerClients.map(partner => {
                const partnerRules = freightRules.filter(r => 
                  r.partnerId === partner.id || (partner.codigoCliente && r.codigoCliente === partner.codigoCliente)
                );
                const isConfigured = partnerRules.length > 0;

                return (
                  <div
                    key={partner.id}
                    className={`p-4 rounded-2xl border transition-all flex flex-col justify-between space-y-3 ${
                      selectedPartnerId === partner.id
                        ? 'bg-blue-50/50 border-blue-300 ring-2 ring-blue-500/20'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-sm font-extrabold text-slate-800">{partner.name}</h4>
                        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                          isConfigured 
                            ? 'bg-emerald-100 text-emerald-800' 
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {isConfigured ? `${partnerRules.length} Faixas` : 'Sem Tabela'}
                        </span>
                      </div>
                      <p className="text-xs font-mono text-slate-500">
                        Código: <strong>{partner.codigoCliente || partner.id}</strong>
                      </p>
                      {partner.cnpjCpf && (
                        <p className="text-[11px] text-slate-400">CNPJ: {partner.cnpjCpf}</p>
                      )}
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                      <button
                        onClick={() => {
                          handlePartnerSelect(partner.id);
                          setActiveViewMode('rules_table');
                        }}
                        className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                      >
                        <span>Gerenciar Faixas</span>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>

                      <button
                        onClick={() => {
                          handlePartnerSelect(partner.id);
                          setActiveViewMode('import_wizard');
                        }}
                        className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
                      >
                        Importar Planilha
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW MODE 4: IMPORT HISTORY & AUDIT LOGS                                  */}
      {/* ========================================================================= */}
      {activeViewMode === 'import_history' && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4 animate-fade-in">
          <div>
            <h3 className="text-base font-bold text-slate-800">Histórico de Importações & Auditoria de Tarifas</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Registro das planilhas importadas, alterações de regras e operações realizadas por operadores.
            </p>
          </div>

          <div className="divide-y divide-slate-100">
            {importHistory.map((item) => (
              <div key={item.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${
                      item.status === 'success' ? 'bg-emerald-500' : item.status === 'warning' ? 'bg-amber-500' : 'bg-rose-500'
                    }`}></span>
                    <h4 className="text-xs font-extrabold text-slate-800">{item.partnerName}</h4>
                    <span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-600 font-mono rounded">
                      {item.fileName}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">{item.details || `${item.rulesCount} faixas processadas`}</p>
                </div>

                <div className="text-right shrink-0">
                  <p className="text-xs font-bold text-slate-700">{item.importedAt}</p>
                  <p className="text-[10px] text-slate-400">Por: {item.importedBy || 'Administrador'}</p>
                </div>
              </div>
            ))}

            {importHistory.length === 0 && (
              <p className="text-xs text-slate-400 py-8 text-center">Nenhum histórico registrado até o momento.</p>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MANUAL RULE MODAL (ADD / EDIT)                                            */}
      {/* ========================================================================= */}
      {isRuleModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden space-y-5 p-6 animate-scale-in">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                  {editingRule ? <Edit3 className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
                </span>
                <div>
                  <h3 className="text-base font-bold text-slate-800">
                    {editingRule ? 'Editar Faixa de CEP' : 'Cadastrar Nova Faixa de CEP'}
                  </h3>
                  <p className="text-xs text-slate-500">Cliente: <strong>{selectedPartner?.name}</strong></p>
                </div>
              </div>

              <button
                onClick={() => setIsRuleModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {ruleFormError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{ruleFormError}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">CEP Inicial *</label>
                <input
                  type="text"
                  placeholder="01000-000"
                  value={ruleFormData.cepMin}
                  onChange={(e) => setRuleFormData(prev => ({ ...prev, cepMin: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">CEP Final *</label>
                <input
                  type="text"
                  placeholder="01999-999"
                  value={ruleFormData.cepMax}
                  onChange={(e) => setRuleFormData(prev => ({ ...prev, cepMax: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Valor Frete Cliente (R$) *</label>
                <input
                  type="text"
                  placeholder="18.50"
                  value={ruleFormData.value}
                  onChange={(e) => setRuleFormData(prev => ({ ...prev, value: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Valor Repasse Condutor (R$)</label>
                <input
                  type="text"
                  placeholder="12.00"
                  value={ruleFormData.valorRepasse}
                  onChange={(e) => setRuleFormData(prev => ({ ...prev, valorRepasse: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs text-cyan-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Tarifa Expressa / Prioridade (R$)</label>
                <input
                  type="text"
                  placeholder="24.00"
                  value={ruleFormData.prioridade}
                  onChange={(e) => setRuleFormData(prev => ({ ...prev, prioridade: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs text-amber-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Região / Bairro</label>
                <input
                  type="text"
                  placeholder="Ex: Centro-Paulista"
                  value={ruleFormData.regiao}
                  onChange={(e) => setRuleFormData(prev => ({ ...prev, regiao: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Prazo SLA (Dias)</label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={ruleFormData.prazoDias}
                  onChange={(e) => setRuleFormData(prev => ({ ...prev, prazoDias: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Peso Máximo (kg)</label>
                <input
                  type="text"
                  placeholder="Ex: 10"
                  value={ruleFormData.pesoMaximo}
                  onChange={(e) => setRuleFormData(prev => ({ ...prev, pesoMaximo: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="col-span-2">
                <label className="block font-bold text-slate-700 mb-1">Observações / Detalhes</label>
                <input
                  type="text"
                  placeholder="Ex: Região Sé, Bela Vista, República"
                  value={ruleFormData.observacao}
                  onChange={(e) => setRuleFormData(prev => ({ ...prev, observacao: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsRuleModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveRule}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-md shadow-blue-500/20 transition-all"
              >
                {editingRule ? 'Salvar Alterações' : 'Cadastrar Faixa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FreightConfigTab;
