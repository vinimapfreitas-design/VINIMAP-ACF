import { Order, PartnerClient, matchClientCode } from '../types';

export const DEFAULT_PARTNERS: PartnerClient[] = [
  { id: 'CLI-001', name: 'VINIMAP LOG', codigoCliente: 'CLI-001', phone: '11947971294', cnpjCpf: '42272330000186', createdAt: '28/08/2026', isActive: true },
  { id: 'CLI-002', name: 'ZONA CEREALISTA', codigoCliente: 'CLI-002', phone: '(11) 41129964', cnpjCpf: '15504485000149', createdAt: '02/09/2026', isActive: true },
  { id: 'CLI-003', name: 'ESTACAO DO GRAO', codigoCliente: 'CLI-003', phone: '(11) 4116-8565', cnpjCpf: '11.918.501/0001-78', createdAt: '02/09/2026', isActive: true },
  { id: 'CLI-004', name: 'MIESS MODA', codigoCliente: 'CLI-004', phone: '114810-6810', cnpjCpf: '10.365.271/0001-02', createdAt: '03/09/2026', isActive: true },
  { id: 'CLI-005', name: 'EMPORIO ROSA', codigoCliente: 'CLI-005', phone: '113315-0662', cnpjCpf: '29.240.690/0001-38', createdAt: '03/09/2026', isActive: true },
  { id: 'CLI-006', name: 'EMPORIO DA TERRA', codigoCliente: 'CLI-006', phone: '113228-4301', cnpjCpf: '24167191000149', createdAt: '03/09/2026', isActive: true }
];

/**
 * Resiliently finds the PartnerClient object associated with an order.
 * Checks partnerClients array, local storage cache, and DEFAULT_PARTNERS,
 * testing against order.codigoCliente, order.cliente, order.nomeFantasia,
 * order.documentoEmpresa, order.customerName, and order.procurarPor.
 */
export function getPartnerObject(order: Partial<Order>, partnerClients: PartnerClient[] = []): PartnerClient | undefined {
  if (!order) return undefined;
  const clientCode = (order.codigoCliente || '').trim();
  const clientName = (order.cliente || order.nomeFantasia || '').trim();
  const docEmpresa = (order.documentoEmpresa || '').trim();
  const customerName = (order.customerName || '').trim();
  const procurarPor = (order.procurarPor || '').trim();

  // Helper matcher against a partner object
  const checkPartner = (p: PartnerClient): boolean => {
    if (!p) return false;
    return Boolean(
      (clientCode && (matchClientCode(p, clientCode) || matchClientCode(p.id, clientCode) || matchClientCode(p.codigoCliente, clientCode))) ||
      (clientName && (matchClientCode(p, clientName) || matchClientCode(p.name, clientName))) ||
      (docEmpresa && matchClientCode(p, docEmpresa)) ||
      (customerName && (matchClientCode(p, customerName) || matchClientCode(p.name, customerName))) ||
      (procurarPor && (matchClientCode(p, procurarPor) || matchClientCode(p.name, procurarPor)))
    );
  };

  // 1. Check in provided partnerClients array
  if (partnerClients && partnerClients.length > 0) {
    const found = partnerClients.find(checkPartner);
    if (found) return found;
  }

  // 2. Check in localStorage cache if partnerClients list from props is empty or missing this partner
  try {
    const rawStored = typeof window !== 'undefined' ? window.localStorage.getItem('vinimap_partners') : null;
    if (rawStored) {
      const stored: PartnerClient[] = JSON.parse(rawStored);
      if (Array.isArray(stored) && stored.length > 0) {
        const found = stored.find(checkPartner);
        if (found) return found;
      }
    }
  } catch (e) {}

  // 3. Fallback to DEFAULT_PARTNERS
  const defaultFound = DEFAULT_PARTNERS.find(checkPartner);
  if (defaultFound) return defaultFound;

  return undefined;
}

/**
 * Returns the human-readable name of the partner company for an order.
 * Prioritizes registered partner name, nomeFantasia, cliente, and falls back to
 * the actual partner code (e.g. "CLI-001") rather than generic placeholders.
 */
