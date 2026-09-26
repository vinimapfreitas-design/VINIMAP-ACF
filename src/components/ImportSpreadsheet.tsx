import React, { useState, useMemo, useRef } from 'react';
import { 
  FileSpreadsheet, 
  AlertTriangle, 
  CheckCircle, 
  Search,
  Layers,
  UploadCloud,
  Trash2,
  AlertCircle,
  XCircle,
  Info,
  RefreshCw,
  X
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Order, PartnerClient, matchClientCode } from '../types';
import { formatToBrasiliaDate, formatToBrasiliaISODate, formatToBrasiliaTime, getBrasiliaDate } from '../utils/dateUtils';
import { formatCep, cleanCepDigits, extractCepFromAddress } from '../utils/cepUtils';

interface ImportSpreadsheetProps {
  orders: Order[];
  partnerClients: PartnerClient[];
  freightRules?: any[];
  onImportOrders: (newOrders: Order[]) => Promise<void> | void;
}

// Robust date parser supporting YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY with smart auto-detection, and time zones
const robustParseToISODate = (str: string): string => {
  if (!str) return '';
  let trimmed = str.trim();
  
  if (trimmed.includes('T')) {
    trimmed = trimmed.split('T')[0].trim();
  } else {
    trimmed = trimmed.split(/\s+/)[0].trim();
  }
  
  // If YYYY-MM-DD
  if (trimmed.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return trimmed.slice(0, 10);
  }
  
  // If DD/MM/YYYY or MM/DD/YYYY
  if (trimmed.includes('/')) {
    const parts = trimmed.split('/');
    if (parts.length === 3) {
      const p0 = parseInt(parts[0], 10);
      const p1 = parseInt(parts[1], 10);
      
      let dayStr = parts[0].trim();
      let monthStr = parts[1].trim();
      let yearStr = parts[2].trim();
      
      if (yearStr.length === 2) {
        yearStr = `20${yearStr}`;
      }
      
      // Smart detection of American MM/DD/YYYY vs Brazilian DD/MM/YYYY format
      // If the second part (middle) is greater than 12, it is definitely a day (making it MM/DD/YYYY)
      if (p1 > 12) {
        dayStr = parts[1].trim();
        monthStr = parts[0].trim();
      } 
      // If the first part is greater than 12, it is definitely a day (making it DD/MM/YYYY)
      else if (p0 > 12) {
        dayStr = parts[0].trim();
        monthStr = parts[1].trim();
      }
      // If both are <= 12, we default to Brazilian DD/MM/YYYY since it is a Brazilian App.
      
      const day = dayStr.padStart(2, '0');
      const month = monthStr.padStart(2, '0');
      
      return `${yearStr}-${month}-${day}`;
    }
  }
  
  // If DD-MM-YYYY
  if (trimmed.includes('-')) {
    const parts = trimmed.split('-');
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
      } else if (parts[2].length === 4) {
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }
  }
  
  return trimmed;
};

