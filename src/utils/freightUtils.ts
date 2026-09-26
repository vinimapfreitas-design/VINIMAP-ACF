import * as XLSX from 'xlsx';
import { FreightRule, PartnerClient } from '../types';

export const cleanCep = (cep: string | number | undefined | null): string => {
  if (!cep) return '';
  const digits = String(cep).replace(/\D/g, '');
  if (!digits) return '';
  // Excel often strips leading 0 from 8-digit CEPs (e.g., 1000000 -> 01000000)
  return digits.padStart(8, '0').slice(0, 8);
};

export const formatCep = (cep: string | number | undefined | null): string => {
  const cleaned = cleanCep(cep);
  if (cleaned.length !== 8) return String(cep || '');
  return `${cleaned.slice(0, 5)}-${cleaned.slice(5, 8)}`;
};

export const parseCurrencyValue = (val: any): number => {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  let str = String(val).trim();
  // Remove "R$", spaces, etc.
  str = str.replace(/R\$\s?/gi, '').replace(/\s+/g, '');
  // If format is brazilian "1.234,56" or "18,50"
  if (str.includes(',') && str.includes('.')) {
    if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      str = str.replace(/,/g, '');
    }
  } else if (str.includes(',')) {
    str = str.replace(',', '.');
  }
  const parsed = parseFloat(str);
  return isNaN(parsed) ? 0 : Math.round(parsed * 100) / 100;
};

export interface ParsedFreightRow {
  index: number;
  cepMin: string;
  cepMax: string;
  cepMinFormatted: string;
  cepMaxFormatted: string;
  value: number;
  valorRepasse?: number;
  prioridade?: number;
  regiao?: string;
  prazoDias?: number;
  pesoMaximo?: number;
  observacao?: string;
  isValid: boolean;
  warning?: string;
  error?: string;
}

export interface ParseFreightResult {
  rules: ParsedFreightRow[];
  validCount: number;
  warningCount: number;
  errorCount: number;
  totalRows: number;
  headersFound: string[];
}

export const normalizeColumnHeader = (header: string): string => {
  return header
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .trim();
};