export function resolvePartnerName(order: Partial<Order>, partnerClients: PartnerClient[] = []): string {
  if (!order) return '-';
  
  // 1. Matched partner object
  const partner = getPartnerObject(order, partnerClients);
  if (partner && partner.name) {
    return partner.name.trim();
  }

  const isRawCode = (str?: string): boolean => {
    if (!str) return true;
    const t = str.trim();
    return /^(cli|cl|cod|c|ped|p)?[_-]?\d+$/i.test(t) || /^\d+$/.test(t);
  };

  // 2. If order itself has a textual partner name (nomeFantasia or cliente)
  if (order.nomeFantasia && order.nomeFantasia.trim() && !isRawCode(order.nomeFantasia)) {
    return order.nomeFantasia.trim();
  }
  if (order.cliente && order.cliente.trim() && !isRawCode(order.cliente)) {
    return order.cliente.trim();
  }

  const allPartners = [...(partnerClients || []), ...DEFAULT_PARTNERS];

  // 3. If it's a numeric/sequential ID (e.g. CLI-001, 1), check if allPartners has a match by digits
  const numDigits = (order.codigoCliente || '').replace(/\D/g, '');
  if (numDigits) {
    const targetNum = parseInt(numDigits, 10);
    const byNum = allPartners.find(p => {
      const pDigits = (p.codigoCliente || p.id || '').replace(/\D/g, '');
      return pDigits ? parseInt(pDigits, 10) === targetNum : false;
    });
    if (byNum && byNum.name) return byNum.name.trim();
  }

  // 4. If customerName or procurarPor matches a known partner name
  const custName = (order.customerName || '').trim();
  if (custName) {
    const partnerByCust = allPartners.find(p => matchClientCode(p.name, custName));
    if (partnerByCust && partnerByCust.name) return partnerByCust.name.trim();
  }
  const procName = (order.procurarPor || '').trim();
  if (procName) {
    const partnerByProc = allPartners.find(p => matchClientCode(p.name, procName));
    if (partnerByProc && partnerByProc.name) return partnerByProc.name.trim();
  }

  // 5. If order has codigoCliente that is an actual descriptive company name (e.g. "Mercado Livre", "B2W")
  if (order.codigoCliente && order.codigoCliente.trim() && !isRawCode(order.codigoCliente)) {
    return order.codigoCliente.trim();
  }

  // 6. If it's explicitly avulso
  const code = (order.codigoCliente || '').trim().toLowerCase();
  if (code.includes('avu') || code.includes('balcao') || code.includes('sem')) {
    return 'Venda Avulsa / S/C';
  }

  // 7. If order has codigoCliente, return it instead of hiding it with generic text
  if (order.codigoCliente && order.codigoCliente.trim()) {
    return order.codigoCliente.trim();
  }

  return '-';
}

/**
 * Returns the final recipient (DESTINATÁRIO FINAL) of an order.
 * Ensures the partner company name is NEVER displayed as the recipient.
 */
export function resolveRecipientName(order: Partial<Order>, partnerClients: PartnerClient[] = []): string {
  if (!order) return '-';

  const partnerName = resolvePartnerName(order, partnerClients).trim();
  const allPartners = [...(partnerClients || []), ...DEFAULT_PARTNERS];

  // Helper to determine if a string represents a partner company, code, or identifier
  const isPartnerText = (text?: string): boolean => {
    if (!text) return true;
    const clean = text.toLowerCase().trim();
    if (!clean || clean === '-' || clean === 'n/a' || clean === 'não atribuído') return true;
    if (partnerName && partnerName !== '-' && clean === partnerName.toLowerCase().trim()) return true;
    
    // Check against all known partner names and codes
    return allPartners.some(p => {
      const pName = (p.name || '').toLowerCase().trim();
      const pId = (p.id || '').toLowerCase().trim();
      const pCode = (p.codigoCliente || '').toLowerCase().trim();
      return (pName && clean === pName) || (pId && clean === pId) || (pCode && clean === pCode);
    });
  };

  const procurarPor = (order.procurarPor || '').trim();
  const custName = (order.customerName || '').trim();

  // 1. If procurarPor is filled and is not a partner company name, it is the recipient!
  if (procurarPor && !isPartnerText(procurarPor)) {
    return procurarPor;
  }

  // 2. If customerName is filled and is not a partner company name, it is the recipient!
  if (custName && !isPartnerText(custName)) {
    return custName;
  }

  // 3. Check if detalhe contains recipient information
  if (order.detalhe && !isPartnerText(order.detalhe) && order.detalhe.length < 80) {
    return order.detalhe.trim();
  }

  // 4. If order has recipient CPF/CNPJ
  if (order.destinatarioCnpjCpf && order.destinatarioCnpjCpf.trim()) {
    return `Destinatário (${order.destinatarioCnpjCpf.trim()})`;
  }

  // 5. NEVER return the partner company name as recipient
  return 'Destinatário';
}

/**
 * Checks whether an order matches a specific partner filter (partner ID, 'avulsa', or 'all').
 * Handles contract ID matching, client code matching, name aliases, and unregistered partners.
 */
export function isOrderMatchingPartner(
  order: Partial<Order>,
  targetPartner: string | undefined | null,
  partnerClients: PartnerClient[] = []
): boolean {
  if (!targetPartner || targetPartner === 'all') return true;
  const partnerObj = getPartnerObject(order, partnerClients);
  if (targetPartner === 'avulsa') {
    return !partnerObj;
  }
  if (partnerObj) {
    if (partnerObj.id === targetPartner || partnerObj.codigoCliente === targetPartner) return true;
    if (matchClientCode(targetPartner, partnerObj.id) || matchClientCode(targetPartner, partnerObj.codigoCliente) || matchClientCode(targetPartner, partnerObj.name)) return true;
  }
  if (order.codigoCliente && matchClientCode(targetPartner, order.codigoCliente)) return true;
  if (order.cliente && matchClientCode(targetPartner, order.cliente)) return true;
  if (order.nomeFantasia && matchClientCode(targetPartner, order.nomeFantasia)) return true;
  return false;
}

