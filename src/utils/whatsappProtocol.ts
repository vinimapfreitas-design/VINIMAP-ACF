import { Order, PartnerClient } from '../types';
import { resolveReceiverName, resolveReceiverDoc, resolveDeliveryTime } from './photoStorage';

export interface WhatsAppProtocolOptions {
  partnerName?: string;
  includeFinancials?: boolean;
  customNotes?: string;
  includeSystemAuth?: boolean;
}

/**
 * Clean phone number to WhatsApp international standard (e.g. 5511987654321)
 */
export function cleanPhoneForWhatsApp(rawPhone?: string | null): string {
  if (!rawPhone) return '';
  const digits = String(rawPhone).replace(/\D/g, '');
  if (!digits) return '';

  // If already starts with 55 and has 12 or 13 digits (55 + 2 DDD + 8 or 9 digits)
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    return digits;
  }

  // If 10 or 11 digits (DDD + phone)
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }

  return digits;
}

/**
 * Formats a phone string into Brazilian standard (XX) XXXXX-XXXX
 */
export function formatPhoneDisplay(rawPhone?: string | null): string {
  if (!rawPhone) return '';
  let digits = String(rawPhone).replace(/\D/g, '');
  
  if (digits.startsWith('55') && digits.length > 11) {
    digits = digits.slice(2);
  }

  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  } else if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }

  return rawPhone;
}

/**
 * Builds a formatted WhatsApp message for delivery protocol certification
 */
export function buildWhatsAppProtocolMessage(
  order: Order,
  options: WhatsAppProtocolOptions = {}
): string {
  const effectiveReceiver = order.deliveryProtocol?.signedName || order.receiverName || resolveReceiverName(order) || 'Destinatário';
  const effectiveDoc = order.deliveryProtocol?.signedDoc || order.receiverDoc || order.destinatarioCnpjCpf || 'Não Informado';
  const effectiveTime = order.deliveryProtocol?.signedAt || order.deliveredAt || resolveDeliveryTime(order) || 'Confirmado';
  const courier = order.courierName || order.allocatedCourierName || order.nomeCondutor || 'Equipe Vinimap';
  
  const partnerDisplay = options.partnerName || order.cliente || order.customerName || 'ViniMap Logística';
  const recipientName = order.customerName || order.procurarPor || 'Destinatário';
  const notes = options.customNotes !== undefined ? options.customNotes : (order.deliveryProtocol?.notes || order.notes || '');

  // System verification hash
  let authCode = '';
  try {
    authCode = btoa(`${order.id}-${effectiveDoc}`).slice(0, 24).toUpperCase();
  } catch (_) {
    authCode = `VNM-${order.id.slice(-6).toUpperCase()}`;
  }

  const lines: string[] = [
    `🚚 *VINIMAP LOGÍSTICA • PROTOCOLO DE ENTREGA* 📦`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `✅ *STATUS: ENTREGA HOMOLOGADA E CONCLUÍDA*`,
    ``,
    `📋 *DADOS DO PEDIDO:*`,
    `• *Pedido:* #${order.id}`,
  ];

  if (order.codigoCliente) {
    lines.push(`• *Cód. Cliente:* ${order.codigoCliente}`);
  }

  lines.push(`• *Cliente/Remetente:* ${partnerDisplay}`);
  lines.push(`• *Destinatário:* ${recipientName}`);
  
  if (order.procurarPor && order.procurarPor !== order.customerName) {
    lines.push(`• *Aos cuidados de:* ${order.procurarPor}`);
  }

  lines.push(`• *Endereço:* ${order.address}`);

  if (order.cep) {
    lines.push(`• *CEP:* ${order.cep}`);
  }

  lines.push(``);
  lines.push(`✍️ *DADOS DA BAIXA E RECEBIMENTO:*`);
  lines.push(`• *Recebido por:* ${effectiveReceiver}`);
  lines.push(`• *Documento (RG/CPF):* ${effectiveDoc}`);
  lines.push(`• *Data e Hora:* ${effectiveTime}`);
  lines.push(`• *Entregador Responsável:* ${courier}`);

  const hasPhoto = Boolean(order.deliveryProtocol?.photoUrl || order.proofPhotoUrl);
  const hasSignature = Boolean(order.deliveryProtocol?.signatureData || order.signatureDataUrl);

  if (hasPhoto || hasSignature) {
    const items: string[] = [];
    if (hasSignature) items.push('Assinatura Digital');
    if (hasPhoto) items.push('Registro Fotográfico');
    lines.push(`• *Comprovação Anexada:* ✓ ${items.join(' e ')}`);
  }

  // Include photo link if public URL
  const photoUrl = order.deliveryProtocol?.photoUrl || order.proofPhotoUrl;
  if (photoUrl && photoUrl.startsWith('http')) {
    lines.push(`• *Foto do Comprovante:* ${photoUrl}`);
  }

  if (options.includeFinancials) {
    const valMerc = order.valorNotaFiscal || order.value || 0;
    const valFrete = order.valorEntrega || 0;
    lines.push(``);
    lines.push(`💰 *VALORES:*`);
    lines.push(`• *Valor da Mercadoria:* R$ ${valMerc.toFixed(2).replace('.', ',')}`);
    if (valFrete > 0) {
      lines.push(`• *Valor da Taxa de Entrega:* R$ ${valFrete.toFixed(2).replace('.', ',')}`);
    }
  }

  if (notes) {
    lines.push(``);
    lines.push(`📝 *Observações:* ${notes}`);
  }

  lines.push(``);
  lines.push(`🔐 *Autenticação Digital:* \`${authCode}\``);
  lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`_Protocolo emitido eletronicamente pela ViniMap Sistemas Logísticos._`);

  return lines.join('\n');
}

/**
 * Returns a direct wa.me link with encoded text
 */
export function generateWhatsAppProtocolUrl(phone: string, message: string): string {
  const clean = cleanPhoneForWhatsApp(phone);
  const textEncoded = encodeURIComponent(message);
  if (!clean) {
    return `https://api.whatsapp.com/send?text=${textEncoded}`;
  }
  return `https://wa.me/${clean}?text=${textEncoded}`;
}
