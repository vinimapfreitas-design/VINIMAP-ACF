import { jsPDF } from 'jspdf';
import { Order, PartnerClient, matchClientCode } from '../types';
import { 
  resolveReceiverName, 
  resolveReceiverDoc, 
  resolveDeliveryTime, 
  resolveOrderPhoto, 
  resolveOrderSignature 
} from './photoStorage';

async function ensureImageDataUrl(src?: string | null): Promise<{ data: string; format: 'PNG' | 'JPEG' } | null> {
  if (!src) return null;
  const trimmed = src.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('data:image/png')) {
    return { data: trimmed, format: 'PNG' };
  }
  if (trimmed.startsWith('data:image/')) {
    return { data: trimmed, format: 'JPEG' };
  }

  try {
    return await new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || img.width || 300;
          canvas.height = img.naturalHeight || img.height || 200;
          const ctx = canvas.getContext('2d');
          if (!ctx) return resolve(null);
          ctx.drawImage(img, 0, 0);
          resolve({ data: canvas.toDataURL('image/jpeg', 0.9), format: 'JPEG' });
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = trimmed;
    });
  } catch {
    return null;
  }
}

export async function exportProtocolToPDF(
  order: Order,
  partnerClients: PartnerClient[] = [],
  format: 'a4' | 'half' = 'a4',
  showFinancials = false
): Promise<boolean> {
  try {
    const isHalf = format === 'half';
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: isHalf ? 'a5' : 'a4'
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const margin = 10;
    const contentWidth = pageWidth - (margin * 2);
    let y = 12;

    const partner = partnerClients.find(p => matchClientCode(p.id, order.codigoCliente));
    const partnerName = partner ? partner.name : (order.nomeFantasia || 'Emissor Avulso');
    const partnerDoc = partner?.cnpjCpf || 'Não informado';

    const receiverName = resolveReceiverName(order);
    const receiverDoc = resolveReceiverDoc(order);
    const deliveryTime = resolveDeliveryTime(order);
    const rawPhoto = resolveOrderPhoto(order);
    const rawSignature = resolveOrderSignature(order);

    const [resolvedPhoto, resolvedSignature] = await Promise.all([
      ensureImageDataUrl(rawPhoto),
      ensureImageDataUrl(rawSignature)
    ]);

    // Accent top bar
    pdf.setFillColor(30, 41, 59); // Slate-800
    pdf.rect(0, 0, pageWidth, 4, 'F');

    // Header
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(13);
    pdf.setTextColor(15, 23, 42);
    pdf.text('PROTOCOLO DE ENTREGA CERTIFICADO', margin, y);

    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(100, 116, 139);
    pdf.text('ViniMap Gestor Operacional Logístico • Documento Oficial de Conformidade', margin, y + 4.5);

    // Order ID Pill
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.setTextColor(15, 23, 42);
    const orderText = `PEDIDO: ${order.pedido || order.id}`;
    pdf.text(orderText, pageWidth - margin - pdf.getTextWidth(orderText), y + 1);

    y += 12;

    // Line divider
    pdf.setDrawColor(226, 232, 240);
    pdf.setLineWidth(0.5);
    pdf.line(margin, y, pageWidth - margin, y);
    y += 4;

    // 3 Cards: Emissor, Transporte, Detalhes
    const colW = (contentWidth - 6) / 3;
    const cardH = 20;

    // Card 1: Emissor
    pdf.setFillColor(248, 250, 252);
    pdf.roundedRect(margin, y, colW, cardH, 1.5, 1.5, 'F');
    pdf.setDrawColor(203, 213, 225);
    pdf.roundedRect(margin, y, colW, cardH, 1.5, 1.5, 'S');

    pdf.setFontSize(6.5);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(100, 116, 139);
    pdf.text('EMISSOR LOGÍSTICO / CLIENTE', margin + 3, y + 4.5);
    pdf.setFontSize(8.5);
    pdf.setTextColor(15, 23, 42);
    const splitPartner = pdf.splitTextToSize(partnerName.toUpperCase(), colW - 6);
    pdf.text(splitPartner[0] || '', margin + 3, y + 9);
    pdf.setFontSize(7);
    pdf.setTextColor(71, 85, 105);
    pdf.text(`CNPJ/CPF: ${partnerDoc}`, margin + 3, y + 14);

    // Card 2: Transporte
    const c2X = margin + colW + 3;
    pdf.setFillColor(248, 250, 252);
    pdf.roundedRect(c2X, y, colW, cardH, 1.5, 1.5, 'F');
    pdf.setDrawColor(203, 213, 225);
    pdf.roundedRect(c2X, y, colW, cardH, 1.5, 1.5, 'S');

    pdf.setFontSize(6.5);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(100, 116, 139);
    pdf.text('DADOS DO TRANSPORTE', c2X + 3, y + 4.5);
    pdf.setFontSize(8.5);
    pdf.setTextColor(15, 23, 42);
    pdf.text(`ID: ${order.pedido || order.id}`, c2X + 3, y + 9);
    pdf.setFontSize(7);
    pdf.setTextColor(71, 85, 105);
    pdf.text(`Região: ${order.region || 'São Paulo - SP'}`, c2X + 3, y + 14);

    // Card 3: Datas
    const c3X = c2X + colW + 3;
    pdf.setFillColor(248, 250, 252);
    pdf.roundedRect(c3X, y, colW, cardH, 1.5, 1.5, 'F');
    pdf.setDrawColor(203, 213, 225);
    pdf.roundedRect(c3X, y, colW, cardH, 1.5, 1.5, 'S');

    pdf.setFontSize(6.5);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(100, 116, 139);
    pdf.text('STATUS & HORÁRIO', c3X + 3, y + 4.5);
    pdf.setFontSize(8.5);
    pdf.setTextColor(15, 23, 42);
    pdf.text(order.status === 'delivered' ? 'CONCLUÍDO' : 'EM PROCESSAMENTO', c3X + 3, y + 9);
    pdf.setFontSize(7);
    pdf.setTextColor(71, 85, 105);
    pdf.text(`Entregue: ${deliveryTime}`, c3X + 3, y + 14);

    y += cardH + 4;

    // Destinatário Box
    const destH = 26;
    pdf.setFillColor(248, 250, 252);
    pdf.roundedRect(margin, y, contentWidth, destH, 1.5, 1.5, 'F');
    pdf.setDrawColor(203, 213, 225);
    pdf.roundedRect(margin, y, contentWidth, destH, 1.5, 1.5, 'S');

    pdf.setFontSize(7);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(100, 116, 139);
    pdf.text('DADOS COMPLETOS DO DESTINATÁRIO E LOCAL DE ENTREGA', margin + 3, y + 5);

    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(15, 23, 42);
    pdf.text(order.customerName || (order as any).destinatario || 'Destinatário não informado', margin + 3, y + 11);

    pdf.setFontSize(7.5);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(51, 65, 85);
    const fullAddress = `${order.address || ''}${order.complemento ? ` (${order.complemento})` : ''}, ${order.bairro || ''} - ${order.cidadeMunicipio || 'São Paulo'} - ${order.estado || 'SP'}`;
    pdf.text(fullAddress, margin + 3, y + 16.5);
    pdf.text(`CEP: ${order.cep || 'S/N'} • Telefone: ${order.telefone || 'Não informado'} • Prioridade: ${order.prioridade || 'Normal'}`, margin + 3, y + 21.5);

    y += destH + 4;

    // Protocolo de Recebimento Box
    const protoH = isHalf ? 50 : 75;
    pdf.setFillColor(255, 255, 255);
    pdf.roundedRect(margin, y, contentWidth, protoH, 1.5, 1.5, 'F');
    pdf.setDrawColor(148, 163, 184);
    pdf.roundedRect(margin, y, contentWidth, protoH, 1.5, 1.5, 'S');

    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(30, 41, 59);
    pdf.text('COMPROVAÇÃO DE ENTREGA / PROTOCOLO DIGITAL', margin + 3, y + 6);

    pdf.setFontSize(7.5);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(51, 65, 85);
    pdf.text(`Nome do Recebedor: ${receiverName}`, margin + 3, y + 13);
    pdf.text(`Data e Horário Exato de Conclusão: ${deliveryTime}`, margin + 3, y + 18);
    pdf.text(`Documento (RG/CPF): ${receiverDoc}`, margin + 3, y + 23);

    if (showFinancials) {
      pdf.text(`Valor da Mercadoria / NF: R$ ${(Number(order.valorNotaFiscal || 0)).toFixed(2)} • Frete: R$ ${(Number(order.value || order.valorEntrega || 0)).toFixed(2)}`, margin + 3, y + 28);
    }

    // Embed Signature & Photo if available
    const imgBoxWidth = isHalf ? 32 : 45;
    const imgBoxHeight = isHalf ? 22 : 32;

    if (resolvedSignature) {
      try {
        const sigX = margin + contentWidth - (imgBoxWidth * 2) - 6;
        pdf.setFontSize(6.5);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(71, 85, 105);
        pdf.text('Assinatura Digital:', sigX, y + 6);
        pdf.setFillColor(248, 250, 252);
        pdf.roundedRect(sigX, y + 8, imgBoxWidth, imgBoxHeight, 1, 1, 'F');
        pdf.setDrawColor(203, 213, 225);
        pdf.roundedRect(sigX, y + 8, imgBoxWidth, imgBoxHeight, 1, 1, 'S');
        pdf.addImage(resolvedSignature.data, resolvedSignature.format, sigX + 1, y + 9, imgBoxWidth - 2, imgBoxHeight - 2);
      } catch (_) {}
    }

    if (resolvedPhoto) {
      try {
        const photoX = margin + contentWidth - imgBoxWidth - 2;
        pdf.setFontSize(6.5);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(71, 85, 105);
        pdf.text('Comprovante Fotográfico:', photoX, y + 6);
        pdf.setFillColor(248, 250, 252);
        pdf.roundedRect(photoX, y + 8, imgBoxWidth, imgBoxHeight, 1, 1, 'F');
        pdf.setDrawColor(203, 213, 225);
        pdf.roundedRect(photoX, y + 8, imgBoxWidth, imgBoxHeight, 1, 1, 'S');
        pdf.addImage(resolvedPhoto.data, resolvedPhoto.format, photoX + 1, y + 9, imgBoxWidth - 2, imgBoxHeight - 2);
      } catch (_) {}
    }

    // Footer
    pdf.setFontSize(6.5);
    pdf.setFont('helvetica', 'italic');
    pdf.setTextColor(148, 163, 184);
    pdf.text('Documento gerado eletronicamente por ViniMap Gestão de Frotas • Autenticidade e integridade garantidas no registro operacional.', margin, pdf.internal.pageSize.getHeight() - 6);

    const fileName = `protocolo-${order.pedido || order.id || 'entrega'}.pdf`;
    pdf.save(fileName);
    return true;
  } catch (err) {
    console.error('[exportProtocolToPDF] Falha ao exportar PDF do protocolo:', err);
    // As last resort, try window.print
    try {
      window.print();
    } catch (_) {}
    return false;
  }
}
