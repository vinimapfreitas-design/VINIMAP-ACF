import { Order, PartnerClient, matchClientCode } from '../types';
import { resolvePartnerName, resolveRecipientName } from './partnerUtils';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export function downloadFile(content: string, filename: string, contentType: string) {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export interface ExportColumnDef {
  key: string;
  label: string;
}

export const EXPORT_COLUMNS: ExportColumnDef[] = [
  { key: 'id', label: 'Código Pedido' },
  { key: 'codigoCliente', label: 'Código Cliente' },
  { key: 'partnerName', label: 'Nome Cliente Parceiro' },
  { key: 'dataSolicitacao', label: 'Data de Solicitação' },
  { key: 'customer', label: 'Destinatário / Procurar Por' },
  { key: 'address', label: 'Endereço Completo' },
  { key: 'complemento', label: 'Complemento' },
  { key: 'cep', label: 'CEP' },
  { key: 'telefone', label: 'DDD / Telefone' },
  { key: 'cidadeMunicipio', label: 'Cidade / Município' },
  { key: 'estado', label: 'Estado' },
  { key: 'tipoEntrega', label: 'Tipo de Entrega' },
  { key: 'prioridade', label: 'Prioridade' },
  { key: 'danfe', label: 'Chave DANFE' },
  { key: 'valorNotaFiscal', label: 'Valor NF (R$)' },
  { key: 'valorReceber', label: 'Valor a Receber (R$)' },
  { key: 'value', label: 'Valor da Entrega (R$)' },
  { key: 'valorCondutor', label: 'Valor Repasse Condutor (R$)' },
  { key: 'status', label: 'Status do Pedido' }
];

export function exportOrdersToCSV(orders: Order[], partnerClients: PartnerClient[], selectedKeys?: string[]) {
  // Column definitions and mapping for robust data mapping
  const activeColumns = selectedKeys && selectedKeys.length > 0
    ? EXPORT_COLUMNS.filter(col => selectedKeys.includes(col.key))
    : EXPORT_COLUMNS;

  const headers = activeColumns.map(col => col.label);

  const rows = orders.map(order => {
    const partnerName = resolvePartnerName(order, partnerClients);
    
    return activeColumns.map(col => {
      switch (col.key) {
        case 'id':
          return order.id || '';
        case 'codigoCliente':
          return order.codigoCliente || '';
        case 'partnerName':
          return partnerName;
        case 'dataSolicitacao':
          return order.dataSolicitacao || '';
        case 'customer':
          return order.procurarPor || order.customerName || '';
        case 'address':
          return order.address || '';
        case 'complemento':
          return order.complemento || '';
        case 'cep':
          return order.cep || '';
        case 'telefone':
          return order.telefone || '';
        case 'cidadeMunicipio':
          return order.cidadeMunicipio || 'São Paulo';
        case 'estado':
          return order.estado || 'SP';
        case 'tipoEntrega':
          return order.tipoEntrega || 'Normal';
        case 'prioridade':
          return order.prioridade || 'Normal';
        case 'danfe':
          return order.danfe || '';
        case 'valorNotaFiscal':
          return order.valorNotaFiscal !== undefined ? order.valorNotaFiscal.toFixed(2).replace('.', ',') : '0,00';
        case 'valorReceber':
          return order.valorReceber !== undefined ? order.valorReceber.toFixed(2).replace('.', ',') : '0,00';
        case 'value':
          return order.value !== undefined ? order.value.toFixed(2).replace('.', ',') : '0,00';
        case 'valorCondutor':
          return order.valorCondutor !== undefined ? order.valorCondutor.toFixed(2).replace('.', ',') : '0,00';
        case 'status':
          return order.status === 'delivered' ? 'Concluído' : order.status === 'in_route' ? 'Em Rota' : order.status === 'pending' ? 'Pendente' : 'Cancelado';
        default:
          return '';
      }
    });
  });

  // Excel UTF-8 BOM is \uFEFF. Semicolon ; used as default search separator for South America/EU Windows locales in Excel
  const bom = '\uFEFF';
  const csvContent = bom + [
    headers.join(';'),
    ...rows.map(row => row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(';'))
  ].join('\r\n');

  const todayStr = new Date().toISOString().slice(0, 10);
  downloadFile(csvContent, `relatorio_faturamento_${todayStr}.csv`, 'text/csv;charset=utf-8;');
}

export function exportOrdersToExcel(orders: Order[], partnerClients: PartnerClient[]) {
  const todayStr = new Date().toISOString().slice(0, 10);
  
  let xml = `<?xml version="1.0" encoding="utf-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
  <Author>Sistema Logístico Express</Author>
  <Created>${new Date().toISOString()}</Created>
 </DocumentProperties>
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Borders/>
   <Font ss:FontName="Segoe UI" x:Family="Swiss" ss:Size="10" ss:Color="#333333"/>
   <Interior/>
   <NumberFormat/>
   <Protection/>
  </Style>
  <Style ss:ID="Title">
   <Font ss:FontName="Segoe UI" x:Family="Swiss" ss:Size="14" ss:Bold="1" ss:Color="#1E3A8A"/>
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="SubTitle">
   <Font ss:FontName="Segoe UI" x:Family="Swiss" ss:Size="9" ss:Italic="1" ss:Color="#666666"/>
  </Style>
  <Style ss:ID="Header">
   <Font ss:FontName="Segoe UI" x:Family="Swiss" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#1D4ED8" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#172554"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#172554"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#172554"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#172554"/>
   </Borders>
  </Style>
  <Style ss:ID="RowEven">
   <Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
   </Borders>
  </Style>
  <Style ss:ID="RowOdd">
   <Interior ss:Color="#FFFFFF" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
   </Borders>
  </Style>
  <Style ss:ID="CurrencyEven">
   <Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/>
   <NumberFormat ss:Format="&quot;R$&quot;\ #,##0.00"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
   </Borders>
  </Style>
  <Style ss:ID="CurrencyOdd">
   <Interior ss:Color="#FFFFFF" ss:Pattern="Solid"/>
   <NumberFormat ss:Format="&quot;R$&quot;\ #,##0.00"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
   </Borders>
  </Style>
  <Style ss:ID="StatusDelivered">
   <Font ss:FontName="Segoe UI" x:Family="Swiss" ss:Size="10" ss:Color="#15803D" ss:Bold="1"/>
   <Interior ss:Color="#DCFCE7" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
   </Borders>
  </Style>
  <Style ss:ID="StatusPending">
   <Font ss:FontName="Segoe UI" x:Family="Swiss" ss:Size="10" ss:Color="#B45309" ss:Bold="1"/>
   <Interior ss:Color="#FEF3C7" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
   </Borders>
  </Style>
  <Style ss:ID="StatusInRoute">
   <Font ss:FontName="Segoe UI" x:Family="Swiss" ss:Size="10" ss:Color="#1D4ED8" ss:Bold="1"/>
   <Interior ss:Color="#DBEAFE" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
   </Borders>
  </Style>
  <Style ss:ID="StatusCancelled">
   <Font ss:FontName="Segoe UI" x:Family="Swiss" ss:Size="10" ss:Color="#B91C1C" ss:Bold="1"/>
   <Interior ss:Color="#FEE2E2" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
   </Borders>
  </Style>
  <Style ss:ID="TotalLabel">
   <Font ss:FontName="Segoe UI" x:Family="Swiss" ss:Size="10" ss:Bold="1" ss:Color="#1E293B"/>
   <Interior ss:Color="#E2E8F0" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#1E293B"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#1E293B"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#1E293B"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#1E293B"/>
   </Borders>
  </Style>
  <Style ss:ID="TotalValue">
   <Font ss:FontName="Segoe UI" x:Family="Swiss" ss:Size="10" ss:Bold="1" ss:Color="#1E293B"/>
   <Interior ss:Color="#E2E8F0" ss:Pattern="Solid"/>
   <NumberFormat ss:Format="&quot;R$&quot;\ #,##0.00"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#1E293B"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#1E293B"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#1E293B"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#1E293B"/>
   </Borders>
  </Style>
 </Styles>
 <Worksheet ss:Name="Faturamento de Pedidos">
  <Table>
   <Column ss:Width="80"/>   <!-- Pedido ID -->
   <Column ss:Width="80"/>   <!-- Código Cliente -->
   <Column ss:Width="170"/>  <!-- Cliente Parceiro -->
   <Column ss:Width="85"/>   <!-- Data Solicitação -->
   <Column ss:Width="160"/>  <!-- Destinatário -->
   <Column ss:Width="200"/>  <!-- Endereço Completo -->
   <Column ss:Width="65"/>   <!-- CEP -->
   <Column ss:Width="95"/>   <!-- Chave DANFE -->
   <Column ss:Width="80"/>   <!-- Tipo Entrega -->
   <Column ss:Width="90"/>   <!-- Valor NF -->
   <Column ss:Width="90"/>   <!-- Valor Receber -->
   <Column ss:Width="90"/>   <!-- Valor Entrega -->
   <Column ss:Width="90"/>   <!-- Repasse Condutor -->
   <Column ss:Width="85"/>   <!-- Status -->

   <!-- Banner Row -->
   <Row ss:Height="25">
    <Cell ss:MergeAcross="13" ss:StyleID="Title"><Data ss:Type="String">SISTEMA LOGÍSTICO EXPRESS - RELATÓRIO DE FATURAMENTO PARCEIRO</Data></Cell>
   </Row>
   <Row ss:Height="18">
    <Cell ss:MergeAcross="13" ss:StyleID="SubTitle"><Data ss:Type="String">Relatório extraído em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')} • Período: Operações de Hoje</Data></Cell>
   </Row>
   <Row ss:Height="15"/> <!-- blank spacing -->

   <!-- Headers -->
   <Row ss:Height="22">
    <Cell ss:StyleID="Header"><Data ss:Type="String">Pedido ID</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Cód. Cliente</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Cliente Parceiro</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Data Solicitação</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Destinatário (Procurar)</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Endereço Completo</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">CEP</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Chave DANFE</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Tipo Entrega</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Valor NF</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Valor Receber</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Valor Entrega</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Valor Repasse</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Status</Data></Cell>
   </Row>
`;

  let totalNf = 0;
  let totalReceber = 0;
  let totalEntrega = 0;
  let totalRepasse = 0;

  orders.forEach((order, idx) => {
    const partnerName = resolvePartnerName(order, partnerClients);
    const rowStyle = idx % 2 === 0 ? 'RowEven' : 'RowOdd';
    const currencyStyle = idx % 2 === 0 ? 'CurrencyEven' : 'CurrencyOdd';
    
    let statusStyle = 'RowEven';
    let statusLabel = 'Pendente';
    if (order.status === 'delivered') {
      statusStyle = 'StatusDelivered';
      statusLabel = 'Concluído';
    } else if (order.status === 'in_route') {
      statusStyle = 'StatusInRoute';
      statusLabel = 'Em Rota';
    } else if (order.status === 'pending') {
      statusStyle = 'StatusPending';
      statusLabel = 'Pendente';
    } else {
      statusStyle = 'StatusCancelled';
      statusLabel = 'Cancelado';
    }

    const valNf = order.valorNotaFiscal || 0;
    const valReceber = order.valorReceber || 0;
    const valEntrega = order.value || 0;
    const valRepasse = order.valorCondutor || 0;

    totalNf += valNf;
    totalReceber += valReceber;
    totalEntrega += valEntrega;
    totalRepasse += valRepasse;

    xml += `   <Row ss:Height="20">
    <Cell ss:StyleID="${rowStyle}"><Data ss:Type="String">${escapeXml(order.id)}</Data></Cell>
    <Cell ss:StyleID="${rowStyle}"><Data ss:Type="String">${escapeXml(order.codigoCliente || '')}</Data></Cell>
    <Cell ss:StyleID="${rowStyle}"><Data ss:Type="String">${escapeXml(partnerName)}</Data></Cell>
    <Cell ss:StyleID="${rowStyle}"><Data ss:Type="String">${escapeXml(order.dataSolicitacao || '')}</Data></Cell>
    <Cell ss:StyleID="${rowStyle}"><Data ss:Type="String">${escapeXml(resolveRecipientName(order, partnerClients))}</Data></Cell>
    <Cell ss:StyleID="${rowStyle}"><Data ss:Type="String">${escapeXml(order.address || '')}</Data></Cell>
    <Cell ss:StyleID="${rowStyle}"><Data ss:Type="String">${escapeXml(order.cep || '')}</Data></Cell>
    <Cell ss:StyleID="${rowStyle}"><Data ss:Type="String">${escapeXml(order.danfe || '')}</Data></Cell>
    <Cell ss:StyleID="${rowStyle}"><Data ss:Type="String">${escapeXml(order.tipoEntrega || 'Normal')}</Data></Cell>
    <Cell ss:StyleID="${currencyStyle}"><Data ss:Type="Number">${valNf}</Data></Cell>
    <Cell ss:StyleID="${currencyStyle}"><Data ss:Type="Number">${valReceber}</Data></Cell>
    <Cell ss:StyleID="${currencyStyle}"><Data ss:Type="Number">${valEntrega}</Data></Cell>
    <Cell ss:StyleID="${currencyStyle}"><Data ss:Type="Number">${valRepasse}</Data></Cell>
    <Cell ss:StyleID="${statusStyle}"><Data ss:Type="String">${statusLabel}</Data></Cell>
   </Row>\n`;
  });

  // Add Totals Grand Row
  xml += `   <!-- Totals Row -->
   <Row ss:Height="22">
    <Cell ss:MergeAcross="8" ss:StyleID="TotalLabel"><Data ss:Type="String">TOTAIS OPERACIONAIS</Data></Cell>
    <Cell ss:StyleID="TotalValue"><Data ss:Type="Number">${totalNf}</Data></Cell>
    <Cell ss:StyleID="TotalValue"><Data ss:Type="Number">${totalReceber}</Data></Cell>
    <Cell ss:StyleID="TotalValue"><Data ss:Type="Number">${totalEntrega}</Data></Cell>
    <Cell ss:StyleID="TotalValue"><Data ss:Type="Number">${totalRepasse}</Data></Cell>
    <Cell ss:StyleID="TotalLabel"/>
   </Row>
  </Table>
  <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
   <PageSetup>
    <Layout x:Orientation="Landscape"/>
   </PageSetup>
   <Print>
    <ValidPrinterInfo/>
    <PaperSizeIndex>9</PaperSizeIndex>
    <HorizontalResolution>600</HorizontalResolution>
    <VerticalResolution>600</VerticalResolution>
   </Print>
   <Selected/>
   <Panes>
    <Pane>
     <Number>3</Number>
     <ActiveRow>0</ActiveRow>
    </Pane>
   </Panes>
   <ProtectObjects>False</ProtectObjects>
   <ProtectScenarios>False</ProtectScenarios>
  </WorksheetOptions>
 </Worksheet>
</Workbook>`;

  downloadFile(xml, `relatorio_faturamento_${todayStr}.xls`, 'application/vnd.ms-excel');
}

function escapeXml(str: string): string {
  if (!str) return '';
  return str.toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function generatePresetLogo(type: 'truck' | 'box' | 'fast'): string {
  if (typeof document === 'undefined') return '';
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Clear background with nice rounded container
  ctx.fillStyle = '#0f172a'; // slate-900 background like our main theme
  ctx.beginPath();
  ctx.arc(64, 64, 60, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ffffff'; // White glyphs
  ctx.strokeStyle = '#3b82f6'; // Blue accents
  ctx.lineWidth = 4;

  if (type === 'truck') {
    // Draw delivery truck
    ctx.beginPath();
    // Cargo bed
    ctx.rect(28, 44, 48, 38);
    // Cabin
    ctx.rect(76, 54, 24, 28);
    ctx.fill();
    
    // Wheels
    ctx.fillStyle = '#3b82f6';
    ctx.beginPath();
    ctx.arc(42, 86, 10, 0, Math.PI * 2);
    ctx.arc(84, 86, 10, 0, Math.PI * 2);
    ctx.fill();
  } else if (type === 'box') {
    // Draw 3D isometric box
    ctx.fillStyle = '#f59e0b'; // Amber box
    // Left face
    ctx.beginPath();
    ctx.moveTo(64, 30);
    ctx.lineTo(28, 50);
    ctx.lineTo(28, 90);
    ctx.lineTo(64, 70);
    ctx.closePath();
    ctx.fill();

    // Right face
    ctx.fillStyle = '#d97706'; // Dark amber
    ctx.beginPath();
    ctx.moveTo(64, 30);
    ctx.lineTo(100, 50);
    ctx.lineTo(100, 90);
    ctx.lineTo(64, 70);
    ctx.closePath();
    ctx.fill();

    // Top face
    ctx.fillStyle = '#fbbf24'; // Light amber
    ctx.beginPath();
    ctx.moveTo(64, 30);
    ctx.lineTo(28, 50);
    ctx.lineTo(64, 70);
    ctx.lineTo(100, 50);
    ctx.closePath();
    ctx.fill();

    // Tape lines
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(64, 70);
    ctx.lineTo(64, 30);
    ctx.stroke();
  } else if (type === 'fast') {
    // Draw fast moving arrows/wings
    ctx.fillStyle = '#3b82f6';
    ctx.beginPath();
    ctx.moveTo(20, 44);
    ctx.lineTo(70, 44);
    ctx.lineTo(50, 24);
    ctx.lineTo(108, 64);
    ctx.lineTo(50, 104);
    ctx.lineTo(70, 84);
    ctx.lineTo(20, 84);
    ctx.closePath();
    ctx.fill();
  }

  return canvas.toDataURL('image/png');
}

export function exportOrdersToPDF(orders: Order[], partnerClients: PartnerClient[], customLogoUrlOverride?: string) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  // Background accent bar
  doc.setFillColor(30, 41, 59); // Dark slate
  doc.rect(0, 0, 297, 4, 'F');

  // Load custom logo if present in override or localStorage
  const customLogoUrl = customLogoUrlOverride || (typeof localStorage !== 'undefined' ? localStorage.getItem('pdf_custom_logo') : null);

  if (customLogoUrl) {
    try {
      let format = 'PNG';
      if (customLogoUrl.includes('image/jpeg') || customLogoUrl.includes('image/jpg')) {
        format = 'JPEG';
      } else if (customLogoUrl.includes('image/webp')) {
        format = 'WEBP';
      }
      // Draw custom logo at x=14, y=8, w=15, h=15
      doc.addImage(customLogoUrl, format, 14, 8, 15, 15);
    } catch (e) {
      console.error("Erro ao desenhar logotipo personalizado no PDF, usando logotipo padrão:", e);
      // Fallback to default vector logo
      doc.setFillColor(15, 23, 42); // #0f172a
      doc.roundedRect(14, 12, 14, 14, 3, 3, 'F');

      doc.setDrawColor(59, 130, 246); // #3b82f6
      doc.setLineWidth(0.8);
      doc.line(17, 21, 21, 16);
      doc.line(21, 16, 25, 20);

      doc.setFillColor(244, 63, 94); // rose-500
      doc.circle(21, 16, 1.2, 'F');
      doc.setFillColor(16, 185, 129); // emerald-500
      doc.circle(25, 20, 1.2, 'F');
    }
  } else {
    // Default Logo drawing (vector sharp, high performance)
    // Outer logo container (rounded slate box)
    doc.setFillColor(15, 23, 42); // #0f172a
    doc.roundedRect(14, 12, 14, 14, 3, 3, 'F');

    // Glowing path line (Blue map design)
    doc.setDrawColor(59, 130, 246); // #3b82f6
    doc.setLineWidth(0.8);
    doc.line(17, 21, 21, 16);
    doc.line(21, 16, 25, 20);

    // Delivery node point
    doc.setFillColor(244, 63, 94); // rose-500
    doc.circle(21, 16, 1.2, 'F');
    doc.setFillColor(16, 185, 129); // emerald-500
    doc.circle(25, 20, 1.2, 'F');
  }

  // Logo text & brand branding
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(30, 41, 59); // slate-800
  doc.text('VINIMAP', 32, 19);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(99, 102, 241); // indigo-500
  doc.text('SISTEMA LOGÍSTICO EXPRESS', 32, 23);

  // Document subtitle & metadata (on the right)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  doc.text('RELATÓRIO DE PEDIDOS', 200, 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139); // slate-500
  const now = new Date();
  const dateStr = now.toLocaleDateString('pt-BR');
  const timeStr = now.toLocaleTimeString('pt-BR');
  doc.text(`Extraído em: ${dateStr} às ${timeStr}`, 200, 22);
  doc.text(`Quantidade de Pedidos: ${orders.length}`, 200, 25);

  // A subtle divider line
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.setLineWidth(0.5);
  doc.line(14, 30, 283, 30);

  // Build table data
  const headers = [
    'ID Pedido',
    'Cliente Parceiro',
    'Destinatário',
    'Endereço Completo',
    'Cidade/UF',
    'Valor NF',
    'A Receber',
    'Vlr. Entrega',
    'Status'
  ];

  const tableRows = orders.map(order => {
    const partnerName = resolvePartnerName(order, partnerClients);

    const valNf = order.valorNotaFiscal !== undefined ? `R$ ${order.valorNotaFiscal.toFixed(2).replace('.', ',')}` : 'R$ 0,00';
    const valReceber = order.valorReceber !== undefined ? `R$ ${order.valorReceber.toFixed(2).replace('.', ',')}` : 'R$ 0,00';
    const valEntrega = order.value !== undefined ? `R$ ${order.value.toFixed(2).replace('.', ',')}` : 'R$ 0,00';

    let statusLabel = 'Pendente';
    if (order.status === 'delivered') {
      statusLabel = 'Concluído';
    } else if (order.status === 'in_route') {
      statusLabel = 'Em Rota';
    } else if (order.status === 'pending') {
      statusLabel = 'Pendente';
    } else if (order.status === 'cancelled') {
      statusLabel = 'Cancelado';
    }

    return [
      order.id || '',
      partnerName,
      resolveRecipientName(order, partnerClients),
      order.address || '',
      `${order.cidadeMunicipio || 'São Paulo'}/${order.estado || 'SP'}`,
      valNf,
      valReceber,
      valEntrega,
      statusLabel
    ];
  });

  // Calculations for totals footer
  let totalNf = 0;
  let totalReceber = 0;
  let totalEntrega = 0;

  orders.forEach(order => {
    totalNf += order.valorNotaFiscal || 0;
    totalReceber += order.valorReceber || 0;
    totalEntrega += order.value || 0;
  });

  const totalsRow = [
    'TOTAIS',
    '',
    '',
    '',
    '',
    `R$ ${totalNf.toFixed(2).replace('.', ',')}`,
    `R$ ${totalReceber.toFixed(2).replace('.', ',')}`,
    `R$ ${totalEntrega.toFixed(2).replace('.', ',')}`,
    ''
  ];

  tableRows.push(totalsRow);

  // Render Table using autoTable
  autoTable(doc, {
    head: [headers],
    body: tableRows,
    startY: 33,
    theme: 'grid',
    styles: {
      fontSize: 7.5,
      cellPadding: 1.5,
      valign: 'middle'
    },
    headStyles: {
      fillColor: [37, 99, 235], // blue-600
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center'
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 22 }, // ID Pedido
      1: { cellWidth: 35 },                    // Cliente Parceiro
      2: { cellWidth: 35 },                    // Destinatário
      3: { cellWidth: 65 },                    // Endereço Completo
      4: { cellWidth: 25 },                    // Cidade/UF
      5: { halign: 'right', cellWidth: 22 },   // Valor NF
      6: { halign: 'right', cellWidth: 22 },   // A Receber
      7: { halign: 'right', cellWidth: 22 },   // Vlr. Entrega
      8: { halign: 'center', cellWidth: 20 }   // Status
    },
    didParseCell: (data) => {
      // Highlight the totals row at the bottom
      if (data.row.index === tableRows.length - 1) {
        data.cell.styles.fillColor = [226, 232, 240]; // slate-200
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.textColor = [30, 41, 59]; // slate-800
      }
      
      // Styling for status column cell
      if (data.column.index === 8 && data.row.index < tableRows.length - 1) {
        const text = data.cell.text[0];
        if (text === 'Concluído') {
          data.cell.styles.textColor = [21, 128, 61]; // green-700
          data.cell.styles.fontStyle = 'bold';
        } else if (text === 'Em Rota') {
          data.cell.styles.textColor = [29, 78, 216]; // blue-700
          data.cell.styles.fontStyle = 'bold';
        } else if (text === 'Pendente') {
          data.cell.styles.textColor = [180, 83, 9]; // amber-700
          data.cell.styles.fontStyle = 'bold';
        } else if (text === 'Cancelado') {
          data.cell.styles.textColor = [185, 28, 28]; // red-700
          data.cell.styles.fontStyle = 'bold';
        }
      }
    }
  });

  // Footer page number rendering
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text(`Página ${i} de ${totalPages} • ViniMap Sistema Logístico`, 14, 202);
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  doc.save(`relatorio_faturamento_${todayStr}.pdf`);
}