export const parseFreightSpreadsheetData = (data: any[][]): ParseFreightResult => {
  if (!data || data.length === 0) {
    return {
      rules: [],
      validCount: 0,
      warningCount: 0,
      errorCount: 0,
      totalRows: 0,
      headersFound: []
    };
  }

  // Helper to check if a cell looks like a CEP (8 digits or 5-3 format)
  const isLikeCep = (val: any): boolean => {
    if (val === null || val === undefined) return false;
    const str = String(val).trim().replace(/\D/g, '');
    return str.length >= 7 && str.length <= 8;
  };

  // 1. Detect which row is the actual header row (among the first 10 rows)
  let headerRowIndex = -1;
  let normalizedHeaders: string[] = [];
  let rawHeaders: string[] = [];

  const headerKeywords = [
    'cep', 'inicial', 'final', 'inicio', 'fim', 'de', 'ate', 'para', 'valor',
    'frete', 'entrega', 'preco', 'repasse', 'condutor', 'motorista', 'tarifa', 'taxa', 'regiao'
  ];

  for (let r = 0; r < Math.min(data.length, 10); r++) {
    const row = data[r];
    if (!Array.isArray(row) || row.length === 0) continue;
    const rowNormalized = row.map(cell => normalizeColumnHeader(String(cell || '')));
    const matchCount = rowNormalized.filter(h => headerKeywords.some(k => h.includes(k))).length;
    if (matchCount >= 2) {
      headerRowIndex = r;
      rawHeaders = row.map(h => String(h || '').trim());
      normalizedHeaders = rowNormalized;
      break;
    }
  }

  let startDataRow = 0;
  if (headerRowIndex !== -1) {
    startDataRow = headerRowIndex + 1;
  } else {
    // Check if row 0 has data directly (e.g. without headers)
    if (data[0] && (isLikeCep(data[0][0]) || isLikeCep(data[0][1]))) {
      startDataRow = 0;
      rawHeaders = ['CEP Inicial', 'CEP Final', 'Valor Frete', 'Repasse Condutor', 'Prioridade', 'Região'];
      normalizedHeaders = ['cep_inicial', 'cep_final', 'valor_frete', 'valor_repasse', 'prioridade', 'regiao'];
    } else {
      // Fall back to row 0 as header
      startDataRow = 1;
      rawHeaders = (data[0] || []).map(h => String(h || '').trim());
      normalizedHeaders = rawHeaders.map(normalizeColumnHeader);
    }
  }

  // Helper matcher
  const findHeaderIndex = (patterns: string[]): number => {
    return normalizedHeaders.findIndex(h => 
      patterns.some(p => h === p || h.includes(p))
    );
  };

  let cepMinIdx = findHeaderIndex([
    'cep_inicial', 'cep_min', 'cep_de', 'cep_inicio', 'cepinicial', 'cepmin', 'cep_de_min', 
    'faixa_inicio', 'faixa_inicial', 'cep_1', 'de_cep', 'de', 'inicio', 'inicial', 'faixa_de'
  ]);

  let cepMaxIdx = findHeaderIndex([
    'cep_final', 'cep_max', 'cep_ate', 'cep_fim', 'cepfinal', 'cepmax', 'cep_ate_max', 
    'faixa_fim', 'faixa_final', 'cep_2', 'ate_cep', 'ate', 'fim', 'final', 'para', 'faixa_ate'
  ]);

  let valueIdx = findHeaderIndex([
    'valor_entrega', 'valor_frete', 'frete_cliente', 'preco_entrega', 'valor_r', 'valor', 
    'frete', 'preco', 'tarifa', 'taxa', 'custo', 'vlr_frete', 'vlr_entrega', 'valor_da_entrega'
  ]);

  const repasseIdx = findHeaderIndex([
    'valor_repasse', 'repasse_condutor', 'repasse_motorista', 'repasse', 'valor_condutor', 
    'ganho_entregador', 'taxa_condutor', 'motorista', 'vlr_repasse'
  ]);

  const prioridadeIdx = findHeaderIndex([
    'valor_prioridade', 'prioridade', 'taxa_expressa', 'expresso', 'urgente', 'tarifa_expressa', 
    'valor_express', 'adicional'
  ]);

  const regiaoIdx = findHeaderIndex([
    'regiao', 'zona', 'bairro', 'cidade', 'descricao', 'nome_faixa', 'area', 'setor', 'localidade'
  ]);

  const prazoIdx = findHeaderIndex([
    'prazo_dias', 'prazo', 'dias', 'sla', 'prazo_entrega', 'tempo_dias', 'tempo'
  ]);

  const pesoIdx = findHeaderIndex([
    'peso_maximo', 'peso_max', 'peso_kg', 'peso', 'limite_peso'
  ]);

  const obsIdx = findHeaderIndex([
    'observacao', 'observacoes', 'obs', 'detalhes', 'nota'
  ]);

  // Fallback if headers were not matched by keywords: analyze first data rows
  if (cepMinIdx === -1 && cepMaxIdx === -1 && data.length > startDataRow) {
    const sampleRow = data[startDataRow] || [];
    for (let c = 0; c < sampleRow.length; c++) {
      if (isLikeCep(sampleRow[c])) {
        if (cepMinIdx === -1) {
          cepMinIdx = c;
        } else if (cepMaxIdx === -1) {
          cepMaxIdx = c;
        }
      }
    }
    if (valueIdx === -1) {
      for (let c = 0; c < sampleRow.length; c++) {
        if (c !== cepMinIdx && c !== cepMaxIdx && typeof sampleRow[c] === 'number') {
          valueIdx = c;
          break;
        }
      }
    }
  }

  const rows: ParsedFreightRow[] = [];
  let validCount = 0;
  let warningCount = 0;
  let errorCount = 0;

  for (let i = startDataRow; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length === 0 || row.every(cell => cell === null || cell === undefined || String(cell).trim() === '')) {
      continue; // Skip empty rows
    }

    const rawCepMin = cepMinIdx >= 0 ? row[cepMinIdx] : (row[0] || '');
    const rawCepMax = cepMaxIdx >= 0 ? row[cepMaxIdx] : (row[1] || '');
    const rawVal = valueIdx >= 0 ? row[valueIdx] : (row[2] || 0);
    const rawRepasse = repasseIdx >= 0 ? row[repasseIdx] : (row[3] !== undefined ? row[3] : undefined);
    const rawPrioridade = prioridadeIdx >= 0 ? row[prioridadeIdx] : (row[4] !== undefined ? row[4] : undefined);
    const rawRegiao = regiaoIdx >= 0 ? row[regiaoIdx] : (row[5] || '');
    const rawPrazo = prazoIdx >= 0 ? row[prazoIdx] : (row[6] || 1);
    const rawPeso = pesoIdx >= 0 ? row[pesoIdx] : undefined;
    const rawObs = obsIdx >= 0 ? row[obsIdx] : '';

    let cleanMin = cleanCep(rawCepMin);
    let cleanMax = cleanCep(rawCepMax);
    const value = parseCurrencyValue(rawVal);
    const valorRepasse = rawRepasse !== undefined && rawRepasse !== '' ? parseCurrencyValue(rawRepasse) : undefined;
    const prioridade = rawPrioridade !== undefined && rawPrioridade !== '' ? parseCurrencyValue(rawPrioridade) : undefined;
    const regiao = String(rawRegiao || '').trim() || undefined;
    const prazoDias = rawPrazo ? parseInt(String(rawPrazo).replace(/\D/g, ''), 10) || 1 : 1;
    const pesoMaximo = rawPeso ? parseFloat(String(rawPeso).replace(',', '.')) || undefined : undefined;
    const observacao = String(rawObs || '').trim() || undefined;

    let isValid = true;
    let error: string | undefined;
    let warning: string | undefined;

    if (!cleanMin || cleanMin.length !== 8) {
      isValid = false;
      error = `CEP Inicial inválido (${rawCepMin || 'vazio'})`;
    } else if (!cleanMax || cleanMax.length !== 8) {
      isValid = false;
      error = `CEP Final inválido (${rawCepMax || 'vazio'})`;
    } else {
      let minNum = parseInt(cleanMin, 10);
      let maxNum = parseInt(cleanMax, 10);

      // Auto-invert if user inverted start/end CEPs
      if (minNum > maxNum) {
        const temp = cleanMin;
        cleanMin = cleanMax;
        cleanMax = temp;
        warning = `Faixa de CEP invertida detectada e auto-ajustada: ${formatCep(cleanMin)} até ${formatCep(cleanMax)}`;
      }
    }

    if (isValid && value <= 0) {
      warning = (warning ? `${warning} • ` : '') + 'Valor do frete está zerado ou nulo';
    }

    if (isValid) {
      validCount++;
      if (warning) warningCount++;
    } else {
      errorCount++;
    }

    rows.push({
      index: i,
      cepMin: cleanMin,
      cepMax: cleanMax,
      cepMinFormatted: formatCep(cleanMin),
      cepMaxFormatted: formatCep(cleanMax),
      value,
      valorRepasse,
      prioridade,
      regiao,
      prazoDias,
      pesoMaximo,
      observacao,
      isValid,
      warning,
      error
    });
  }

  return {
    rules: rows,
    validCount,
    warningCount,
    errorCount,
    totalRows: rows.length,
    headersFound: rawHeaders
  };
};