export default function ImportSpreadsheet({ 
  orders, 
  partnerClients,
  freightRules,
  onImportOrders 
}: ImportSpreadsheetProps) {
  const [fileContent, setFileContent] = useState('');
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>('');
  const [inputTab, setInputTab] = useState<'upload' | 'paste'>('upload');
  const [pastedText, setPastedText] = useState<string>('');
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState<string | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [logs, setLogs] = useState<{ type: 'success' | 'error' | 'warning'; msg: string }[]>([]);
  const [importStats, setImportStats] = useState<{ total: number; success: number; failed: number } | null>(null);
  const [searchPreview, setSearchPreview] = useState('');
  const [importSuccessToast, setImportSuccessToast] = useState<{ show: boolean; message: string } | null>(null);

  // Sincronização Progress Bar & Diagnostics states
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [diagnosticFilter, setDiagnosticFilter] = useState<'all' | 'errors' | 'warnings'>('all');
  const [diagnosticSearch, setDiagnosticSearch] = useState('');

  // Column reordering & sorting states for preview
  const [columnOrder, setColumnOrder] = useState<string[]>(['linha', 'pedido', 'cliente', 'destinatario', 'cep', 'valor', 'status']);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState<boolean>(true);
  const [draggedCol, setDraggedCol] = useState<string | null>(null);

  const colDetails: Record<string, { label: string; minW: string }> = {
    linha: { label: 'Linha', minW: 'w-16' },
    pedido: { label: 'Pedido ID', minW: 'w-24' },
    cliente: { label: 'Cliente', minW: 'w-24' },
    destinatario: { label: 'Destinatário', minW: 'w-36' },
    cep: { label: 'CEP', minW: 'w-20' },
    valor: { label: 'Valor', minW: 'w-20' },
    status: { label: 'Status', minW: 'w-24' }
  };

  const handleDragStart = (e: React.DragEvent, colId: string) => {
    setDraggedCol(colId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, colId: string) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetColId: string) => {
    e.preventDefault();
    if (!draggedCol || draggedCol === targetColId) return;

    const newOrder = [...columnOrder];
    const draggedIdx = newOrder.indexOf(draggedCol);
    const targetIdx = newOrder.indexOf(targetColId);

    if (draggedIdx !== -1 && targetIdx !== -1) {
      newOrder[draggedIdx] = targetColId;
      newOrder[targetIdx] = draggedCol;
      setColumnOrder(newOrder);
    }
    setDraggedCol(null);
  };

  const handleSortClick = (field: string) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Synchronized to current actual date dynamically in Brasília timezone
  const getTodayISO = (): string => {
    return formatToBrasiliaISODate(new Date());
  };

  const getTodayStrSP = (): string => {
    return formatToBrasiliaDate(new Date());
  };

  const todayStrSP = getTodayStrSP();
  const todayISO = getTodayISO();

  const expectedHeaders = [
    'CodigoCliente', 'DataSolicitacao', 'Pedido', 'ProcurarPor', 
    'Endereco', 'CEP', 'Telefone', 'Detalhe', 'Email', 
    'Complemento', 'DispositivoCondutor', 'HorarioFinal', 'DocumentoEmpresa', 'TipoEntrega', 
    'Chamado', 'DANFE', 'DataLimite', 'NomeFantasia', 'HorarioInicio', 
    'DataAgendamento', 'CidadeMunicipio', 'Estado', 'ValorNotaFiscal', 'ValorReceber', 
    'ValorEntrega', 'Latitude', 'Longitude', 'DestinatarioCnpjCpf', 'ValorCondutor'
  ];

  const mandatoryKeys = ['CodigoCliente', 'DataSolicitacao', 'ProcurarPor', 'Endereco', 'CEP'];

  const downloadExcelTemplate = () => {
    const sampleRow = {
      CodigoCliente: 'CLI-001',
      DataSolicitacao: todayStrSP,
      Pedido: 'PED-9081',
      ProcurarPor: 'John Doe Ltda',
      Endereco: 'Av. Paulista, 1000',
      CEP: '01311-100',
      Telefone: '(11) 98765-4301',
      Detalhe: 'Entregar para a recepção no 5º andar',
      Email: 'financeiro@johndoelta.com',
      Complemento: 'Conjunto 51',
      DispositivoCondutor: 'Sim',
      HorarioFinal: '18:00',
      DocumentoEmpresa: '71.503.953/0001-15',
      TipoEntrega: 'Rápida',
      Chamado: 'CH-2023',
      DANFE: '123456',
      DataLimite: todayStrSP,
      NomeFantasia: 'John Doe',
      HorarioInicio: '08:00',
      DataAgendamento: todayStrSP,
      CidadeMunicipio: 'São Paulo',
      Estado: 'SP',
      ValorNotaFiscal: '150.00',
      ValorReceber: '0.00',
      ValorEntrega: '15.00',
      Latitude: '-23.5615',
      Longitude: '-46.6562',
      DestinatarioCnpjCpf: '12.345.678/0001-99',
      ValorCondutor: '10.00'
    };

    const worksheet = XLSX.utils.json_to_sheet([sampleRow], { header: expectedHeaders });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Planilha Padrão');

    // Auto-fit column widths
    const maxLens = expectedHeaders.map(h => Math.max(h.length, 12));
    worksheet['!cols'] = maxLens.map(len => ({ wch: len + 3 }));

    XLSX.writeFile(workbook, 'modelo_planilha_30_colunas.xlsx');
  };

  // RFC-4180 compliant line splitter that preserves multiline cells inside quotes
  const splitCSVLines = (raw: string): string[] => {
    if (!raw) return [];
    const lines: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < raw.length; i++) {
      const char = raw[i];
      if (char === '"') {
        inQuotes = !inQuotes;
        current += char;
      } else if ((char === '\n' || (char === '\r' && raw[i + 1] !== '\n')) && !inQuotes) {
        if (current.trim()) {
          lines.push(current);
        }
        current = '';
      } else if (char === '\r' && raw[i + 1] === '\n' && !inQuotes) {
        i++; // Skip \n
        if (current.trim()) {
          lines.push(current);
        }
        current = '';
      } else {
        current += char;
      }
    }
    if (current.trim()) {
      lines.push(current);
    }
    return lines;
  };

  // Smart CSV line parser that respects RFC-4180
  const parseCSVLine = (line: string, delimiter: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  // Auto detect separator based on headers
  const detectDelimiter = (headerLine: string): string => {
    const commas = (headerLine.match(/,/g) || []).length;
    const semicolons = (headerLine.match(/;/g) || []).length;
    const tabs = (headerLine.match(/\t/g) || []).length;
    
    if (tabs > semicolons && tabs > commas) return '\t';
    if (semicolons > commas) return ';';
    return ',';
  };

  // Convert text contents into rows and run validations
  const processRawDataRepresentation = (rawData: string): {
    headerMatched: Record<string, number>;
    rows: any[];
    missingMandatory: string[];
  } => {
    const lines = splitCSVLines(rawData);
    if (lines.length === 0 || !lines[0]) {
      return { headerMatched: {}, rows: [], missingMandatory: mandatoryKeys };
    }

    const firstLine = lines[0];
    const delimiter = detectDelimiter(firstLine);
    
    const headerCols = parseCSVLine(firstLine, delimiter).map(h => 
      h.trim().replace(/['"^*]/g, '')
    );

    const colIndices: Record<string, number> = {};
    
    // Header Normalizer to bypass accents/spaces/case issues
    const normalizeHeader = (str: string): string => {
      return str
        .toLowerCase()
        .normalize('NFD')                     // Splits accents
        .replace(/[\u0300-\u036f]/g, '')     // Strips accents
        .replace(/[^a-z0-9]/g, '');          // Alphanumeric only
    };

    const normalizedHeaderCols = headerCols.map(normalizeHeader);

    const aliases: Record<string, string[]> = {
      CodigoCliente: ['codigocliente', 'codcliente', 'clientecodigo', 'idcliente', 'clienteid', 'codigodocliente', 'cliente_codigo', 'codigo_cliente', 'colaborador_codigo', 'parceiro', 'cliente', 'empresa', 'codparceiro'],
      DataSolicitacao: ['datasolicitacao', 'datasolicita', 'data', 'datasolicitado', 'datadasolicitacao', 'datasolicitacao_dia', 'datasolicitacao_data', 'datapedido', 'datadopedido', 'datacriacao', 'criadoem', 'dataentrega', 'dataemissao', 'date'],
      Pedido: ['pedido', 'pedidoid', 'idpedido', 'codigopedido', 'numpedido', 'numeropedido', 'numero', 'os', 'ordem', 'ordemdeservico', 'rastreio', 'remessa', 'tracking', 'orderid', 'order', 'venda', 'numped', 'referencia'],
      ProcurarPor: ['procurarpor', 'destinatario', 'nome', 'nomedestinatario', 'cliente', 'procurar', 'destinatario_nome', 'recebedor', 'destinatariorazao', 'nomerecebedor', 'nomecliente', 'nomedocliente', 'nomecompleto', 'contato', 'recipient'],
      Endereco: ['endereco', 'logradouro', 'rua', 'local', 'enderecodeentrega', 'entrega', 'enderecodestinatario', 'localdeentrega', 'localentrega', 'morada', 'destinationaddress', 'enderecocompleto', 'ruaavenida', 'address'],
      CEP: ['cep', 'postalcode', 'codigopostal', 'cepdestinatario', 'cependereco', 'cepdeentrega', 'cepentrega', 'ceplocal', 'cepdestino', 'ceprecebedor', 'cepresidencial', 'cepcomercial', 'codpostal', 'zipcode', 'zip', 'postcode', 'cepcliente', 'cepdocliente'],
      Telefone: ['telefone', 'celular', 'tel', 'fone', 'contato', 'whatsapp', 'phone', 'telefonedestinatario'],
      Detalhe: ['detalhe', 'detalhes', 'obs', 'observacao', 'observacoes', 'nota', 'instrucoes', 'notas'],
      Email: ['email', 'correioeletronico', 'e-mail'],
      Complemento: ['complemento', 'comp', 'apto', 'bloco'],
      DispositivoCondutor: ['dispositivocondutor', 'entregador', 'condutor', 'motorista', 'courier'],
      HorarioFinal: ['horariofinal', 'horafinal', 'limitehora'],
      DocumentoEmpresa: ['documentoempresa', 'cnpj', 'empresa_documento'],
      TipoEntrega: ['tipoentrega', 'tipo'],
      Chamado: ['chamado', 'ticket'],
      DANFE: ['danfe', 'notafiscal', 'nf', 'nfe'],
      DataLimite: ['datalimite', 'prazolimite'],
      NomeFantasia: ['nomefantasia', 'fantasia'],
      HorarioInicio: ['horarioinicio', 'horainicio', 'horario'],
      DataAgendamento: ['dataagendamento', 'agendamento'],
      CidadeMunicipio: ['cidademunicipio', 'cidade', 'municipio'],
      Estado: ['estado', 'uf'],
      ValorNotaFiscal: ['valornotafiscal', 'valornf', 'valor_nf', 'valor_nota', 'nf_valor'],
      ValorReceber: ['valorreceber', 'areceber', 'valor_a_receber'],
      ValorEntrega: ['valorentrega', 'valor', 'total', 'frete', 'valorentregador'],
      Latitude: ['latitude', 'lat'],
      Longitude: ['longitude', 'long', 'lng'],
      DestinatarioCnpjCpf: ['destinatariocnpjcpf', 'cpf', 'cnpj_destinatario', 'documentodeentrega', 'documentorecebedor'],
      ValorCondutor: ['valorcondutor', 'pagamento_condutor', 'repasse']
    };

    expectedHeaders.forEach(expected => {
      // 1. Try direct exact match of normalized header name
      let idx = normalizedHeaderCols.indexOf(normalizeHeader(expected));
      
      // 2. Try alias map matching
      if (idx === -1 && aliases[expected]) {
        for (const alias of aliases[expected]) {
          const aliasNorm = normalizeHeader(alias);
          idx = normalizedHeaderCols.indexOf(aliasNorm);
          if (idx !== -1) break;
        }
      }
      
      colIndices[expected] = idx;
    });

    // Detect if first line is actual data rather than headers (e.g. starts with date)
    const isFirstLineData = headerCols.some(col => 
      /^\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}/.test(col) || 
      /^\d{4}-\d{2}-\d{2}/.test(col)
    );

    let startLine = 1;
    if (isFirstLineData) {
      startLine = 0;
      // Positional fallbacks for standard columns: [Data, Pedido, Destinatario, Endereco, CEP]
      if (colIndices.DataSolicitacao === -1) colIndices.DataSolicitacao = 0;
      if (colIndices.Pedido === -1) colIndices.Pedido = 1;
      if (colIndices.ProcurarPor === -1) colIndices.ProcurarPor = 2;
      if (colIndices.Endereco === -1) colIndices.Endereco = 3;
      if (colIndices.CEP === -1 && headerCols.length >= 5) colIndices.CEP = 4;
    }

    const defaultPartnerCode = selectedPartnerId || (partnerClients.length === 1 ? partnerClients[0].id : '') || 'GERAL';

    const missing = mandatoryKeys.filter(key => {
      // DataSolicitacao is never strictly required because we overwrite it with the actual import date and time
      if (key === 'DataSolicitacao') {
        return false;
      }
      // CodigoCliente has partner fallback
      if (key === 'CodigoCliente' && (selectedPartnerId || partnerClients.length > 0)) {
        return false;
      }
      return colIndices[key] === undefined || colIndices[key] === -1;
    });

    const rows: any[] = [];

    const parseToISODateLocal = (str: string): string => {
      return robustParseToISODate(str);
    };

    for (let i = startLine; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const rowCols = parseCSVLine(line, delimiter);
      
      // Ignore lines that are empty or contain only delimiters (e.g. ";;;;;")
      const hasAnyContent = rowCols.some(col => col.trim() !== '');
      if (!hasAnyContent) continue;
      
      const getValue = (key: string): string => {
        const idx = colIndices[key];
        if (idx !== undefined && idx !== -1 && idx < rowCols.length) {
          return rowCols[idx].trim().replace(/^"|"$/g, '');
        }
        return '';
      };

      const rawEndereco = getValue('Endereco');
      const cleanEndereco = (rawEndereco || '')
        .replace(/[\r\n]+/g, ', ')
        .replace(/\s{2,}/g, ' ')
        .trim()
        .replace(/^,\s*|,\s*$/g, '');

      let rawCep = getValue('CEP');
      let finalCep = '';
      const digits = cleanCepDigits(rawCep);
      if (digits && digits.length === 8) {
        finalCep = formatCep(digits);
      } else {
        const extracted = extractCepFromAddress(cleanEndereco) || 
                          extractCepFromAddress(getValue('Complemento')) || 
                          extractCepFromAddress(getValue('Detalhe'));
        if (extracted) {
          finalCep = extracted.formattedCep;
        } else if (digits) {
          finalCep = formatCep(digits);
        }
      }

      const rowValues = {
        CodigoCliente: getValue('CodigoCliente') || defaultPartnerCode,
        DataSolicitacao: getValue('DataSolicitacao'),
        Pedido: getValue('Pedido'),
        ProcurarPor: getValue('ProcurarPor'),
        Endereco: cleanEndereco,
        CEP: finalCep,
        Telefone: getValue('Telefone'),
        Detalhe: getValue('Detalhe'),
        Email: getValue('Email'),
        Complemento: getValue('Complemento'),
        DispositivoCondutor: getValue('DispositivoCondutor'),
        HorarioFinal: getValue('HorarioFinal'),
        DocumentoEmpresa: getValue('DocumentoEmpresa'),
        TipoEntrega: getValue('TipoEntrega'),
        Chamado: getValue('Chamado'),
        DANFE: getValue('DANFE'),
        DataLimite: getValue('DataLimite'),
        NomeFantasia: getValue('NomeFantasia'),
        HorarioInicio: getValue('HorarioInicio'),
        DataAgendamento: getValue('DataAgendamento'),
        CidadeMunicipio: getValue('CidadeMunicipio'),
        Estado: getValue('Estado'),
        ValorNotaFiscal: getValue('ValorNotaFiscal'),
        ValorReceber: getValue('ValorReceber'),
        ValorEntrega: getValue('ValorEntrega'),
        Latitude: getValue('Latitude'),
        Longitude: getValue('Longitude'),
        DestinatarioCnpjCpf: getValue('DestinatarioCnpjCpf'),
        ValorCondutor: getValue('ValorCondutor')
      };

      // Skip if all expected fields are completely empty (e.g. whitespace row or empty row)
      const allFieldsEmpty = Object.values(rowValues).every(v => !v || v.trim() === '');
      if (allFieldsEmpty) continue;

      const codCliente = rowValues.CodigoCliente;
      const dataSolicitacao = rowValues.DataSolicitacao;
      const procurarPor = rowValues.ProcurarPor;
      const endereco = rowValues.Endereco;
      const cep = rowValues.CEP;

      // Ignore empty/unfilled template rows below silently (e.g. dragged down rows with some defaults but no client/delivery details)
      const emptyCoreCount = [!codCliente, !procurarPor, !endereco, !cep].filter(Boolean).length;
      if (emptyCoreCount >= 3) {
        continue;
      }

      // 1. Mandatory Fields rule (todas as linhas com estrutura mínima entram para o preview e diagnóstico)
      if (!codCliente && !procurarPor && !endereco && !cep) {
        continue;
      }

      // 2. active duplicates rule
      const pedidoStr = rowValues.Pedido || `PED-IMPORT-${i + 1}-${Date.now().toString().slice(-4)}`;
      const targetId = (codCliente && pedidoStr && !pedidoStr.toLowerCase().startsWith(codCliente.toLowerCase()))
        ? `${codCliente}-${pedidoStr}`
        : pedidoStr;

      const existingOrder = orders.find(o => 
        o.id === targetId || 
        (o.id === pedidoStr && matchClientCode(o.codigoCliente, codCliente)) || 
        (o.pedido === pedidoStr && matchClientCode(o.codigoCliente, codCliente))
      );
      if (existingOrder && existingOrder.status !== 'cancelled') {
        continue;
      }

      rows.push({
        lineNum: i + 1,
        rawLine: line,
        values: {
          ...rowValues,
          DataSolicitacao: dataSolicitacao
        }
      });
    }

    return {
      headerMatched: colIndices,
      rows,
      missingMandatory: missing
    };
  };

  const currentAnalysis = useMemo(() => {
    return processRawDataRepresentation(fileContent);
  }, [fileContent, selectedPartnerId]);

  const fileDiagnostics = useMemo(() => {
    if (!fileContent.trim()) return { errors: [], warnings: [], isValid: true, totalCount: 0 };

    const errors: Array<{ rowNum?: number; field?: string; title: string; message: string; code: string; recommendation: string }> = [];
    const warnings: Array<{ rowNum?: number; field?: string; title: string; message: string; code: string; recommendation: string }> = [];

    const lines = splitCSVLines(fileContent);
    if (lines.length === 0) {
      errors.push({
        title: 'Planilha sem dados',
        message: 'O arquivo importado não contém linhas de dados utilizáveis.',
        code: 'EMPTY_FILE',
        recommendation: 'Verifique se o arquivo não está vazio ou corrompido.'
      });
      return { errors, warnings, isValid: false, totalCount: 1 };
    }

    const firstLine = lines[0];
    const delimiter = detectDelimiter(firstLine);
    const headerCols = parseCSVLine(firstLine, delimiter).map(h => 
      h.trim().replace(/['"^*]/g, '')
    );

    const normalizeHeader = (str: string): string => {
      return str
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '');
    };

    const normalizedHeaderCols = headerCols.map(normalizeHeader);

    // Map each expected header
    const colIndices: Record<string, number> = {};
    const aliases: Record<string, string[]> = {
      CodigoCliente: ['codigocliente', 'codcliente', 'clientecodigo', 'idcliente', 'clienteid', 'codigodocliente', 'cliente_codigo', 'codigo_cliente', 'colaborador_codigo'],
      DataSolicitacao: ['datasolicitacao', 'datasolicita', 'data', 'datasolicitado', 'datadasolicitacao', 'datasolicitacao_dia', 'datasolicitacao_data'],
      Pedido: ['pedido', 'pedidoid', 'idpedido', 'codigopedido', 'numpedido', 'numeropedido'],
      ProcurarPor: ['procurarpor', 'destinatario', 'nome', 'nomedestinatario', 'cliente', 'procurar', 'destinatario_nome'],
      Endereco: ['endereco', 'logradouro', 'rua', 'local', 'enderecodeentrega'],
      CEP: ['cep', 'postalcode', 'codigopostal'],
      Telefone: ['telefone', 'celular', 'tel', 'fone', 'contato'],
      Detalhe: ['detalhe', 'detalhes', 'obs', 'observacao', 'observacoes'],
      Email: ['email', 'correioeletronico'],
      Complemento: ['complemento', 'comp'],
      DispositivoCondutor: ['dispositivocondutor', 'entregador', 'condutor', 'motorista', 'courier'],
      HorarioFinal: ['horariofinal', 'horafinal', 'limitehora'],
      DocumentoEmpresa: ['documentoempresa', 'cnpj', 'empresa_documento'],
      TipoEntrega: ['tipoentrega', 'tipo'],
      Chamado: ['chamado', 'ticket'],
      DANFE: ['danfe', 'notafiscal', 'nf', 'nfe'],
      DataLimite: ['datalimite', 'prazolimite'],
      NomeFantasia: ['nomefantasia', 'fantasia'],
      HorarioInicio: ['horarioinicio', 'horainicio', 'horario'],
      DataAgendamento: ['dataagendamento', 'agendamento'],
      CidadeMunicipio: ['cidademunicipio', 'cidade', 'municipio'],
      Estado: ['estado', 'uf'],
      ValorNotaFiscal: ['valornotafiscal', 'valornf', 'valor_nf', 'valor_nota', 'nf_valor'],
      ValorReceber: ['valorreceber', 'areceber', 'valor_a_receber'],
      ValorEntrega: ['valorentrega', 'valor', 'total', 'frete', 'valorentregador'],
      Latitude: ['latitude', 'lat'],
      Longitude: ['longitude', 'long', 'lng'],
      DestinatarioCnpjCpf: ['destinatariocnpjcpf', 'cpf', 'cnpj_destinatario', 'documentodeentrega', 'documentorecebedor'],
      ValorCondutor: ['valorcondutor', 'pagamento_condutor', 'repasse']
    };

    expectedHeaders.forEach(expected => {
      let idx = normalizedHeaderCols.indexOf(normalizeHeader(expected));
      if (idx === -1 && aliases[expected]) {
        for (const alias of aliases[expected]) {
          const aliasNorm = normalizeHeader(alias);
          idx = normalizedHeaderCols.indexOf(aliasNorm);
          if (idx !== -1) break;
        }
      }
      colIndices[expected] = idx;
    });

    const isFirstLineData = headerCols.some(col => 
      /^\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}/.test(col) || 
      /^\d{4}-\d{2}-\d{2}/.test(col)
    );

    let startLine = 1;
    if (isFirstLineData) {
      startLine = 0;
      if (colIndices.DataSolicitacao === -1) colIndices.DataSolicitacao = 0;
      if (colIndices.Pedido === -1) colIndices.Pedido = 1;
      if (colIndices.ProcurarPor === -1) colIndices.ProcurarPor = 2;
      if (colIndices.Endereco === -1) colIndices.Endereco = 3;
      if (colIndices.CEP === -1 && headerCols.length >= 5) colIndices.CEP = 4;
    }

    // Check missing mandatory headers
    const missingKeysForDiagnostic = mandatoryKeys.filter(key => {
      if (key === 'DataSolicitacao') return false;
      if (key === 'CodigoCliente' && (selectedPartnerId || partnerClients.length > 0)) return false;
      return colIndices[key] === undefined || colIndices[key] === -1;
    });

    if (missingKeysForDiagnostic.length > 0) {
      errors.push({
        title: 'Cabeçalhos Obrigatórios Ausentes',
        message: `As seguintes colunas fundamentais não foram encontradas na planilha: [${missingKeysForDiagnostic.join(', ')}].`,
        code: 'MISSING_HEADERS',
        recommendation: 'Renomeie as colunas da sua planilha para conter esses nomes ou sinônimos reconhecidos.'
      });
    }

    const defaultPartnerCode = selectedPartnerId || (partnerClients.length === 1 ? partnerClients[0].id : '') || 'GERAL';
    const parsedOrdersInPreFile = new Set<string>();

    for (let i = startLine; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const rowCols = parseCSVLine(line, delimiter);
      const hasAnyContent = rowCols.some(col => col.trim() !== '');
      if (!hasAnyContent) continue;

      const getValue = (key: string): string => {
        const idx = colIndices[key];
        if (idx !== undefined && idx !== -1 && idx < rowCols.length) {
          return rowCols[idx].trim().replace(/^"|"$/g, '');
        }
        return '';
      };

      const rawEndereco = getValue('Endereco');
      const cleanEndereco = (rawEndereco || '')
        .replace(/[\r\n]+/g, ', ')
        .replace(/\s{2,}/g, ' ')
        .trim()
        .replace(/^,\s*|,\s*$/g, '');

      let rawCep = getValue('CEP');
      let finalCep = '';
      const digits = cleanCepDigits(rawCep);
      if (digits && digits.length === 8) {
        finalCep = formatCep(digits);
      } else {
        const extracted = extractCepFromAddress(cleanEndereco) || 
                          extractCepFromAddress(getValue('Complemento')) || 
                          extractCepFromAddress(getValue('Detalhe'));
        if (extracted) {
          finalCep = extracted.formattedCep;
        } else if (digits) {
          finalCep = formatCep(digits);
        }
      }

      // Skip if all expected fields are completely empty (e.g. whitespace row or empty row)
      const expectedValuesForEmptyCheck: Record<string, string> = {};
      expectedHeaders.forEach(key => {
        expectedValuesForEmptyCheck[key] = getValue(key);
      });
      const allFieldsEmpty = Object.values(expectedValuesForEmptyCheck).every(v => !v || v.trim() === '');
      if (allFieldsEmpty) continue;

      const codCliente = getValue('CodigoCliente') || defaultPartnerCode;
      const dataSolicitacao = getValue('DataSolicitacao');
      const procurarPor = getValue('ProcurarPor');
      const endereco = cleanEndereco;
      const cep = finalCep;
      const pedidoStr = getValue('Pedido');

      // Ignore empty/unfilled template rows below silently (e.g. dragged down rows with some defaults but no client/delivery details)
      const emptyCoreCount = [!codCliente, !procurarPor, !endereco, !cep].filter(Boolean).length;
      if (emptyCoreCount >= 3) {
        continue;
      }

      // Check missing row values
      const missingFields: string[] = [];
      if (!codCliente) missingFields.push('CodigoCliente');
      if (!procurarPor) missingFields.push('ProcurarPor');
      if (!endereco) missingFields.push('Endereco');
      if (!cep) missingFields.push('CEP');

      if (missingFields.length > 0) {
        errors.push({
          rowNum: i + 1,
          title: `Campos Vazios (Linha ${i + 1})`,
          message: `Campos obrigatórios ausentes nesta linha: [${missingFields.join(', ')}].`,
          code: 'ROW_MISSING_VALUE',
          recommendation: 'Preencha todos os campos obrigatórios nesta linha da planilha.'
        });
      }

      // Verificação da Regra Obrigatória de Data de Solicitação (Data Atual Obrigatória)
      const rawDateStr = getValue('DataSolicitacao');
      const parsedDateISO = rawDateStr ? robustParseToISODate(rawDateStr) : '';
      const isDateValid = parsedDateISO === todayISO || rawDateStr === todayStrSP || rawDateStr.startsWith(todayStrSP);

      if (!rawDateStr) {
        errors.push({
          rowNum: i + 1,
          field: 'DataSolicitacao',
          title: `Data Não Informada (Linha ${i + 1})`,
          message: `A data de solicitação está vazia nesta linha.`,
          code: 'EMPTY_ORDER_DATE',
          recommendation: `A regra de importação exige pedidos com a data atual (${todayStrSP}). Preencha a data antes de importar.`
        });
      } else if (!isDateValid) {
        errors.push({
          rowNum: i + 1,
          field: 'DataSolicitacao',
          title: `Data Incompatível (Linha ${i + 1})`,
          message: `A data informada nesta linha ("${rawDateStr}") é diferente da data de hoje (${todayStrSP}).`,
          code: 'INVALID_ORDER_DATE',
          recommendation: `Regra estrita: Pedidos com data diferente de hoje (${todayStrSP}) NÃO serão importados e serão rejeitados automaticamente. Corrija a data na planilha.`
        });
      }

      // Check partner client link
      if (codCliente) {
        const matchedPartner = partnerClients.find(p => matchClientCode(p.id, codCliente));
        if (!matchedPartner) {
          warnings.push({
            rowNum: i + 1,
            title: `Código de Cliente Não Localizado (Linha ${i + 1})`,
            message: `Código "${codCliente}" não corresponde a parceiros cadastrados no sistema.`,
            code: 'PARTNER_NOT_FOUND',
            recommendation: 'O pedido continuará elegível e será importado na Categoria Avulsa (Código Geral).'
          });
        }
      }

      // Check duplication in database
      if (pedidoStr && codCliente) {
        const existingOrder = orders.find(o => o.id === pedidoStr && o.codigoCliente === codCliente);
        if (existingOrder && existingOrder.status !== 'cancelled') {
          errors.push({
            rowNum: i + 1,
            title: `Pedido Duplicado e Ativo (Linha ${i + 1})`,
            message: `Pedido ID "${pedidoStr}" já cadastrado e ativo para o parceiro "${codCliente}".`,
            code: 'DUPLICATE_ORDER_DB',
            recommendation: 'Para sobrescrever esse pedido, delete ou cancele o existente primeiro ou mude seu ID na planilha.'
          });
        }

        // Check internal duplicates in the file content
        const internalKey = `${pedidoStr}-${codCliente}`;
        if (parsedOrdersInPreFile.has(internalKey)) {
          warnings.push({
            rowNum: i + 1,
            title: `Pedido Duplicado na Planilha (Linha ${i + 1})`,
            message: `O pedido ID "${pedidoStr}" aparece mais de uma vez na própria planilha para o cliente "${codCliente}".`,
            code: 'DUPLICATE_ORDER_INTERNAL',
            recommendation: 'O sistema irá processar apenas a primeira ocorrência ou sobrescrevê-la.'
          });
        } else {
          parsedOrdersInPreFile.add(internalKey);
        }
      }
    }

    return {
      errors,
      warnings,
      isValid: errors.length === 0,
      totalCount: errors.length + warnings.length
    };
  }, [fileContent, orders, partnerClients, todayISO, todayStrSP]);

  const handleFileReading = (file: File) => {
    if (!file) return;
    
    const extension = file.name.split('.').pop()?.toLowerCase();
    const validExtensions = ['csv', 'txt', 'tsv', 'xlsx', 'xls'];
    if (!validExtensions.includes(extension || '')) {
      alert('Formato de arquivo não suportado. Por favor, envie um arquivo de Planilha Excel (.xlsx, .xls), CSV (.csv) ou Texto (.txt, .tsv).');
      return;
    }

    const reader = new FileReader();
    
    if (extension === 'xlsx' || extension === 'xls') {
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          if (data) {
            const workbook = XLSX.read(new Uint8Array(data as ArrayBuffer), { 
              type: 'array', 
              cellDates: true, 
              dateNF: 'yyyy-mm-dd' 
            });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            // Convert worksheet directly to semi-colon separated CSV
            const csvContent = XLSX.utils.sheet_to_csv(worksheet, { 
              FS: ';', 
              dateNF: 'yyyy-mm-dd' 
            });
            
            setFileContent(csvContent);
            setFileName(file.name);
            const kbSize = (file.size / 1024).toFixed(1);
            setFileSize(`${kbSize} KB`);
            setLogs([{ type: 'success', msg: `Planilha Excel "${file.name}" importada e processada via memória com sucesso (${kbSize} KB).` }]);
            setImportStats(null);
          }
        } catch (error) {
          console.error(error);
          alert('Erro ao processar a planilha Excel. Verifique se o arquivo está corrompido ou possui um formato inválido.');
        }
      };
      reader.onerror = () => {
        alert('Erro ao ler o arquivo.');
      };
      reader.readAsArrayBuffer(file);
    } else {
      reader.onload = (e) => {
        const text = e.target?.result;
        if (typeof text === 'string') {
          setFileContent(text);
          setFileName(file.name);
          const kbSize = (file.size / 1024).toFixed(1);
          setFileSize(`${kbSize} KB`);
          setLogs([{ type: 'success', msg: `Arquivo de texto "${file.name}" carregado com sucesso (${kbSize} KB).` }]);
          setImportStats(null);
        }
      };
      reader.onerror = () => {
        alert('Erro ao ler o arquivo.');
      };
      reader.readAsText(file, 'UTF-8');
    }
  };

  const handleProcessImport = () => {
    if (!fileContent.trim()) {
      alert('Por favor, carregue um arquivo de planilha antes de processar.');
      return;
    }

    const analysis = processRawDataRepresentation(fileContent);
    if (analysis.rows.length === 0) {
      setLogs([{ type: 'error', msg: 'O arquivo informado está vazio ou sem linhas de dados.' }]);
      return;
    }

    if (analysis.missingMandatory.length > 0) {
      const errMsg = `Cabeçalhos obrigatórios ausentes: [${analysis.missingMandatory.join(', ')}].`;
      setLogs([{ type: 'error', msg: errMsg }]);
      return;
    }

    const invalidDateRows = analysis.rows.filter(r => {
      const d = r.values.DataSolicitacao;
      const parsed = d ? robustParseToISODate(d) : '';
      return !(parsed === todayISO || d === todayStrSP || d.startsWith(todayStrSP));
    });

    if (invalidDateRows.length === analysis.rows.length && analysis.rows.length > 0) {
      setLogs([
        { 
          type: 'error', 
          msg: `IMPORTAÇÃO BLOQUEADA: Todas as ${invalidDateRows.length} linhas possuem data diferente da data atual (${todayStrSP}). Regra de importação exige pedidos com a data de hoje.` 
        }
      ]);
      setImportStats({ total: analysis.rows.length, success: 0, failed: analysis.rows.length });
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    const totalRows = analysis.rows.length;
    const currentLogs: typeof logs = [];
    if (invalidDateRows.length > 0) {
      currentLogs.push({
        type: 'warning',
        msg: `ALERTA DE REGRA DE DATA: ${invalidDateRows.length} linha(s) possuem data diferente de hoje (${todayStrSP}) e serão REJEITADAS automaticamente conforme a regra do sistema.`
      });
    }
    const newOrdersToImport: Order[] = [];
    let successCount = 0;
    let failedCount = 0;

    let currentIdx = 0;
    const steps = Math.min(10, totalRows);
    const chunkSize = Math.ceil(totalRows / steps);

    const runImportStep = () => {
      const limit = Math.min(currentIdx + chunkSize, totalRows);
      
      for (let i = currentIdx; i < limit; i++) {
        const { lineNum, values } = analysis.rows[i];
        const codCliente = values.CodigoCliente || selectedPartnerId || (partnerClients.length === 1 ? partnerClients[0].id : '') || 'GERAL';
        const dataSolicitacao = values.DataSolicitacao;
        const procurarPor = values.ProcurarPor;
        const endereco = values.Endereco;
        let cep = values.CEP;
        if (!cleanCepDigits(cep) || cleanCepDigits(cep).length !== 8) {
          const extracted = extractCepFromAddress(endereco) || 
                            extractCepFromAddress(values.Complemento) || 
                            extractCepFromAddress(values.Detalhe);
          if (extracted) {
            cep = extracted.formattedCep;
          }
        }

        if (!codCliente || !dataSolicitacao || !procurarPor || !endereco || !cep) {
          const blankFields: string[] = [];
          if (!codCliente) blankFields.push('CodigoCliente');
          if (!dataSolicitacao) blankFields.push('DataSolicitacao');
          if (!procurarPor) blankFields.push('ProcurarPor');
          if (!endereco) blankFields.push('Endereco');
          if (!cep) blankFields.push('CEP');

          const errorMsg = `[Linha ${lineNum}] REJEITADO: Campos obrigatórios vazios: [${blankFields.join(', ')}].`;
          currentLogs.push({ type: 'error', msg: errorMsg });
          failedCount++;
          continue;
        }

        const now = new Date();
        const importDateTimeStr = `${formatToBrasiliaDate(now)} ${formatToBrasiliaTime(now, true)}`;
        const importTimeStr = formatToBrasiliaTime(now, true);

        const rawDataSol = values.DataSolicitacao;
        const parsedDataSol = rawDataSol ? robustParseToISODate(rawDataSol) : '';
        const isDateValid = parsedDataSol === todayISO || rawDataSol === todayStrSP || rawDataSol.startsWith(todayStrSP);

        if (!rawDataSol || !isDateValid) {
          const errorMsg = `[Linha ${lineNum}] ALERTA / REJEITADO: Data de solicitação "${rawDataSol || 'Vazia'}" é diferente da data de hoje (${todayStrSP}). Pedido NÃO IMPORTADO pela regra estrita de data.`;
          currentLogs.push({ type: 'error', msg: errorMsg });
          failedCount++;
          continue;
        }

        const finalDataSolicitacao = parsedDataSol || todayISO;
        const finalDataLimite = importDateTimeStr;
        const finalDataAgendamento = importDateTimeStr;
        const pedidoStr = values.Pedido || `PED-IMPORT-${lineNum}-${Date.now().toString().slice(-4)}`;
        const targetId = (codCliente && pedidoStr && !pedidoStr.toLowerCase().startsWith(codCliente.toLowerCase()))
          ? `${codCliente}-${pedidoStr}`
          : pedidoStr;

        const existingOrder = orders.find(o => 
          o.id === targetId || 
          (o.id === pedidoStr && matchClientCode(o.codigoCliente, codCliente)) || 
          (o.pedido === pedidoStr && matchClientCode(o.codigoCliente, codCliente))
        );

        if (existingOrder) {
          if (existingOrder.status !== 'cancelled') {
            const errorMsg = `[Linha ${lineNum}] REJEITADO: Pedido "${pedidoStr}" já cadastrado e ativo para o cliente "${codCliente}".`;
            currentLogs.push({ type: 'error', msg: errorMsg });
            failedCount++;
            continue;
          } else {
            currentLogs.push({ 
              type: 'warning', 
              msg: `[Linha ${lineNum}] ALERTA: Pedido "${pedidoStr}" já existia como 'cancelado' e foi sobrescrito.` 
            });
          }
        }

        let numVal = parseFloat(values.ValorEntrega) || parseFloat(values.ValorReceber) || 50.00;
        const numNf = parseFloat(values.ValorNotaFiscal) || 0;
        
        const mappedPartner = partnerClients.find(p => matchClientCode(p.id, codCliente) || matchClientCode(p, codCliente));
        const partnerCompanyName = mappedPartner ? mappedPartner.name : (values.NomeFantasia || codCliente);
        const finalRecipient = (procurarPor && procurarPor.trim()) || (values.ProcurarPor && values.ProcurarPor.trim()) || 'Destinatário';

        // Check CEP range rule for this partner client if rules are available
        const cleanCep = (cep || '').replace(/\D/g, '');
        const cepNum = parseInt(cleanCep, 10);
        if (!isNaN(cepNum) && mappedPartner && freightRules && freightRules.length > 0) {
          const matchedRule = freightRules.find((rule: any) => {
            const isPartnerMatch = rule.partnerId === mappedPartner.id || 
                                   rule.codigoCliente === mappedPartner.id || 
                                   rule.partnerId === codCliente || 
                                   rule.codigoCliente === codCliente;
            if (!isPartnerMatch) return false;

            const minCep = (rule.cepMin || '').replace(/\D/g, '');
            const maxCep = (rule.cepMax || '').replace(/\D/g, '');
            if (!minCep || !maxCep) return false;

            const minNum = parseInt(minCep, 10);
            const maxNum = parseInt(maxCep, 10);

            return cepNum >= minNum && cepNum <= maxNum;
          });

          if (matchedRule && matchedRule.value !== undefined && matchedRule.value !== null) {
            numVal = Number(matchedRule.value) || 0;
          }
        }

        const city = values.CidadeMunicipio || 'São Paulo';
        const state = values.Estado || 'SP';

        const initialHistory = [
          {
            id: `hist-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            time: importDateTimeStr,
            status: 'pending',
            note: 'Pedido importado via planilha.'
          }
        ];

        const fullyMappedOrder: Order = {
          id: targetId,
          customerName: finalRecipient,
          address: `${endereco}, ${values.Complemento || ''} - CEP: ${cep}`,
          status: 'pending',
          courierId: undefined,
          value: numVal,
          time: importTimeStr,
          region: city === 'São Paulo' ? 'Centro-Paulista' : 'Zona Sul',
          isImported: true,

          codigoCliente: codCliente,
          cliente: partnerCompanyName,
          dataSolicitacao: finalDataSolicitacao,
          pedido: pedidoStr,
          procurarPor: finalRecipient,
          cep: cep,
          telefone: values.Telefone,
          detalhe: values.Detalhe,
          email: values.Email,
          complemento: values.Complemento,
          dispositivoCondutor: values.DispositivoCondutor,
          horarioFinal: importTimeStr,
          documentoEmpresa: values.DocumentoEmpresa,
          tipoEntrega: values.TipoEntrega,
          prioridade: values.Prioridade || 'Normal',
          chamado: values.Chamado,
          danfe: values.DANFE,
          dataLimite: finalDataLimite,
          nomeFantasia: values.NomeFantasia || (mappedPartner ? mappedPartner.name : ''),
          horarioInicio: importTimeStr,
          dataAgendamento: finalDataAgendamento,
          cidadeMunicipio: city,
          estado: state,
          valorNotaFiscal: numNf,
          valorReceber: parseFloat(values.ValorReceber) || 0,
          history: initialHistory,
          valorEntrega: numVal,
          latitude: parseFloat(values.Latitude) || undefined,
          longitude: parseFloat(values.Longitude) || undefined,
          destinatarioCnpjCpf: values.DestinatarioCnpjCpf,
          valorCondutor: 0 // Unallocated imported orders start with zero repasse
        };

        newOrdersToImport.push(fullyMappedOrder);
        currentLogs.push({ type: 'success', msg: `[Linha ${lineNum}] OK: Pedido "${pedidoStr}" validado para importação.` });
        successCount++;
      }

      currentIdx = limit;
      const progressPercent = Math.round((currentIdx / totalRows) * 100);
      setUploadProgress(progressPercent);

      if (currentIdx < totalRows) {
        setTimeout(runImportStep, 80);
      } else {
        setIsUploading(false);
        setLogs(currentLogs);
        setImportStats({ total: totalRows, success: successCount, failed: failedCount });

        console.log('[ImportSpreadsheet] Processamento de planilha finalizado.');
        console.log(`[ImportSpreadsheet] Resultados da validação: Total=${totalRows}, Sucesso=${successCount}, Falhas=${failedCount}`);
        console.log('[ImportSpreadsheet] Pedidos mapeados com sucesso:', newOrdersToImport);

        if (newOrdersToImport.length > 0) {
          console.log(`[ImportSpreadsheet] Chamando a função de atualização de estado 'onImportOrders' recebida da App.tsx com ${newOrdersToImport.length} pedidos.`);
          
          setIsSaving(true); // Start saving phase

          // Using a small timeout to make the UI phase transition clean and scannable
          setTimeout(async () => {
            try {
              await onImportOrders(newOrdersToImport);
              console.log('[ImportSpreadsheet] Função callback onImportOrders executada com sucesso.');
              
              setImportSuccessToast({
                show: true,
                message: failedCount > 0
                  ? `✓ Processamento concluído: ${successCount} pedido(s) importado(s)! ${failedCount} linha(s) com data diferente de hoje (${todayStrSP}) foram REJEITADAS e não importadas.`
                  : `✓ Sucesso! Processamento concluído: ${successCount} pedidos válidos foram processados e salvos com sucesso no servidor central!`
              });
            } catch (callbackErr) {
              console.error('[ImportSpreadsheet] Erro ao executar a função callback onImportOrders:', callbackErr);
              setImportSuccessToast({
                show: true,
                message: `⚠ Processamento concluído localmente, mas ocorreu um erro ao salvar/sincronizar com o servidor central.`
              });
            } finally {
              setIsSaving(false);
              // Auto clear toast after 8 seconds
              setTimeout(() => {
                setImportSuccessToast(null);
              }, 8000);
            }
          }, 500);
        } else {
          console.warn('[ImportSpreadsheet] Nenhum pedido válido foi encontrado para importação.');
          setImportSuccessToast({
            show: true,
            message: `⚠ Nenhum pedido válido encontrado para importação. Verifique os erros no Relatório de Validações abaixo.`
          });
          setTimeout(() => {
            setImportSuccessToast(null);
          }, 8000);
        }
      }
    };

    setTimeout(runImportStep, 100);
  };

  const filteredPreviewRows = useMemo(() => {
    if (!searchPreview) return currentAnalysis.rows;
    return currentAnalysis.rows.filter(row => {
      const searchLower = searchPreview.toLowerCase();
      const cliCode = row.values.CodigoCliente || '';
      const partner = partnerClients.find(p => matchClientCode(p.id, cliCode));
      const partnerName = partner ? partner.name : '';
      return (
        (row.values.Pedido || '').toLowerCase().includes(searchLower) ||
        cliCode.toLowerCase().includes(searchLower) ||
        partnerName.toLowerCase().includes(searchLower) ||
        (row.values.ProcurarPor || '').toLowerCase().includes(searchLower) ||
        (row.values.Endereco || '').toLowerCase().includes(searchLower) ||
        (row.values.CEP || '').toLowerCase().includes(searchLower)
      );
    });
  }, [currentAnalysis.rows, searchPreview, partnerClients]);

  const sortedPreviewRows = useMemo(() => {
    const rawRows = [...filteredPreviewRows];
    if (!sortField) return rawRows;

    rawRows.sort((a, b) => {
      let valA: any = '';
      let valB: any = '';

      if (sortField === 'linha') {
        valA = a.lineNum;
        valB = b.lineNum;
      } else if (sortField === 'pedido') {
        valA = a.values.Pedido || '';
        valB = b.values.Pedido || '';
      } else if (sortField === 'cliente') {
        const pA = partnerClients.find(p => matchClientCode(p.id, a.values.CodigoCliente || ''));
        const pB = partnerClients.find(p => matchClientCode(p.id, b.values.CodigoCliente || ''));
        valA = pA ? pA.name : (a.values.CodigoCliente || '');
        valB = pB ? pB.name : (b.values.CodigoCliente || '');
      } else if (sortField === 'destinatario') {
        valA = a.values.ProcurarPor || '';
        valB = b.values.ProcurarPor || '';
      } else if (sortField === 'cep') {
        valA = a.values.CEP || '';
        valB = b.values.CEP || '';
      } else if (sortField === 'valor') {
        valA = parseFloat(a.values.ValorEntrega) || parseFloat(a.values.ValorReceber) || 50.0;
        valB = parseFloat(b.values.ValorEntrega) || parseFloat(b.values.ValorReceber) || 50.0;
      } else if (sortField === 'status') {
        const parseToISODatePre = (str: string): string => {
          return robustParseToISODate(str);
        };

        const getStatusOrder = (row: any) => {
          const cli = row.values.CodigoCliente;
          const dataS = row.values.DataSolicitacao;
          const dest = row.values.ProcurarPor;
          const cepVal = row.values.CEP;
          if (!cli || !dataS || !dest || !cepVal) return 3; // Incompleto
          const rowISODatePre = parseToISODatePre(dataS);
          const isDateValidPre = rowISODatePre === todayISO || dataS === todayStrSP || dataS.startsWith(todayStrSP);
          if (!isDateValidPre) {
            return 2; // Data Incompatível (Não será importado)
          }
          return 1; // Ok
        };

        valA = getStatusOrder(a);
        valB = getStatusOrder(b);
      }

      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });

    return rawRows;
  }, [filteredPreviewRows, sortField, sortAsc, todayISO, todayStrSP]);

  return (
    <div id="import-spreadsheet-container" className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-6 animate-fade-in">
      
      {importSuccessToast && importSuccessToast.show && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-4 flex items-start gap-3 shadow-md animate-fade-in relative">
          <div className="h-5 w-5 bg-emerald-500 text-white rounded-full flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">✓</div>
          <div className="flex-1">
            <h4 className="font-bold text-xs text-emerald-900">Aviso de Processamento</h4>
            <p className="text-[11px] text-emerald-700 mt-0.5 font-semibold">{importSuccessToast.message}</p>
            <p className="text-[9px] text-emerald-500 mt-1 font-mono">Status: Sucesso • Redirecionando para visualização...</p>
          </div>
          <button 
            onClick={() => setImportSuccessToast(null)}
            className="absolute top-2 right-2 text-emerald-400 hover:text-emerald-600 transition-colors cursor-pointer"
            id="close-toast-button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="h-10 w-10 bg-indigo-50 text-indigo-700 rounded-xl flex items-center justify-center">
            <FileSpreadsheet className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-sm">Importação de Planilha por Arquivo</h3>
            <p className="text-[10px] text-slate-400 mt-0.5 font-medium">Faça o upload do arquivo contendo os dados exportados da sua planilha</p>
          </div>
        </div>
        
        <div className="bg-amber-50 border border-amber-200/50 rounded-xl p-2 px-3 text-xs text-amber-800 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse"></span>
          <span>Data de Fechamento: <strong className="font-mono">{todayStrSP}</strong></span>
        </div>
      </div>

      <div className="bg-slate-50 border border-slate-200/70 rounded-xl p-3 flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
        <div className="flex-1 space-y-1 text-slate-600 leading-snug">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-700 text-[10px] uppercase tracking-wider flex items-center gap-1">
              <Info className="h-3.5 w-3.5 text-indigo-600" />
              Orientações da Planilha:
            </span>
            <span className="text-[10px] text-indigo-700 font-semibold bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md">
              Data Obrigatória de Hoje: {todayStrSP}
            </span>
          </div>
          <p className="text-[10.5px] text-slate-500">
            Colunas essenciais: <strong className="text-slate-700">CodigoCliente</strong>, <strong className="text-slate-700">DataSolicitacao</strong>, <strong className="text-slate-700">ProcurarPor</strong>, <strong className="text-slate-700">Endereco</strong> e <strong className="text-slate-700">CEP</strong> (.xlsx, .csv ou .txt). Pedidos são importados como <strong className="text-indigo-700">"Pendente"</strong> sem motorista para alocação.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 bg-white border border-slate-200/80 px-3 py-1.5 rounded-lg shadow-2xs">
          <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
          <div className="text-left">
            <h4 className="font-bold text-[10px] text-slate-800 leading-none">Planilha Padrão</h4>
            <span className="text-[9px] text-slate-400">Modelo 30 colunas</span>
          </div>
          <button
            type="button"
            onClick={downloadExcelTemplate}
            className="ml-1 inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold rounded-md shadow-2xs transition-all cursor-pointer"
          >
            Baixar Modelo (.xlsx)
          </button>
        </div>
      </div>

      {/* Opções inteligentes de importação e Cliente da Planilha */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex flex-col justify-between gap-2">
          <div>
            <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-indigo-500"></span>
              Vincular a um Cliente / Parceiro
            </span>
            <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
              Defina o parceiro caso a planilha não possua a coluna Código do Cliente
            </p>
          </div>
          <select
            value={selectedPartnerId}
            onChange={(e) => setSelectedPartnerId(e.target.value)}
            disabled={isUploading || isSaving}
            className="w-full mt-1 bg-white border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg px-3 py-2 outline-none focus:border-indigo-500 transition-colors"
          >
            <option value="">Automático (detectar por linha ou Categoria Geral)</option>
            {partnerClients.map(p => (
              <option key={p.id} value={p.id}>{p.id} - {p.name}</option>
            ))}
          </select>
        </div>

        <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4 flex items-center justify-between gap-4">
          <div className="flex flex-col">
            <span className="font-bold text-amber-900 text-xs flex items-center gap-1.5">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              Validação Estrita de Data Ativa
            </span>
            <span className="text-[10px] text-amber-800 font-medium mt-0.5">
              Pedidos com data diferente da data de hoje (<strong>{todayStrSP}</strong>) emitem alerta de erro e NÃO são importados.
            </span>
          </div>
          <span className="px-2.5 py-1 bg-amber-600 text-white rounded-lg text-[10px] font-extrabold uppercase tracking-wider shrink-0 shadow-xs">
            Regra Ativa
          </span>
        </div>
      </div>

      {/* Tabs para Escolher Arquivo ou Colar Texto Direto */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 border-b border-slate-200 w-full pb-1">
            <button
              type="button"
              onClick={() => setInputTab('upload')}
              className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${
                inputTab === 'upload'
                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Upload de Arquivo (.xlsx, .csv, .txt)
            </button>
            <button
              type="button"
              onClick={() => setInputTab('paste')}
              className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${
                inputTab === 'paste'
                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Colar Linhas de Texto (Ctrl+V)
            </button>
          </div>
        </div>

        {inputTab === 'paste' && !fileContent ? (
          <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-4 space-y-3">
            <label className="block text-slate-750 font-bold text-xs">
              Cole as linhas da sua planilha ou tabela abaixo (copiadas do Excel ou Bloco de Notas):
            </label>
            <textarea
              rows={6}
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              placeholder={`Exemplo:\n23/09/2026\t100043806\tSandy Oliveira\t"Rua Matilde Sá Barbosa 38 Luz\nSão Paulo, São Paulo, 01106-090"\t`}
              className="w-full font-mono text-xs p-3 bg-white border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-slate-700 placeholder:text-slate-350 resize-y"
            />
            <div className="flex justify-between items-center">
              <span className="text-[11px] text-slate-400">
                O sistema detecta separadores por tabulação, vírgula ou ponto e vírgula, e extrai o CEP automaticamente do endereço se a coluna estiver vazia.
              </span>
              <button
                type="button"
                disabled={!pastedText.trim()}
                onClick={() => {
                  if (!pastedText.trim()) return;
                  setFileContent(pastedText);
                  setFileName('Linhas coladas diretamente');
                  const kbSize = (new Blob([pastedText]).size / 1024).toFixed(1);
                  setFileSize(`${kbSize} KB`);
                  setLogs([{ type: 'success', msg: `Texto colado processado com sucesso (${kbSize} KB).` }]);
                  setImportStats(null);
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer"
              >
                Processar e Visualizar
              </button>
            </div>
          </div>
        ) : !fileContent ? (
          <div 
            id="dropzone-area"
            onDragOver={(e) => { e.preventDefault(); if (!isUploading && !isSaving) setIsDragActive(true); }}
            onDragLeave={() => setIsDragActive(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragActive(false);
              if (isUploading || isSaving) return;
              const file = e.dataTransfer.files?.[0];
              if (file) handleFileReading(file);
            }}
            onClick={() => {
              if (!isUploading && !isSaving) fileInputRef.current?.click();
            }}
            className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 ${
              isDragActive 
                ? 'border-indigo-500 bg-indigo-50/40 text-indigo-900 shadow-inner' 
                : 'border-slate-250 bg-slate-50/60 hover:bg-slate-50 hover:border-slate-355 text-slate-500'
            } ${isUploading || isSaving ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''}`}
          >
            <input 
              id="file-element-input"
              type="file" 
              ref={fileInputRef}
              disabled={isUploading || isSaving}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileReading(file);
                e.target.value = '';
              }}
              accept=".xlsx,.xls,.csv,.txt,.tsv"
              className="hidden"
            />
            <div className={`h-12 w-12 rounded-xl flex items-center justify-center mb-4 transition-colors ${
              isDragActive ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-600'
            }`}>
              <UploadCloud className="h-6 w-6" />
            </div>
            <p className="font-bold text-slate-800 text-sm mb-1">
              Arraste e solte seu arquivo aqui ou clique para selecionar
            </p>
            <p className="text-[11px] text-slate-400 max-w-md mb-4 font-medium">
              Suporta planilhas Excel padrões <span className="font-bold text-indigo-600">.xlsx / .xls</span>, além de arquivos de texto delimitados <span className="font-bold text-indigo-600">.csv</span>, <span className="font-bold text-indigo-600">.txt (tabulado)</span> ou <span className="font-bold text-indigo-600">.tsv</span>
            </p>
            <div className="flex gap-2">
              <span className="px-2.5 py-1 bg-white border border-slate-200 text-slate-500 text-[10px] rounded font-bold shadow-sm">EXCEL (.XLSX / .XLS)</span>
              <span className="px-2.5 py-1 bg-white border border-slate-200 text-slate-500 text-[10px] rounded font-bold shadow-sm">CSV</span>
              <span className="px-2.5 py-1 bg-white border border-slate-200 text-slate-500 text-[10px] rounded font-bold shadow-sm">TXT TABULADO</span>
            </div>
          </div>
        ) : null}

        {fileContent && (
          <div className="border border-slate-100 rounded-2xl bg-slate-50/50 p-4 flex items-center justify-between gap-4 animate-fade-in">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-12 w-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center shrink-0 border border-emerald-100/50">
                <FileSpreadsheet className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-800 truncate">{fileName}</p>
                <p className="text-[10px] text-slate-400 font-medium mt-0.5">{fileSize} • Carregado na memória</p>
              </div>
            </div>
            <button 
              id="clear-file-button"
              disabled={isUploading || isSaving}
              onClick={() => {
                if (isUploading || isSaving) return;
                setFileContent('');
                setFileName('');
                setFileSize(null);
                setLogs([]);
                setImportStats(null);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-700 text-[11px] rounded-lg font-bold border border-rose-100 transition-colors shadow-sm cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Remover</span>
            </button>
          </div>
        )}
      </div>

      {/* SEÇÃO DE PROGRESSO VISUAL DA IMPORTAÇÃO */}
      {isUploading && (
        <div id="import-progress-bar-card" className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl space-y-3 animate-fade-in shadow-sm">
          <div className="flex items-center justify-between text-xs text-indigo-950 font-bold">
            <div className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-indigo-600 animate-spin" />
              <span>Sincronizando e Processando Registros da Planilha...</span>
            </div>
            <span className="font-mono text-indigo-700">{uploadProgress}%</span>
          </div>

          <div className="w-full bg-indigo-100 h-2.5 rounded-full overflow-hidden shadow-inner">
            <div 
              className="bg-indigo-650 h-full rounded-full transition-all duration-150 ease-out"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[10px] text-indigo-600 font-bold font-mono">
            <span>Verificando consistência de campos obrigatórios...</span>
            <span>{Math.min(currentAnalysis.rows.length, Math.round((uploadProgress / 100) * currentAnalysis.rows.length))} / {currentAnalysis.rows.length} registros</span>
          </div>
        </div>
      )}

      {isSaving && (
        <div id="import-saving-card" className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl space-y-3 animate-pulse shadow-sm">
          <div className="flex items-center justify-between text-xs text-emerald-950 font-bold">
            <div className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-emerald-600 animate-spin" />
              <span>Registrando Pedidos e Sincronizando com Banco Central...</span>
            </div>
            <span className="font-mono text-emerald-700">Salvando...</span>
          </div>

          <div className="w-full bg-emerald-100 h-2.5 rounded-full overflow-hidden shadow-inner animate-pulse">
            <div 
              className="bg-emerald-600 h-full rounded-full transition-all duration-300"
              style={{ width: `100%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[10px] text-emerald-600 font-bold font-mono">
            <span>Gravando dados estruturados...</span>
            <span>Aguarde a confirmação final</span>
          </div>
        </div>
      )}

      {fileContent.trim() !== '' && (
        <div className="space-y-6 border-t border-slate-100 pt-5">
          
          {/* 1. Alinhamento de Campos */}
          <div className="space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
              <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Layers className="h-4 w-4 text-indigo-500" />
                <span>Mapeamento Automático dos Campos Fundamentais</span>
              </h4>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {mandatoryKeys.map(key => {
                const fileColIndex = currentAnalysis.headerMatched[key];
                const isFound = fileColIndex !== undefined && fileColIndex !== -1;
                return (
                  <div 
                    id={`mandatory-${key}`}
                    key={key} 
                    className={`border p-2.5 rounded-xl flex flex-col justify-between transition-colors ${
                      isFound 
                        ? 'border-emerald-100 bg-emerald-50/45 text-emerald-900 shadow-sm' 
                        : 'border-rose-100 bg-rose-50/40 text-rose-900 animate-pulse'
                    }`}
                  >
                    <span className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400">{key}</span>
                    <div className="flex items-center justify-between gap-1 mt-1">
                      <span className="text-[10px] font-semibold truncate">
                        {isFound ? `Coluna ${fileColIndex + 1}` : 'Não encontrada'}
                      </span>
                      <span className="text-xs">
                        {isFound ? '✓' : '✖'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {currentAnalysis.missingMandatory.length > 0 ? (
              <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-start gap-2 text-xs text-rose-800">
                <AlertTriangle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                <div>
                  <strong>Cabeçalhos obrigatórios ausentes:</strong> {currentAnalysis.missingMandatory.join(', ')}. Por favor, confira a estrutura de colunas do seu arquivo de planilha carregado.
                </div>
              </div>
            ) : (
              <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center gap-2 text-xs text-emerald-800">
                <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                <div>
                  <strong>Formato Compatível!</strong> Todos os cabeçalhos obrigatórios foram mapeados com sucesso.
                </div>
              </div>
            )}
          </div>

          {/* 2. PAINEL DETALHADO DE COMPATIBILIDADE E DIAGNÓSTICO DE ERROS */}
          <div className="border border-slate-150 rounded-2xl bg-slate-50/50 p-4 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600">
                  <AlertCircle className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-800">Diagnóstico de Qualidade e Formatadores</h4>
                  <p className="text-[9px] text-slate-400 font-medium">Lista detalhada de inconsistências, conflitos de datas ou duplicidades na planilha</p>
                </div>
              </div>

              {/* Botões de Filtro */}
              <div className="flex items-center gap-2 self-start md:self-auto">
                <button
                  type="button"
                  onClick={() => setDiagnosticFilter('all')}
                  className={`px-2 py-1 rounded-lg text-[9px] font-bold transition-all border ${
                    diagnosticFilter === 'all' 
                      ? 'bg-slate-800 border-slate-900 text-white shadow-xs' 
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Todos ({fileDiagnostics.totalCount})
                </button>
                <button
                  type="button"
                  onClick={() => setDiagnosticFilter('errors')}
                  className={`px-2 py-1 rounded-lg text-[9px] font-bold transition-all border flex items-center gap-1 ${
                    diagnosticFilter === 'errors' 
                      ? 'bg-rose-600 border-rose-700 text-white shadow-xs' 
                      : 'bg-white border-slate-200 text-rose-600 hover:bg-rose-50'
                  }`}
                >
                  <XCircle className="h-3 w-3" />
                  Erros Críticos ({fileDiagnostics.errors.length})
                </button>
                <button
                  type="button"
                  onClick={() => setDiagnosticFilter('warnings')}
                  className={`px-2 py-1 rounded-lg text-[9px] font-bold transition-all border flex items-center gap-1 ${
                    diagnosticFilter === 'warnings' 
                      ? 'bg-amber-500 border-amber-600 text-white shadow-xs' 
                      : 'bg-white border-slate-200 text-amber-600 hover:bg-slate-50'
                  }`}
                >
                  <AlertTriangle className="h-3 w-3" />
                  Alertas ({fileDiagnostics.warnings.length})
                </button>
              </div>
            </div>

            {/* Filtro de Busca Interna */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={diagnosticSearch}
                onChange={(e) => setDiagnosticSearch(e.target.value)}
                placeholder="Filtrar por número de linha, descrição de erro ou código de cliente..."
                className="pl-8 pr-3 py-1.5 w-full bg-white text-[10px] text-slate-700 border border-slate-200 outline-none focus:ring-1 focus:ring-indigo-500 rounded-xl"
              />
            </div>

            {/* Diagnostic Logs Filtered View */}
            {(() => {
              const allDiagnostics = [
                ...fileDiagnostics.errors.map(e => ({ ...e, type: 'error' as const })),
                ...fileDiagnostics.warnings.map(w => ({ ...w, type: 'warning' as const }))
              ];

              const filteredDiagnostics = allDiagnostics.filter(diag => {
                if (diagnosticFilter === 'errors' && diag.type !== 'error') return false;
                if (diagnosticFilter === 'warnings' && diag.type !== 'warning') return false;

                if (!diagnosticSearch) return true;
                const normalizedSearch = diagnosticSearch.toLowerCase();
                return (
                  diag.title.toLowerCase().includes(normalizedSearch) ||
                  diag.message.toLowerCase().includes(normalizedSearch) ||
                  diag.recommendation.toLowerCase().includes(normalizedSearch) ||
                  (diag.rowNum && `linha ${diag.rowNum}`.includes(normalizedSearch)) ||
                  diag.code.toLowerCase().includes(normalizedSearch)
                );
              });

              if (filteredDiagnostics.length === 0) {
                return (
                  <div className="bg-white border border-slate-100 rounded-xl p-6 text-center text-xs text-slate-400 font-bold">
                    Nenhum erro de formatação ou inconsistência de dados encontrado sob este filtro! ✨
                  </div>
                );
              }

              return (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {filteredDiagnostics.map((item, idx) => {
                    const isError = item.type === 'error';
                    return (
                      <div 
                        key={idx}
                        className={`p-3 rounded-xl border flex flex-col md:flex-row md:items-start justify-between gap-3 text-xs transition-all ${
                          isError 
                            ? 'bg-rose-50/50 border-rose-100 hover:bg-rose-50 text-rose-950' 
                            : 'bg-amber-50/50 border-amber-100 hover:bg-amber-50 text-amber-950'
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-wider ${
                              isError ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                            }`}>
                              {isError ? 'Erro Crítico' : 'Alerta / Aviso'}
                            </span>
                            {item.rowNum && (
                              <span className="font-mono text-[9px] font-bold bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">
                                Linha {item.rowNum}
                              </span>
                            )}
                            <span className="font-black text-[11px] text-slate-800">{item.title}</span>
                          </div>
                          <p className="text-[10px] text-slate-600 font-medium leading-normal">{item.message}</p>
                        </div>

                        <div className="bg-white/90 border border-slate-200/80 px-2 py-1 rounded-lg md:max-w-[200px] shrink-0 flex flex-col justify-center shadow-2xs">
                          <span className="text-[7px] uppercase tracking-wider font-extrabold text-indigo-600 block">Correção Sugerida:</span>
                          <span className="text-[8.5px] font-semibold text-slate-700 leading-tight block mt-0.5">{item.recommendation}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>

          {currentAnalysis.rows.length > 0 && (
            <div className="bg-slate-50 rounded-2xl border border-slate-100 p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-xs text-slate-700 font-bold">Pré-visualização dos Dados ({currentAnalysis.rows.length} registros extraídos)</span>
                
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={searchPreview}
                    onChange={(e) => setSearchPreview(e.target.value)}
                    placeholder="Filtrar..."
                    className="pl-8 pr-3 py-1 w-full sm:w-40 bg-white text-[10px] text-slate-700 border border-slate-200 outline-none focus:ring-1 focus:ring-indigo-500 rounded-lg"
                  />
                </div>
              </div>

              <div className="overflow-x-auto border border-slate-100 rounded-xl bg-white select-none">
                <table className="w-full text-[10px] border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200 text-slate-500 font-bold text-left">
                      {columnOrder.map(colId => {
                        const info = colDetails[colId] || { label: colId, minW: 'w-24' };
                        const isSorted = sortField === colId;
                        return (
                          <th 
                            key={colId}
                            draggable
                            onDragStart={(e) => handleDragStart(e, colId)}
                            onDragOver={(e) => handleDragOver(e, colId)}
                            onDrop={(e) => handleDrop(e, colId)}
                            onClick={() => handleSortClick(colId)}
                            className={`py-2 px-3 text-[10px] uppercase tracking-wider font-extrabold cursor-move hover:bg-slate-200 transition-colors ${info.minW} select-none`}
                            title="Arraste para mudar a ordem ou Clique para ordenar"
                          >
                            <div className="flex items-center gap-1">
                              <span>{info.label}</span>
                              <span className="text-slate-400 font-mono text-[9px]">
                                {isSorted ? (sortAsc ? '▲' : '▼') : '↕'}
                              </span>
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sortedPreviewRows.map((row, idx) => {
                      const ped = row.values.Pedido;
                      const cli = row.values.CodigoCliente;
                      const dataS = row.values.DataSolicitacao;
                      const dest = row.values.ProcurarPor;
                      const cepVal = row.values.CEP;
                      const valEnt = parseFloat(row.values.ValorEntrega) || 0;

                      let rowValidate = 'Ok';
                      let rowValidateColor = 'text-emerald-700 bg-emerald-50';
                      
                      const parseToISODatePre = (str: string): string => {
                        return robustParseToISODate(str);
                      };

                      if (!cli || !dataS || !dest || !cepVal) {
                        rowValidate = 'Incompleto';
                        rowValidateColor = 'text-rose-700 bg-rose-50 border border-rose-200';
                      } else {
                        const rowISODatePre = parseToISODatePre(dataS);
                        const isDateValidPre = rowISODatePre === todayISO || dataS === todayStrSP || dataS.startsWith(todayStrSP);
                        if (!isDateValidPre) {
                          rowValidate = 'Data Incompatível (Não será importado)';
                          rowValidateColor = 'text-rose-700 bg-rose-50 border border-rose-200 font-bold';
                        }
                      }

                      return (
                        <tr key={idx} className="hover:bg-slate-50 text-slate-600 divide-x divide-slate-100/50">
                          {columnOrder.map(colId => {
                            if (colId === 'linha') {
                              return <td key={colId} className="py-1.5 px-3 font-mono text-slate-400">#{row.lineNum}</td>;
                            }
                            if (colId === 'pedido') {
                              return <td key={colId} className="py-1.5 px-3 font-bold font-mono text-slate-800">{ped || 'Automático'}</td>;
                            }
                            if (colId === 'cliente') {
                              const partner = partnerClients.find(p => matchClientCode(p.id, cli));
                              return (
                                <td key={colId} className="py-1.5 px-3 border-r border-slate-100 bg-slate-50/10">
                                  {partner ? (
                                    <div className="flex flex-col">
                                      <span className="text-[11px] text-slate-800 font-extrabold tracking-tight">{partner.name}</span>
                                      <span className="text-[9px] text-slate-400 font-mono font-medium">{cli}</span>
                                    </div>
                                  ) : (
                                    <span className="text-amber-700 bg-amber-50/65 px-1.5 py-0.5 rounded border border-amber-100 font-mono text-[9.5px] font-bold">
                                      {cli || 'Sem Código'}
                                    </span>
                                  )}
                                </td>
                              );
                            }
                            if (colId === 'destinatario') {
                              return <td key={colId} className="py-1.5 px-3 truncate max-w-[120px]">{dest}</td>;
                            }
                            if (colId === 'cep') {
                              return <td key={colId} className="py-1.5 px-3 font-mono">{cepVal}</td>;
                            }
                            if (colId === 'valor') {
                              return <td key={colId} className="py-1.5 px-3 font-mono text-indigo-600 font-semibold font-mono">R$ {valEnt ? valEnt.toFixed(2).replace('.', ',') : '50,00'}</td>;
                            }
                            if (colId === 'status') {
                              return (
                                <td key={colId} className="py-1.5 px-3">
                                  <span className={`px-1 rounded text-[8px] font-bold uppercase ${rowValidateColor}`}>
                                    {rowValidate}
                                  </span>
                                </td>
                              );
                            }
                            return null;
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-100 pt-5">
        <button
          id="sync-import-button"
          onClick={handleProcessImport}
          disabled={currentAnalysis.missingMandatory.length > 0 || currentAnalysis.rows.length === 0 || isUploading || isSaving}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer transition-all active:scale-95 disabled:opacity-40 disabled:hover:bg-indigo-600 cursor-pointer disabled:cursor-not-allowed"
        >
          {isUploading ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin text-white" />
              <span>Processando Planilha ({uploadProgress}%)</span>
            </>
          ) : isSaving ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin text-emerald-300" />
              <span>Sincronizando Servidor...</span>
            </>
          ) : (
            <>
              <CheckCircle className="h-4 w-4" />
              <span>Sincronizar e Importar</span>
            </>
          )}
        </button>

        {importStats && (
          <div className="p-2 px-3 bg-slate-900 rounded-lg flex gap-4 text-[9px] font-bold text-slate-400 font-mono">
            <span>Total: <strong className="text-white">{importStats.total}</strong></span>
            <span className="text-emerald-400">Sucesso: <strong>{importStats.success}</strong></span>
            <span className="text-rose-400">Falhas: <strong>{importStats.failed}</strong></span>
          </div>
        )}
      </div>

      {logs.length > 0 && (
        <div className="bg-slate-900 text-slate-300 rounded-xl p-3 font-mono text-[9px] space-y-1 max-h-40 overflow-y-auto">
          <p className="text-[8px] text-slate-500 border-b border-slate-800 pb-1 uppercase font-bold">Relatório de Validações</p>
          {logs.map((log, idx) => (
            <div key={idx} className="flex items-start gap-1">
              <span className={log.type === 'error' ? 'text-rose-500' : log.type === 'warning' ? 'text-amber-500' : 'text-emerald-400'}>
                {log.type === 'error' ? '✖' : log.type === 'warning' ? '⚠' : '✓'}
              </span>
              <span>{log.msg}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