export const downloadFreightTemplateXLSX = (partnerName?: string) => {
  const sampleData = [
    {
      'CEP Inicial': '01000-000',
      'CEP Final': '01999-999',
      'Valor Frete (R$)': 18.50,
      'Valor Repasse Condutor (R$)': 12.00,
      'Valor Prioridade / Expresso (R$)': 24.00,
      'Região / Bairro': 'Centro-Paulista',
      'Prazo (Dias)': 1,
      'Peso Máximo (kg)': 10,
      'Observação': 'Centro, Sé, República, Bela Vista'
    },
    {
      'CEP Inicial': '02000-000',
      'CEP Final': '02999-999',
      'Valor Frete (R$)': 23.50,
      'Valor Repasse Condutor (R$)': 16.00,
      'Valor Prioridade / Expresso (R$)': 31.00,
      'Região / Bairro': 'Zona Norte',
      'Prazo (Dias)': 1,
      'Peso Máximo (kg)': 10,
      'Observação': 'Santana, Tucuruvi, Casa Verde'
    },
    {
      'CEP Inicial': '03000-000',
      'CEP Final': '03999-999',
      'Valor Frete (R$)': 25.00,
      'Valor Repasse Condutor (R$)': 17.50,
      'Valor Prioridade / Expresso (R$)': 33.00,
      'Região / Bairro': 'Zona Leste',
      'Prazo (Dias)': 2,
      'Peso Máximo (kg)': 10,
      'Observação': 'Tatuapé, Mooca, Penha, Itaquera'
    },
    {
      'CEP Inicial': '04000-000',
      'CEP Final': '04999-999',
      'Valor Frete (R$)': 22.00,
      'Valor Repasse Condutor (R$)': 15.00,
      'Valor Prioridade / Expresso (R$)': 29.50,
      'Região / Bairro': 'Zona Sul',
      'Prazo (Dias)': 1,
      'Peso Máximo (kg)': 10,
      'Observação': 'Vila Mariana, Moema, Santo Amaro'
    },
    {
      'CEP Inicial': '05000-000',
      'CEP Final': '05999-999',
      'Valor Frete (R$)': 20.00,
      'Valor Repasse Condutor (R$)': 13.50,
      'Valor Prioridade / Expresso (R$)': 27.00,
      'Região / Bairro': 'Zona Oeste',
      'Prazo (Dias)': 1,
      'Peso Máximo (kg)': 10,
      'Observação': 'Pinheiros, Perdizes, Lapa, Butantã'
    },
    {
      'CEP Inicial': '06000-000',
      'CEP Final': '06999-999',
      'Valor Frete (R$)': 28.00,
      'Valor Repasse Condutor (R$)': 19.00,
      'Valor Prioridade / Expresso (R$)': 36.00,
      'Região / Bairro': 'Grande SP Oeste',
      'Prazo (Dias)': 2,
      'Peso Máximo (kg)': 10,
      'Observação': 'Osasco, Barueri, Carapicuíba'
    },
    {
      'CEP Inicial': '07000-000',
      'CEP Final': '07999-999',
      'Valor Frete (R$)': 30.00,
      'Valor Repasse Condutor (R$)': 20.50,
      'Valor Prioridade / Expresso (R$)': 38.00,
      'Região / Bairro': 'Grande SP Norte',
      'Prazo (Dias)': 2,
      'Peso Máximo (kg)': 10,
      'Observação': 'Guarulhos, Mairiporã, Arujá'
    },
    {
      'CEP Inicial': '09000-000',
      'CEP Final': '09999-999',
      'Valor Frete (R$)': 27.50,
      'Valor Repasse Condutor (R$)': 18.50,
      'Valor Prioridade / Expresso (R$)': 35.00,
      'Região / Bairro': 'Grande SP ABC',
      'Prazo (Dias)': 2,
      'Peso Máximo (kg)': 10,
      'Observação': 'Santo André, São Bernardo, São Caetano, Diadema'
    }
  ];

  const ws = XLSX.utils.json_to_sheet(sampleData);

  // Set column widths for polished presentation
  ws['!cols'] = [
    { wch: 14 }, // CEP Inicial
    { wch: 14 }, // CEP Final
    { wch: 16 }, // Valor Frete
    { wch: 28 }, // Valor Repasse Condutor
    { wch: 32 }, // Valor Prioridade / Expresso
    { wch: 20 }, // Regiao
    { wch: 14 }, // Prazo
    { wch: 18 }, // Peso
    { wch: 38 }  // Observação
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Tabela de Frete');

  const safePartner = partnerName ? `_${partnerName.replace(/[^a-zA-Z0-9]/g, '_')}` : '';
  const fileName = `Modelo_Tabela_Frete_ViniMap${safePartner}.xlsx`;
  XLSX.writeFile(wb, fileName);
};

export const exportPartnerFreightRulesToXLSX = (
  rules: FreightRule[], 
  partnerClient?: PartnerClient
) => {
  const exportData = rules.map((r, idx) => ({
    'Item': idx + 1,
    'Código Cliente': r.codigoCliente || partnerClient?.codigoCliente || partnerClient?.id || '',
    'Cliente Parceiro': partnerClient?.name || '',
    'CEP Inicial': formatCep(r.cepMin),
    'CEP Final': formatCep(r.cepMax),
    'Valor Frete (R$)': Number(r.value) || 0,
    'Valor Repasse Condutor (R$)': r.valorRepasse !== undefined && r.valorRepasse !== null ? Number(r.valorRepasse) : '',
    'Valor Prioridade / Expresso (R$)': r.prioridade !== undefined && r.prioridade !== null ? Number(r.prioridade) : '',
    'Região / Bairro': r.regiao || '',
    'Prazo (Dias)': r.prazoDias || 1,
    'Peso Máx (kg)': r.pesoMaximo || '',
    'Observação': r.observacao || r.description || '',
    'Última Atualização': r.lastUpdated || ''
  }));

  const ws = XLSX.utils.json_to_sheet(exportData);
  ws['!cols'] = [
    { wch: 6 },
    { wch: 16 },
    { wch: 26 },
    { wch: 14 },
    { wch: 14 },
    { wch: 16 },
    { wch: 28 },
    { wch: 32 },
    { wch: 20 },
    { wch: 14 },
    { wch: 14 },
    { wch: 35 },
    { wch: 20 }
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Tabela Tarifária');

  const partnerTag = partnerClient ? partnerClient.name.replace(/[^a-zA-Z0-9]/g, '_') : 'Todas_Regras';
  const dateStr = new Date().toISOString().slice(0, 10);
  const fileName = `Tabela_Frete_${partnerTag}_${dateStr}.xlsx`;
  XLSX.writeFile(wb, fileName);
};

export const exportPartnerFreightRulesToCSV = (
  rules: FreightRule[], 
  partnerClient?: PartnerClient
) => {
  const headers = [
    'Item',
    'Codigo_Cliente',
    'Cliente_Parceiro',
    'CEP_Inicial',
    'CEP_Final',
    'Valor_Frete',
    'Valor_Repasse_Condutor',
    'Valor_Prioridade_Expresso',
    'Regiao',
    'Prazo_Dias',
    'Peso_Max_Kg',
    'Observacao'
  ];

  const rows = rules.map((r, idx) => [
    idx + 1,
    `"${r.codigoCliente || partnerClient?.codigoCliente || partnerClient?.id || ''}"`,
    `"${partnerClient?.name || ''}"`,
    `"${formatCep(r.cepMin)}"`,
    `"${formatCep(r.cepMax)}"`,
    (Number(r.value) || 0).toFixed(2),
    (Number(r.valorRepasse) || 0).toFixed(2),
    (Number(r.prioridade) || 0).toFixed(2),
    `"${r.regiao || ''}"`,
    r.prazoDias || 1,
    r.pesoMaximo || '',
    `"${(r.observacao || r.description || '').replace(/"/g, '""')}"`
  ]);

  const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(row => row.join(';'))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  const partnerTag = partnerClient ? partnerClient.name.replace(/[^a-zA-Z0-9]/g, '_') : 'Todas_Regras';
  link.setAttribute('download', `Tabela_Frete_${partnerTag}_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const testCepMatchInRules = (
  cep: string, 
  rules: FreightRule[]
): {
  matched: boolean;
  rule?: FreightRule;
  cepFormatted: string;
  message: string;
} => {
  const cleaned = cleanCep(cep);
  if (!cleaned || cleaned.length !== 8) {
    return {
      matched: false,
      cepFormatted: cep,
      message: 'CEP inválido ou incompleto (deve conter 8 dígitos)'
    };
  }

  const cepNum = parseInt(cleaned, 10);
  const formatted = formatCep(cleaned);

  const matchedRule = rules.find(r => {
    const min = parseInt(cleanCep(r.cepMin), 10);
    const max = parseInt(cleanCep(r.cepMax), 10);
    if (isNaN(min) || isNaN(max)) return false;
    return cepNum >= min && cepNum <= max;
  });

  if (matchedRule) {
    return {
      matched: true,
      rule: matchedRule,
      cepFormatted: formatted,
      message: `Faixa de CEP localizada: ${formatCep(matchedRule.cepMin)} até ${formatCep(matchedRule.cepMax)} (${matchedRule.regiao || 'Geral'})`
    };
  }

  return {
    matched: false,
    cepFormatted: formatted,
    message: `Nenhuma faixa cadastrada abrange o CEP ${formatted}`
  };
};
