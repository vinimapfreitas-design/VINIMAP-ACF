import React, { useState, useEffect, useMemo } from 'react';
import { 
  Wallet, 
  Calendar, 
  Building2, 
  Users, 
  Plus, 
  Trash2, 
  CheckCircle, 
  ArrowUpRight, 
  ArrowDownRight, 
  DollarSign, 
  Filter, 
  RefreshCw, 
  TrendingUp, 
  TrendingDown, 
  X, 
  Check, 
  SlidersHorizontal,
  Briefcase,
  Layers,
  FileSpreadsheet,
  AlertCircle,
  Printer,
  Download,
  FileText,
  Edit,
  Edit3,
  Save,
  Eye,
  Search,
  FileCheck
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  AreaChart,
  Area
} from 'recharts';
import { Order, PartnerClient, Courier, FinanceTransaction, FinancialReport, matchClientCode } from '../types';
import { formatToBrasiliaDate, normalizeIncomingDateToBrasilia } from '../utils/dateUtils';
import { db, isFirestoreQuotaExceeded, handleFirestoreError } from '../lib/firebase';
import { collection, getDocs, doc, setDoc as rawSetDoc, deleteDoc as rawDeleteDoc } from 'firebase/firestore';

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

interface FinanceTabProps {
  orders: Order[];
  partnerClients: PartnerClient[];
  couriers: Courier[];
  onRefetchDatabase?: () => Promise<void>;
}

export default function FinanceTab({ orders, partnerClients, couriers, onRefetchDatabase }: FinanceTabProps) {
  // Dates state
  const [startDateStr, setStartDateStr] = useState<string>(() => {
    // Default to 30 days ago
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [endDateStr, setEndDateStr] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  // Inner tab navigation: 'partners' | 'couriers' | 'bookkeeping' | 'history' | 'reports'
  const [financeSubTab, setFinanceSubTab] = useState<'partners' | 'couriers' | 'bookkeeping' | 'history' | 'reports'>('partners');
  
  // State for selected month in historical breakdown tab
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>('');
  
  // Bookkeeping states
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);
  const [loadingTxs, setLoadingTxs] = useState(false);
  const [isAddingTx, setIsAddingTx] = useState(false);
  
  // Financial Reports CRUD states
  const [savedReports, setSavedReports] = useState<FinancialReport[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [editingReport, setEditingReport] = useState<FinancialReport | null>(null);
  const [viewingReport, setViewingReport] = useState<FinancialReport | null>(null);
  const [reportFilterType, setReportFilterType] = useState<'all' | 'partner' | 'courier'>('all');
  const [reportFilterStatus, setReportFilterStatus] = useState<string>('all');
  const [reportSearch, setReportSearch] = useState<string>('');

  // Report form fields
  const [rfType, setRfType] = useState<'partner' | 'courier'>('partner');
  const [rfTargetId, setRfTargetId] = useState<string>('');
  const [rfTitle, setRfTitle] = useState<string>('');
  const [rfStartDate, setRfStartDate] = useState<string>(startDateStr);
  const [rfEndDate, setRfEndDate] = useState<string>(endDateStr);
  const [rfOrdersCount, setRfOrdersCount] = useState<number>(0);
  const [rfFreight, setRfFreight] = useState<number>(0);
  const [rfAuxiliary, setRfAuxiliary] = useState<number>(0);
  const [rfTotalAmount, setRfTotalAmount] = useState<number>(0);
  const [rfStatus, setRfStatus] = useState<'draft' | 'pending_approval' | 'approved' | 'paid' | 'cancelled'>('draft');
  const [rfNotes, setRfNotes] = useState<string>('');
  const [rfPaymentMethod, setRfPaymentMethod] = useState<string>('Pix');
  const [rfPaymentDate, setRfPaymentDate] = useState<string>('');

  // Transaction form state
  const [txDescription, setTxDescription] = useState('');
  const [txType, setTxType] = useState<'receivable' | 'payable'>('payable');
  const [txAmount, setTxAmount] = useState('');
  const [txDate, setTxDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [txCategory, setTxCategory] = useState('Outros');
  const [txStatus, setTxStatus] = useState<'pending' | 'paid'>('pending');
  const [txPaymentMethod, setTxPaymentMethod] = useState('Pix');
  const [txExpenseNature, setTxExpenseNature] = useState<'fixed' | 'variable'>('variable');
  const [txIsRecurring, setTxIsRecurring] = useState(false);
  const [txRecurringMonths, setTxRecurringMonths] = useState('12');
  const [formError, setFormError] = useState('');

  // Selected details modal
  const [selectedPartnerDetails, setSelectedPartnerDetails] = useState<PartnerClient | null>(null);
  const [selectedCourierDetails, setSelectedCourierDetails] = useState<Courier | null>(null);

  // Fetch transactions on mount & whenever we mutate
  const fetchTransactions = async () => {
    setLoadingTxs(true);
    try {
      const res = await fetch('/api/finance/transactions');
      if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
        const data = await res.json();
        setTransactions(data);
      } else {
        throw new Error('Servidor offline ou não-JSON');
      }
    } catch (err) {
      console.warn('Erro ao buscar transações financeiras (tentando Firestore diretamente):', err);
      if (db) {
        try {
          const colRef = collection(db, 'financeTransactions');
          const snapshot = await getDocs(colRef);
          const txsList: FinanceTransaction[] = [];
          snapshot.forEach(docSnap => {
            const data = docSnap.data();
            txsList.push({
              id: docSnap.id,
              description: data.description || '',
              type: data.type || 'expense',
              amount: Number(data.amount) || 0,
              date: data.date || '',
              category: data.category || '',
              status: data.status || 'pending',
              paymentMethod: data.paymentMethod || '',
              expenseNature: data.expenseNature || 'variable',
              isRecurring: data.isRecurring || false,
              recurrentGroupId: data.recurrentGroupId,
              installmentNumber: data.installmentNumber,
              totalInstallments: data.totalInstallments
            });
          });
          setTransactions(txsList);
        } catch (fsErr) {
          console.error('[Firestore Direct Read Error] Falha ao ler transações do Firestore:', fsErr);
        }
      }
    } finally {
      setLoadingTxs(false);
    }
  };

  const fetchFinancialReports = async () => {
    setLoadingReports(true);
    try {
      const res = await fetch('/api/finance/reports');
      if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
        const data = await res.json();
        setSavedReports(data);
        localStorage.setItem('saved_financial_reports', JSON.stringify(data));
      } else {
        throw new Error('Fallback to local / firestore');
      }
    } catch (err) {
      console.warn('Erro ao buscar relatórios da API (tentando Firestore/localStorage):', err);
      if (db) {
        try {
          const colRef = collection(db, 'financialReports');
          const snapshot = await getDocs(colRef);
          const list: FinancialReport[] = [];
          snapshot.forEach(docSnap => {
            const data = docSnap.data();
            list.push({
              id: docSnap.id,
              type: data.type || 'partner',
              targetId: data.targetId || '',
              targetName: data.targetName || '',
              targetDocument: data.targetDocument || '',
              title: data.title || '',
              startDate: data.startDate || '',
              endDate: data.endDate || '',
              totalOrders: Number(data.totalOrders) || 0,
              totalFreight: Number(data.totalFreight) || 0,
              totalAuxiliary: Number(data.totalAuxiliary) || 0,
              totalAmount: Number(data.totalAmount) || 0,
              status: data.status || 'draft',
              notes: data.notes || '',
              paymentMethod: data.paymentMethod || 'Pix',
              paymentDate: data.paymentDate || '',
              createdAt: data.createdAt || new Date().toISOString(),
              createdBy: data.createdBy || 'Administrador',
              updatedAt: data.updatedAt || new Date().toISOString(),
              updatedBy: data.updatedBy || 'Administrador'
            });
          });
          setSavedReports(list);
          localStorage.setItem('saved_financial_reports', JSON.stringify(list));
        } catch (fsErr) {
          console.error('[Firestore Direct Read Error] Falha ao ler relatórios do Firestore:', fsErr);
          const stored = localStorage.getItem('saved_financial_reports');
          if (stored) {
            try {
              setSavedReports(JSON.parse(stored));
            } catch (e) {}
          }
        }
      } else {
        const stored = localStorage.getItem('saved_financial_reports');
        if (stored) {
          try {
            setSavedReports(JSON.parse(stored));
          } catch (e) {}
        }
      }
    } finally {
      setLoadingReports(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
    fetchFinancialReports();
  }, []);

  // Preset Filters helper
  const applyPreset = (preset: 'last_7' | 'last_15' | 'last_30' | 'this_month' | 'last_month' | 'today') => {
    const today = new Date();
    let start = new Date();
    let end = new Date();

    switch (preset) {
      case 'today':
        break;
      case 'last_7':
        start.setDate(today.getDate() - 7);
        break;
      case 'last_15':
        start.setDate(today.getDate() - 15);
        break;
      case 'last_30':
        start.setDate(today.getDate() - 30);
        break;
      case 'this_month':
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        break;
      case 'last_month':
        start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        end = new Date(today.getFullYear(), today.getMonth(), 0);
        break;
    }

    setStartDateStr(start.toISOString().split('T')[0]);
    setEndDateStr(end.toISOString().split('T')[0]);
  };

  // Robust date parser (handles DD/MM/YYYY and YYYY-MM-DD)
  const parseToDate = (str: string | undefined): Date | null => {
    if (!str) return null;
    const trimmed = str.trim();
    if (trimmed.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      return new Date(trimmed.slice(0, 10));
    }
    if (trimmed.includes('/')) {
      const parts = trimmed.split('/');
      if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1; // 0-indexed
        const year = parseInt(parts[2].length === 2 ? `20${parts[2]}` : parts[2], 10);
        return new Date(year, month, day);
      }
    }
    if (trimmed.includes('-')) {
      const parts = trimmed.split('-');
      if (parts.length === 3) {
        if (parts[0].length === 4) {
          return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        }
      }
    }
    return null;
  };

  // Memoized filtered orders based on selected period
  const filteredOrders = useMemo(() => {
    const startLimit = parseToDate(startDateStr);
    const endLimit = parseToDate(endDateStr);
    
    if (startLimit) startLimit.setHours(0, 0, 0, 0);
    if (endLimit) endLimit.setHours(23, 59, 59, 999);

    return orders.filter(order => {
      if (order.status === 'cancelled') return false;

      let effectiveDateStr = order.dataSolicitacao;
      if (order.history && Array.isArray(order.history)) {
        const entry = [...order.history].reverse().find(h => h && h.status === order.status);
        if (entry && entry.time) {
          const parts = entry.time.split(' ');
          const datePart = parts[0];
          if (datePart) {
            effectiveDateStr = datePart;
          }
        }
      }

      const orderDateObj = parseToDate(effectiveDateStr);
      if (orderDateObj) {
        if (startLimit && orderDateObj < startLimit) return false;
        if (endLimit && orderDateObj > endLimit) return false;
      } else {
        // Fallback for mock orders without explicit request date, assume they fit if active and we have no restrict filters
        // But for strict simulation, we let them pass if they are within standard bounds.
      }
      return true;
    });
  }, [orders, startDateStr, endDateStr]);

  // Memoized filtered transactions for general bookkeeping
  const filteredTransactions = useMemo(() => {
    const startLimit = parseToDate(startDateStr);
    const endLimit = parseToDate(endDateStr);
    
    if (startLimit) startLimit.setHours(0, 0, 0, 0);
    if (endLimit) endLimit.setHours(23, 59, 59, 999);

    return transactions.filter(tx => {
      const txDateObj = parseToDate(tx.date);
      if (txDateObj) {
        if (startLimit && txDateObj < startLimit) return false;
        if (endLimit && txDateObj > endLimit) return false;
      }
      return true;
    });
  }, [transactions, startDateStr, endDateStr]);

  // Calculations for billing per partner
  // Matches orders dynamically
  const partnerBillingList = useMemo(() => {
    return partnerClients.map(partner => {
      const partnerOrders = filteredOrders.filter(order => {
        if (!order.codigoCliente) return false;
        // Case insensitive match
        return order.codigoCliente.trim().toLowerCase() === partner.id.trim().toLowerCase() ||
               order.codigoCliente.toLowerCase().includes(partner.name.toLowerCase()) ||
               partner.name.toLowerCase().includes(order.codigoCliente.toLowerCase());
      });

      const totalValue = partnerOrders.reduce((sum, o) => sum + (o.value || 0), 0);
      const totalReceivable = partnerOrders.reduce((sum, o) => sum + (o.valorReceber || 0), 0);
      const totalNfValue = partnerOrders.reduce((sum, o) => sum + (o.valorNotaFiscal || 0), 0);
      const count = partnerOrders.length;

      return {
        partner,
        totalValue,
        totalReceivable,
        totalNfValue,
        count,
        orders: partnerOrders
      };
    }).sort((a, b) => b.totalValue - a.totalValue);
  }, [partnerClients, filteredOrders]);

  // Extra standalone orders faturamento (not matching any registered partner model)
  const standaloneBilling = useMemo(() => {
    const standaloneOrders = filteredOrders.filter(order => {
      if (!order.codigoCliente) return true;
      // Check if matches any id
      return !partnerClients.some(p => p.id.trim().toLowerCase() === order.codigoCliente?.trim().toLowerCase());
    });

    const totalValue = standaloneOrders.reduce((sum, o) => sum + (o.value || 0), 0);
    const totalReceivable = standaloneOrders.reduce((sum, o) => sum + (o.valorReceber || 0), 0);
    const totalNfValue = standaloneOrders.reduce((sum, o) => sum + (o.valorNotaFiscal || 0), 0);
    const count = standaloneOrders.length;

    return {
      totalValue,
      totalReceivable,
      totalNfValue,
      count,
      orders: standaloneOrders
    };
  }, [partnerClients, filteredOrders]);

  // Calculations for repasse per courier
  const courierRepasseList = useMemo(() => {
    return couriers.map(courier => {
      // Find orders allocated to this courier that were completed/delivered
      const courierOrders = filteredOrders.filter(order => order.courierId === courier.id && order.status !== 'cancelled');
      
      // Calculate repasse using real 'valorCondutor' property or default back to a safe rate if zero/missing
      const totalRepasse = courierOrders.reduce((sum, o) => sum + (o.valorCondutor !== undefined ? o.valorCondutor : 9.50), 0);
      const count = courierOrders.length;

      return {
        courier,
        totalRepasse,
        count,
        orders: courierOrders
      };
    }).sort((a, b) => b.totalRepasse - a.totalRepasse);
  }, [couriers, filteredOrders]);

  // Historical consolidation by period (Month)
  const historicalConsolidation = useMemo(() => {
    const groups: Record<string, {
      periodKey: string; // "YYYY-MM"
      periodLabel: string; // "Junho de 2026"
      ordersCount: number;
      totalFreight: number;
      totalReceivable: number;
      totalRepasse: number;
      totalRevenue: number;
      partnerRows: Array<{
        partnerId: string;
        partnerName: string;
        count: number;
        freight: number;
        receivable: number;
        revenue: number;
      }>;
    }> = {};

    const monthNames = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];

    // For faturamento historico, we process all non-cancelled orders to build complete context
    orders.forEach(order => {
      if (order.status === 'cancelled') return;

      const dateObj = parseToDate(order.dataSolicitacao);
      if (!dateObj) return;

      const year = dateObj.getFullYear();
      const month = dateObj.getMonth();
      const periodKey = `${year}-${String(month + 1).padStart(2, '0')}`;
      const periodLabel = `${monthNames[month]} de ${year}`;

      if (!groups[periodKey]) {
        groups[periodKey] = {
          periodKey,
          periodLabel,
          ordersCount: 0,
          totalFreight: 0,
          totalReceivable: 0,
          totalRepasse: 0,
          totalRevenue: 0,
          partnerRows: []
        };
      }

      const grp = groups[periodKey];
      grp.ordersCount += 1;
      const repasseVal = order.courierId ? (order.valorCondutor !== undefined ? order.valorCondutor : 9.50) : 0;
      grp.totalFreight += (order.value || 0);
      grp.totalReceivable += (order.valorReceber || 0);
      grp.totalRepasse += repasseVal;
      grp.totalRevenue += ((order.value || 0) + (order.valorReceber || 0));
    });

    // Sub-aggregation for partners inside each month
    Object.keys(groups).forEach(periodKey => {
      const grp = groups[periodKey];
      const partnerMap: Record<string, {
        partnerId: string;
        partnerName: string;
        count: number;
        freight: number;
        receivable: number;
        revenue: number;
      }> = {};

      orders.forEach(order => {
        if (order.status === 'cancelled') return;
        const dateObj = parseToDate(order.dataSolicitacao);
        if (!dateObj) return;

        const year = dateObj.getFullYear();
        const month = dateObj.getMonth();
        const key = `${year}-${String(month + 1).padStart(2, '0')}`;
        if (key !== periodKey) return;

        const codCliente = order.codigoCliente?.trim() || '';
        if (codCliente) {
          const matchedPartner = partnerClients.find(p => 
            p.id.trim().toLowerCase() === codCliente.toLowerCase() ||
            p.name.toLowerCase().includes(codCliente.toLowerCase()) ||
            codCliente.toLowerCase().includes(p.name.toLowerCase())
          );

          const pId = matchedPartner ? matchedPartner.id : codCliente;
          const pName = matchedPartner ? matchedPartner.name : codCliente;

          if (!partnerMap[pId]) {
            partnerMap[pId] = {
              partnerId: pId,
              partnerName: pName,
              count: 0,
              freight: 0,
              receivable: 0,
              revenue: 0
            };
          }

          partnerMap[pId].count += 1;
          partnerMap[pId].freight += (order.value || 0);
          partnerMap[pId].receivable += (order.valorReceber || 0);
          partnerMap[pId].revenue += ((order.value || 0) + (order.valorReceber || 0));
        } else {
          const pId = 'STANDALONE';
          const pName = 'Serviços Avulsos / Geral';
          if (!partnerMap[pId]) {
            partnerMap[pId] = {
              partnerId: pId,
              partnerName: pName,
              count: 0,
              freight: 0,
              receivable: 0,
              revenue: 0
            };
          }
          partnerMap[pId].count += 1;
          partnerMap[pId].freight += (order.value || 0);
          partnerMap[pId].receivable += (order.valorReceber || 0);
          partnerMap[pId].revenue += ((order.value || 0) + (order.valorReceber || 0));
        }
      });

      grp.partnerRows = Object.values(partnerMap).sort((a, b) => b.freight - a.freight);
    });

    return Object.values(groups).sort((a, b) => b.periodKey.localeCompare(a.periodKey));
  }, [orders, partnerClients]);

  // Compute Monthly Revenue Growth & profit for chart
  const monthlyRevenueData = useMemo(() => {
    // Sort chronological: older to newer
    const sortedHistory = [...historicalConsolidation].reverse();
    return sortedHistory.map(item => ({
      period: item.periodLabel.split(' de ').map((part, index) => {
        // Just format as "Mês/Ano" or similar short format for readability on X-axis
        if (index === 0) return part.slice(0, 3); // "Jun" instead of "Junho"
        return part;
      }).join('/'),
      revenue: parseFloat(item.totalRevenue.toFixed(2)),
      profit: parseFloat((item.totalRevenue - item.totalRepasse).toFixed(2))
    }));
  }, [historicalConsolidation]);

  // Compute Daily Freight Earnings for chart
  const dailyFreightData = useMemo(() => {
    const dailyMap: Record<string, number> = {};
    
    filteredOrders.forEach(order => {
      let effectiveDateStr = order.dataSolicitacao;
      if (order.history && Array.isArray(order.history)) {
        const entry = [...order.history].reverse().find(h => h && h.status === order.status);
        if (entry && entry.time) {
          const parts = entry.time.split(' ');
          const datePart = parts[0];
          if (datePart) {
            effectiveDateStr = datePart;
          }
        }
      }
      
      const dateObj = parseToDate(effectiveDateStr);
      if (!dateObj) return;
      
      // Format as YYYY-MM-DD for key sorting
      const year = dateObj.getFullYear();
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const day = String(dateObj.getDate()).padStart(2, '0');
      const key = `${year}-${month}-${day}`;
      
      dailyMap[key] = (dailyMap[key] || 0) + (order.value || 0);
    });

    const sortedKeys = Object.keys(dailyMap).sort();
    
    return sortedKeys.map(key => {
      const [year, month, day] = key.split('-');
      return {
        dateKey: key,
        label: `${day}/${month}`,
        earnings: parseFloat(dailyMap[key].toFixed(2))
      };
    });
  }, [filteredOrders]);

  // Find currently active historical month breakdown
  const activeMonthGroup = useMemo(() => {
    if (historicalConsolidation.length === 0) return null;
    const found = historicalConsolidation.find(g => g.periodKey === selectedMonthKey);
    return found || historicalConsolidation[0];
  }, [historicalConsolidation, selectedMonthKey]);

  // General Consolidated KPIs
  const consolidatedStats = useMemo(() => {
    // 1. Receivables:
    // - From partners: sum of 'valorReceber' (or order 'value' as freight rates)
    //   We use order.value as the freight fee billed and valorReceber as supplementary invoices/cash values.
    //   Let's prioritize 'value' for freight billed revenue + manual receivables
    const partnerFreightRevenue = filteredOrders.reduce((sum, o) => sum + (o.value || 0), 0);
    const manualReceivables = filteredTransactions
      .filter(tx => tx.type === 'receivable')
      .reduce((sum, tx) => sum + tx.amount, 0);
    
    const totalReceivables = partnerFreightRevenue + manualReceivables;

    // 2. Payables:
    // - To couriers repasse: sum of 'valorCondutor' of completed orders
    const courierRepasseTotal = filteredOrders.reduce((sum, o) => {
      if (!o.courierId || o.status === 'cancelled') return sum;
      return sum + (o.valorCondutor !== undefined ? o.valorCondutor : 9.50);
    }, 0);
    const manualPayables = filteredTransactions
      .filter(tx => tx.type === 'payable')
      .reduce((sum, tx) => sum + tx.amount, 0);

    const totalPayables = courierRepasseTotal + manualPayables;

    // 3. Balance:
    const netProfit = totalReceivables - totalPayables;
    const margin = totalReceivables > 0 ? (netProfit / totalReceivables) * 100 : 0;

    return {
      partnerFreightRevenue,
      manualReceivables,
      totalReceivables,
      courierRepasseTotal,
      manualPayables,
      totalPayables,
      netProfit,
      margin,
      orderCount: filteredOrders.length
    };
  }, [filteredOrders, filteredTransactions]);

  // Compute fixed vs. variable/mobile expense distribution for the charts
  const expenseDistribution = useMemo(() => {
    const payablesList = filteredTransactions.filter(tx => tx.type === 'payable');
    
    let fixedSum = 0;
    let variableSum = 0;

    payablesList.forEach(tx => {
      if (tx.expenseNature === 'fixed') {
        fixedSum += tx.amount;
      } else {
        variableSum += tx.amount;
      }
    });

    // The courier repasse is inherently a variable expense of our logistical business!
    const repasseSum = filteredOrders.reduce((sum, o) => {
      if (!o.courierId || o.status === 'cancelled') return sum;
      return sum + (o.valorCondutor !== undefined ? o.valorCondutor : 9.50);
    }, 0);
    variableSum += repasseSum;

    const totalCost = fixedSum + variableSum;
    const fixedPercent = totalCost > 0 ? (fixedSum / totalCost) * 100 : 0;
    const variablePercent = totalCost > 0 ? (variableSum / totalCost) * 100 : 0;

    const chartData = [
      { name: 'Despesas Fixas', value: parseFloat(fixedSum.toFixed(2)), color: '#6366f1' },
      { name: 'Despesas Variáveis / Móveis', value: parseFloat(variableSum.toFixed(2)), color: '#f43f5e' }
    ];

    const categoryBreakdown = payablesList.reduce((acc, tx) => {
      const cat = tx.category || 'Outros';
      const label = tx.expenseNature === 'fixed' ? `${cat} (Fixa)` : `${cat} (Móvel)`;
      if (!acc[label]) acc[label] = 0;
      acc[label] += tx.amount;
      return acc;
    }, {} as Record<string, number>);

    // Add courier repasse as a category in variable breakdown
    if (repasseSum > 0) {
      categoryBreakdown['Repasse Condutores (Móvel)'] = repasseSum;
    }

    const breakdownChartData = Object.entries(categoryBreakdown).map(([name, value]) => ({
      name,
      value: parseFloat((value as number).toFixed(2))
    })).sort((a, b) => b.value - a.value);

    return {
      fixedSum,
      variableSum,
      repasseSum,
      totalCost,
      fixedPercent,
      variablePercent,
      chartData,
      breakdownChartData
    };
  }, [filteredTransactions, filteredOrders]);

  // Handle registering a manual bookkeeping transaction
  const handleAddTransactionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!txDescription.trim()) {
      setFormError('Por favor, informe a descrição do lançamento.');
      return;
    }
    const parsedAmount = parseFloat(txAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setFormError('Por favor, informe um valor monetário válido maior que zero.');
      return;
    }

    try {
      const res = await fetch('/api/finance/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: txDescription,
          type: txType,
          amount: parsedAmount,
          date: txDate,
          category: txCategory,
          status: txStatus,
          paymentMethod: txPaymentMethod,
          expenseNature: txExpenseNature,
          isRecurring: txIsRecurring,
          recurringMonths: txIsRecurring ? parseInt(txRecurringMonths) : 1
        })
      });

      if (res.ok) {
        // Reset and refresh
        setTxDescription('');
        setTxAmount('');
        setTxStatus('pending');
        setTxIsRecurring(false);
        setTxExpenseNature('variable');
        setTxRecurringMonths('12');
        setIsAddingTx(false);
        await fetchTransactions();
        if (onRefetchDatabase) await onRefetchDatabase();
      } else {
        const err = await res.json();
        setFormError(err.error || 'Erro ao registrar lançamento.');
      }
    } catch (err) {
      console.warn('Servidor offline ao salvar lançamento. Gravando diretamente na nuvem/local...', err);
      if (db) {
        try {
          const newId = `tx-${Date.now()}`;
          const newTx = {
            id: newId,
            description: txDescription.trim(),
            type: txType,
            amount: parsedAmount,
            date: txDate,
            category: txCategory,
            status: txStatus,
            paymentMethod: txPaymentMethod,
            expenseNature: txExpenseNature,
            isRecurring: txIsRecurring,
            recurrentGroupId: txIsRecurring ? `group-${Date.now()}` : undefined,
            installmentNumber: txIsRecurring ? 1 : undefined,
            totalInstallments: txIsRecurring ? parseInt(txRecurringMonths) : undefined
          };
          await setDoc(doc(db, 'financeTransactions', newId), newTx);
          console.log('[Firestore Direct Write] Lançamento salvo diretamente no Firestore:', newId);
          
          // Reset and refresh
          setTxDescription('');
          setTxAmount('');
          setTxStatus('pending');
          setTxIsRecurring(false);
          setTxExpenseNature('variable');
          setTxRecurringMonths('12');
          setIsAddingTx(false);
          await fetchTransactions();
          if (onRefetchDatabase) await onRefetchDatabase();
          return;
        } catch (fsErr) {
          console.error('[Firestore Direct Write Error] Falha ao salvar no Firestore:', fsErr);
        }
      }
      setFormError('Falha ao acoplar lançamento com o servidor.');
    }
  };

  // Toggle transaction status (Paid / Pending)
  const handleToggleTxStatus = async (tx: FinanceTransaction) => {
    const nextStatus = tx.status === 'paid' ? 'pending' : 'paid';
    try {
      const res = await fetch(`/api/finance/transactions/${tx.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus })
      });
      if (res.ok) {
        await fetchTransactions();
        if (onRefetchDatabase) await onRefetchDatabase();
      } else {
        throw new Error('Servidor indisponível');
      }
    } catch (err) {
      console.warn('Erro ao atualizar status do lançamento, tentando Firestore direto...', err);
      if (db) {
        try {
          await setDoc(doc(db, 'financeTransactions', tx.id), { ...tx, status: nextStatus });
          await fetchTransactions();
          if (onRefetchDatabase) await onRefetchDatabase();
        } catch (fsErr) {
          console.error('[Firestore Direct Update Error]', fsErr);
        }
      }
    }
  };

  // Delete transaction
  const handleDeleteTx = async (id: string, name: string) => {
    if (confirm(`Excluir o lançamento financeiro "${name}" definitivamente do registro?`)) {
      try {
        const res = await fetch(`/api/finance/transactions/${id}`, {
          method: 'DELETE'
        });
        if (res.ok) {
          await fetchTransactions();
          if (onRefetchDatabase) await onRefetchDatabase();
        } else {
          throw new Error('Servidor indisponível');
        }
      } catch (err) {
        console.warn('Erro ao remover transação da API, tentando Firestore direto...', err);
        if (db) {
          try {
            await deleteDoc(doc(db, 'financeTransactions', id));
            await fetchTransactions();
            if (onRefetchDatabase) await onRefetchDatabase();
          } catch (fsErr) {
            console.error('[Firestore Direct Delete Error]', fsErr);
          }
        }
      }
    }
  };

  const formattedCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  // Helper to dynamically adjust column widths based on content size
  const applyOptimalWidth = (ws: XLSX.WorkSheet) => {
    if (!ws['!ref']) return;
    const range = XLSX.utils.decode_range(ws['!ref']);
    const widths = [];
    for (let col = range.s.c; col <= range.e.c; col++) {
      let maxLength = 8;
      for (let row = range.s.r; row <= range.e.r; row++) {
        const cell = ws[XLSX.utils.encode_cell({ r: row, c: col })];
        if (cell && cell.v !== undefined) {
          const strVal = String(cell.v);
          maxLength = Math.max(maxLength, strVal.length);
        }
      }
      widths.push({ wch: maxLength + 3 });
    }
    ws['!cols'] = widths;
  };

  const handleExportToExcel = () => {
    try {
      // 1. Sheet: "Resumo Executivo"
      const sumData = [
        { "Métrica Financeira": "Faturamento Geral de Frete (Clientes)", "Valor (R$)": parseFloat(consolidatedStats.partnerFreightRevenue.toFixed(2)) },
        { "Métrica Financeira": "Receitas Extras Manuais", "Valor (R$)": parseFloat(consolidatedStats.manualReceivables.toFixed(2)) },
        { "Métrica Financeira": "TOTAL ATIVO (Receitas Gerais)", "Valor (R$)": parseFloat(consolidatedStats.totalReceivables.toFixed(2)) },
        { "Métrica Financeira": "Repasse para Condutores (Variável)", "Valor (R$)": parseFloat(consolidatedStats.courierRepasseTotal.toFixed(2)) },
        { "Métrica Financeira": "Despesas Administrativas / Manuais", "Valor (R$)": parseFloat(consolidatedStats.manualPayables.toFixed(2)) },
        { "Métrica Financeira": "TOTAL PASSIVO (Despesas / Custos)", "Valor (R$)": parseFloat(consolidatedStats.totalPayables.toFixed(2)) },
        { "Métrica Financeira": "Saldo Operacional Líquido (DRE)", "Valor (R$)": parseFloat(consolidatedStats.netProfit.toFixed(2)) },
        { "Métrica Financeira": "Margem Líquida Operativa (%)", "Valor (R$)": `${consolidatedStats.margin.toFixed(2)}%` },
        { "Métrica Financeira": "Volume de Entregas no Período", "Valor (R$)": consolidatedStats.orderCount },
        { "Métrica Financeira": "Data Inicial do Filtro", "Valor (R$)": startDateStr },
        { "Métrica Financeira": "Data Final do Filtro", "Valor (R$)": endDateStr }
      ];
      const wsSummary = XLSX.utils.json_to_sheet(sumData);

      // 2. Sheet: "Faturamento Clientes"
      const clientData = [
        ...partnerBillingList.map(item => ({
          "ID / Código": item.partner.id,
          "Nome Fantasia": item.partner.name,
          "Telefone": item.partner.phone || "",
          "Documento / CNPJ": (item.partner as any).cnpj || (item.partner as any).document || "",
          "Volume de Pedidos": item.count,
          "Valor de Fretes": parseFloat(item.totalValue.toFixed(2)),
          "Aditivos / Extras": parseFloat(item.totalReceivable.toFixed(2)),
          "Faturamento Líquido (R$)": parseFloat((item.totalValue + item.totalReceivable).toFixed(2))
        })),
        {
          "ID / Código": "AVULSO / GERAL",
          "Nome Fantasia": "Serviços Avulsos / Logística Geral",
          "Telefone": "-",
          "Documento / CNPJ": "-",
          "Volume de Pedidos": standaloneBilling.count,
          "Valor de Fretes": parseFloat(standaloneBilling.totalValue.toFixed(2)),
          "Aditivos / Extras": parseFloat(standaloneBilling.totalReceivable.toFixed(2)),
          "Faturamento Líquido (R$)": parseFloat((standaloneBilling.totalValue + standaloneBilling.totalReceivable).toFixed(2))
        }
      ];
      const wsClients = XLSX.utils.json_to_sheet(clientData);

      // 3. Sheet: "Custos Repasse Condutores"
      const courierData = courierRepasseList.map(item => ({
        "ID Condutor": item.courier.id,
        "Nome Completo": item.courier.name,
        "Telefone": item.courier.phone || "",
        "Veículo": item.courier.vehicle === 'motorcycle' ? 'Moto' : item.courier.vehicle === 'bicycle' ? 'Bike' : 'Carro/Van',
        "Volume de Pedidos": item.count,
        "Total de Repasse Acumulado (R$)": parseFloat(item.totalRepasse.toFixed(2))
      }));
      const wsCouriers = XLSX.utils.json_to_sheet(courierData);

      // 4. Sheet: "Contas e Lançamentos"
      const bookkeepingData = filteredTransactions.map(tx => ({
        "Vencimento/Data": tx.date.split('-').reverse().join('/'),
        "Natureza do Lançamento": tx.type === 'receivable' ? 'A Receber (Receita)' : 'A Pagar (Despesa)',
        "Categoria": tx.category,
        "Histórico / Descrição": tx.description,
        "Valor do Título (R$)": parseFloat(tx.amount.toFixed(2)),
        "Método de Pagamento": tx.paymentMethod || "Pix",
        "Natureza de Despesa": tx.expenseNature === 'fixed' ? 'Fixa' : tx.type === 'payable' ? 'Variável / Móvel' : 'N/A',
        "Lançamento Recorrente?": tx.isRecurring ? 'Sim' : 'Não',
        "ID Grupo de Repetição": tx.recurrentGroupId || "",
        "Status / Situação": tx.status === 'paid' ? 'Pago / Conciliado' : 'Pendente'
      }));
      const wsBookkeeping = XLSX.utils.json_to_sheet(bookkeepingData);

      applyOptimalWidth(wsSummary);
      applyOptimalWidth(wsClients);
      applyOptimalWidth(wsCouriers);
      applyOptimalWidth(wsBookkeeping);

      // Create Workbook and append drafts
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, wsSummary, "DRE Resumo Executivo");
      XLSX.utils.book_append_sheet(wb, wsClients, "Faturamento Clientes");
      XLSX.utils.book_append_sheet(wb, wsCouriers, "Custos de Repasse");
      XLSX.utils.book_append_sheet(wb, wsBookkeeping, "Livro Auxiliar de Lançamentos");

      // Set Excel Properties
      XLSX.writeFile(wb, `Fechamento_Estudio_Financeiro_${startDateStr}_a_${endDateStr}.xlsx`);
    } catch (e) {
      console.error(e);
      alert("Erro ao compilar e exportar planilha Excel.");
    }
  };

  // ----------------------------------------------------
  // INDIVIDUAL & BATCH EXPORT AND CRUD HELPERS
  // ----------------------------------------------------

  // Export Individual Partner Report (Excel)
  const exportPartnerReportXLSX = (partner: PartnerClient, matchOrders: Order[], totalFreight: number, totalReceivable: number) => {
    try {
      const wb = XLSX.utils.book_new();

      const summaryData = [
        { "Campo": "Código / ID Parceiro", "Valor": partner.id },
        { "Campo": "Nome do Cliente Parceiro", "Valor": partner.name },
        { "Campo": "CNPJ / CPF", "Valor": partner.cnpjCpf || "-" },
        { "Campo": "Telefone / Contato", "Valor": partner.phone || "-" },
        { "Campo": "Email", "Valor": partner.email || "-" },
        { "Campo": "Período de Apuração", "Valor": `${startDateStr.split('-').reverse().join('/')} até ${endDateStr.split('-').reverse().join('/')}` },
        { "Campo": "Total de Entregas / Pedidos", "Valor": matchOrders.length },
        { "Campo": "Tarifas de Frete (R$)", "Valor": parseFloat(totalFreight.toFixed(2)) },
        { "Campo": "Valores Complementares (R$)", "Valor": parseFloat(totalReceivable.toFixed(2)) },
        { "Campo": "FATURAMENTO TOTAL BRUTO (R$)", "Valor": parseFloat((totalFreight + totalReceivable).toFixed(2)) },
        { "Campo": "Ticket Médio por Entrega (R$)", "Valor": matchOrders.length > 0 ? parseFloat((totalFreight / matchOrders.length).toFixed(2)) : 0 },
        { "Campo": "Data de Emissão", "Valor": new Date().toLocaleString('pt-BR') }
      ];
      const wsSummary = XLSX.utils.json_to_sheet(summaryData);

      const ordersData = matchOrders.map(o => ({
        "Pedido ID": o.id,
        "Data / Criação": o.createdAt ? new Date(o.createdAt).toLocaleString('pt-BR') : "-",
        "Destinatário": o.customerName || "-",
        "Endereço": o.address || "-",
        "Bairro / Região": o.region || "-",
        "CEP": o.cep || "-",
        "Status": o.status === 'delivered' ? 'Entregue' : o.status === 'in_route' ? 'Em Rota' : o.status,
        "Frete Cobrado (R$)": parseFloat((o.value || 0).toFixed(2)),
        "Valor Complementar (R$)": parseFloat((o.valorReceber || 0).toFixed(2)),
        "Total do Pedido (R$)": parseFloat(((o.value || 0) + (o.valorReceber || 0)).toFixed(2))
      }));
      const wsOrders = XLSX.utils.json_to_sheet(ordersData);

      applyOptimalWidth(wsSummary);
      applyOptimalWidth(wsOrders);

      XLSX.utils.book_append_sheet(wb, wsSummary, "Resumo Fechamento");
      XLSX.utils.book_append_sheet(wb, wsOrders, "Detalhamento Pedidos");

      const safeName = (partner.name || 'Parceiro').replace(/[^a-zA-Z0-9_-]/g, '_');
      XLSX.writeFile(wb, `Relatorio_Financeiro_Parceiro_${safeName}_${startDateStr}_a_${endDateStr}.xlsx`);
    } catch (err) {
      console.error('Erro ao exportar relatório do parceiro:', err);
      alert('Erro ao exportar relatório em Excel.');
    }
  };

  // Export Individual Partner Report (CSV)
  const exportPartnerReportCSV = (partner: PartnerClient, matchOrders: Order[]) => {
    const headers = ['Pedido ID', 'Data', 'Destinatario', 'Endereco', 'Bairro', 'CEP', 'Status', 'Frete (R$)', 'Complementar (R$)', 'Total (R$)'];
    const rows = matchOrders.map(o => [
      `"${o.id}"`,
      `"${o.createdAt ? new Date(o.createdAt).toLocaleDateString('pt-BR') : '-'}"`,
      `"${(o.customerName || '').replace(/"/g, '""')}"`,
      `"${(o.address || '').replace(/"/g, '""')}"`,
      `"${(o.region || '').replace(/"/g, '""')}"`,
      `"${o.cep || ''}"`,
      `"${o.status}"`,
      (o.value || 0).toFixed(2).replace('.', ','),
      (o.valorReceber || 0).toFixed(2).replace('.', ','),
      ((o.value || 0) + (o.valorReceber || 0)).toFixed(2).replace('.', ',')
    ]);

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Relatorio_Parceiro_${(partner.name || 'Parceiro').replace(/[^a-zA-Z0-9_-]/g, '_')}_${startDateStr}_a_${endDateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export All Partners Consolidated Report (Excel)
  const exportAllPartnersReportXLSX = () => {
    try {
      const wb = XLSX.utils.book_new();

      const partnersSummary = partnerBillingList.map(item => ({
        "ID": item.partner.id,
        "Nome do Parceiro": item.partner.name,
        "CNPJ / CPF": item.partner.cnpjCpf || "-",
        "Telefone": item.partner.phone || "-",
        "Volume de Pedidos": item.count,
        "Tarifa de Frete (R$)": parseFloat(item.totalValue.toFixed(2)),
        "Valores Complementares (R$)": parseFloat(item.totalReceivable.toFixed(2)),
        "Faturamento Total (R$)": parseFloat((item.totalValue + item.totalReceivable).toFixed(2)),
        "Ticket Médio (R$)": item.count > 0 ? parseFloat((item.totalValue / item.count).toFixed(2)) : 0
      }));
      const wsSummary = XLSX.utils.json_to_sheet(partnersSummary);

      const allPartnerOrders = filteredOrders.map(o => ({
        "Pedido ID": o.id,
        "Código Parceiro": o.codigoCliente || "Avulso",
        "Data": o.createdAt ? new Date(o.createdAt).toLocaleDateString('pt-BR') : "-",
        "Destinatário": o.customerName || "-",
        "Endereço": o.address || "-",
        "Bairro": o.region || "-",
        "CEP": o.cep || "-",
        "Status": o.status,
        "Frete Cobrado (R$)": parseFloat((o.value || 0).toFixed(2)),
        "Complementar (R$)": parseFloat((o.valorReceber || 0).toFixed(2)),
        "Total (R$)": parseFloat(((o.value || 0) + (o.valorReceber || 0)).toFixed(2))
      }));
      const wsOrders = XLSX.utils.json_to_sheet(allPartnerOrders);

      applyOptimalWidth(wsSummary);
      applyOptimalWidth(wsOrders);

      XLSX.utils.book_append_sheet(wb, wsSummary, "Consolidado Parceiros");
      XLSX.utils.book_append_sheet(wb, wsOrders, "Lista de Pedidos Geral");

      XLSX.writeFile(wb, `Relatorio_Geral_Parceiros_${startDateStr}_a_${endDateStr}.xlsx`);
    } catch (err) {
      console.error(err);
      alert('Erro ao exportar relatório consolidado dos parceiros.');
    }
  };

  // Export Individual Courier Repasse Report (Excel)
  const exportCourierReportXLSX = (courier: Courier, matchOrders: Order[], totalRepasse: number) => {
    try {
      const wb = XLSX.utils.book_new();

      const summaryData = [
        { "Campo": "ID / Matrícula Condutor", "Valor": courier.id },
        { "Campo": "Nome Completo", "Valor": courier.name },
        { "Campo": "Telefone", "Valor": courier.phone || "-" },
        { "Campo": "Veículo / Modal", "Valor": courier.vehicle === 'motorcycle' ? 'Moto' : courier.vehicle === 'bicycle' ? 'Bicicleta' : 'Carro / Van' },
        { "Campo": "Placa do Veículo", "Valor": courier.plate || "-" },
        { "Campo": "Período de Apuração", "Valor": `${startDateStr.split('-').reverse().join('/')} até ${endDateStr.split('-').reverse().join('/')}` },
        { "Campo": "Total de Entregas Realizadas", "Valor": matchOrders.length },
        { "Campo": "VALOR TOTAL DE REPASSE A PAGAR (R$)", "Valor": parseFloat(totalRepasse.toFixed(2)) },
        { "Campo": "Média por Entrega (R$)", "Valor": matchOrders.length > 0 ? parseFloat((totalRepasse / matchOrders.length).toFixed(2)) : 0 },
        { "Campo": "Data de Fechamento", "Valor": new Date().toLocaleString('pt-BR') }
      ];
      const wsSummary = XLSX.utils.json_to_sheet(summaryData);

      const deliveriesData = matchOrders.map(o => {
        const valorCondutor = o.valorCondutor !== undefined ? o.valorCondutor : 9.50;
        const partnerObj = partnerClients.find(p => matchClientCode(p.id, o.codigoCliente));
        const partnerName = partnerObj ? ` (${partnerObj.name})` : '';
        const orderDate = o.dataSolicitacao 
          ? normalizeIncomingDateToBrasilia(o.dataSolicitacao) 
          : (o.createdAt ? formatToBrasiliaDate(new Date(o.createdAt)) : "-");
        const statusPTBR = o.status === 'delivered' ? 'Entregue' :
                           o.status === 'in_route' ? 'Em Rota' :
                           o.status === 'pending' ? 'Pendente' :
                           o.status === 'in_progress' ? 'Em Andamento' :
                           o.status === 'failure' ? 'Ocorrência' :
                           o.status === 'cancelled' ? 'Cancelado' : (o.status || 'Pendente');
        const procurarPor = o.procurarPor || o.customerName || "-";
        const destinatario = o.customerName || o.procurarPor || "-";
        const fullAddress = o.address ? `${o.address}${o.region ? ` - ${o.region}` : ''}` : (o.region || "-");

        return {
          "Pedido ID": o.id,
          "Data do Pedido": orderDate,
          "Cliente Origem": `${o.codigoCliente || "Avulso"}${partnerName}`,
          "Procurar Por": procurarPor,
          "Destinatário": destinatario,
          "Endereço": fullAddress,
          "Status": statusPTBR,
          "Repasse Condutor (R$)": parseFloat(valorCondutor.toFixed(2))
        };
      });
      const wsDeliveries = XLSX.utils.json_to_sheet(deliveriesData);

      applyOptimalWidth(wsSummary);
      applyOptimalWidth(wsDeliveries);

      XLSX.utils.book_append_sheet(wb, wsSummary, "Resumo Repasse");
      XLSX.utils.book_append_sheet(wb, wsDeliveries, "Entregas Realizadas");

      const safeName = (courier.name || 'Condutor').replace(/[^a-zA-Z0-9_-]/g, '_');
      XLSX.writeFile(wb, `Extrato_Repasse_Condutor_${safeName}_${startDateStr}_a_${endDateStr}.xlsx`);
    } catch (err) {
      console.error('Erro ao exportar extrato do condutor:', err);
      alert('Erro ao exportar extrato em Excel.');
    }
  };

  // Export Individual Courier Repasse Report (CSV)
  const exportCourierReportCSV = (courier: Courier, matchOrders: Order[]) => {
    const headers = ['Pedido ID', 'Data do Pedido', 'Cliente Origem', 'Procurar Por', 'Destinatario', 'Endereco', 'Status', 'Repasse Condutor (R$)'];
    const rows = matchOrders.map(o => {
      const valorCondutor = o.valorCondutor !== undefined ? o.valorCondutor : 9.50;
      const partnerObj = partnerClients.find(p => matchClientCode(p.id, o.codigoCliente));
      const partnerName = partnerObj ? ` (${partnerObj.name})` : '';
      const orderDate = o.dataSolicitacao 
        ? normalizeIncomingDateToBrasilia(o.dataSolicitacao) 
        : (o.createdAt ? formatToBrasiliaDate(new Date(o.createdAt)) : "-");
      const statusPTBR = o.status === 'delivered' ? 'Entregue' :
                         o.status === 'in_route' ? 'Em Rota' :
                         o.status === 'pending' ? 'Pendente' :
                         o.status === 'in_progress' ? 'Em Andamento' :
                         o.status === 'failure' ? 'Ocorrencia' :
                         o.status === 'cancelled' ? 'Cancelado' : (o.status || 'Pendente');
      const procurarPor = o.procurarPor || o.customerName || "-";
      const destinatario = o.customerName || o.procurarPor || "-";
      const fullAddress = o.address ? `${o.address}${o.region ? ` - ${o.region}` : ''}` : (o.region || "-");

      return [
        `"${o.id}"`,
        `"${orderDate}"`,
        `"${(o.codigoCliente || 'Avulso') + partnerName}"`,
        `"${procurarPor.replace(/"/g, '""')}"`,
        `"${destinatario.replace(/"/g, '""')}"`,
        `"${fullAddress.replace(/"/g, '""')}"`,
        `"${statusPTBR}"`,
        valorCondutor.toFixed(2).replace('.', ',')
      ];
    });

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Extrato_Repasse_Condutor_${(courier.name || 'Condutor').replace(/[^a-zA-Z0-9_-]/g, '_')}_${startDateStr}_a_${endDateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export All Couriers Consolidated Report (Excel)
  const exportAllCouriersReportXLSX = () => {
    try {
      const wb = XLSX.utils.book_new();

      const couriersSummary = courierRepasseList.map(item => ({
        "ID": item.courier.id,
        "Nome do Condutor": item.courier.name,
        "Telefone": item.courier.phone || "-",
        "Veículo": item.courier.vehicle,
        "Total de Entregas": item.count,
        "Total de Repasse Devido (R$)": parseFloat(item.totalRepasse.toFixed(2)),
        "Média por Corrida (R$)": item.count > 0 ? parseFloat((item.totalRepasse / item.count).toFixed(2)) : 0
      }));
      const wsSummary = XLSX.utils.json_to_sheet(couriersSummary);

      const allCourierOrders = filteredOrders.filter(o => o.courierId && o.status !== 'cancelled').map(o => {
        const c = couriers.find(cr => cr.id === o.courierId);
        const valorCondutor = o.valorCondutor !== undefined ? o.valorCondutor : 9.50;
        return {
          "Pedido ID": o.id,
          "Condutor": c ? c.name : o.courierId,
          "Origem / Cliente": o.codigoCliente || "Avulso",
          "Destinatário": o.customerName || "-",
          "Bairro": o.region || "-",
          "Status": o.status,
          "Valor Repasse (R$)": parseFloat(valorCondutor.toFixed(2))
        };
      });
      const wsDeliveries = XLSX.utils.json_to_sheet(allCourierOrders);

      applyOptimalWidth(wsSummary);
      applyOptimalWidth(wsDeliveries);

      XLSX.utils.book_append_sheet(wb, wsSummary, "Consolidado Condutores");
      XLSX.utils.book_append_sheet(wb, wsDeliveries, "Todas as Entregas");

      XLSX.writeFile(wb, `Relatorio_Geral_Condutores_${startDateStr}_a_${endDateStr}.xlsx`);
    } catch (err) {
      console.error(err);
      alert('Erro ao exportar relatório consolidado de condutores.');
    }
  };

  // Print Partner Report
  const printPartnerReport = (partner: PartnerClient, matchOrders: Order[], totalFreight: number, totalReceivable: number) => {
    const safePartnerName = partner.name || 'Parceiro';
    const rowsHtml = matchOrders.map(o => `
      <tr>
        <td style="font-family: monospace; font-weight: bold; color: #4338ca;">${o.id}</td>
        <td>${o.createdAt ? new Date(o.createdAt).toLocaleDateString('pt-BR') : '-'}</td>
        <td>${o.customerName || '-'}</td>
        <td>${o.address || '-'}, ${o.region || ''}</td>
        <td>${o.status}</td>
        <td style="text-align: right; font-family: monospace;">${formattedCurrency(o.value || 0)}</td>
        <td style="text-align: right; font-family: monospace;">${formattedCurrency(o.valorReceber || 0)}</td>
        <td style="text-align: right; font-weight: bold; font-family: monospace;">${formattedCurrency((o.value || 0) + (o.valorReceber || 0))}</td>
      </tr>
    `).join('');

    const html = `
      <div class="header">
        <div>
          <div class="title">FECHAMENTO FINANCEIRO - CLIENTE PARCEIRO</div>
          <div class="meta"><strong>Parceiro:</strong> ${safePartnerName} (${partner.id})</div>
          <div class="meta"><strong>CNPJ/CPF:</strong> ${partner.cnpjCpf || 'Não informado'} | <strong>Telefone:</strong> ${partner.phone || '-'}</div>
          <div class="meta"><strong>Período de Apuração:</strong> ${startDateStr.split('-').reverse().join('/')} até ${endDateStr.split('-').reverse().join('/')}</div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 14px; font-weight: bold; color: #4338ca;">VINIMAP EXPRESS</div>
          <div class="meta">Emissão: ${new Date().toLocaleString('pt-BR')}</div>
        </div>
      </div>

      <div class="kpis">
        <div class="kpi-card">
          <div class="kpi-label">Volume de Entregas</div>
          <div class="kpi-value">${matchOrders.length}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Tarifas de Frete</div>
          <div class="kpi-value">${formattedCurrency(totalFreight)}</div>
        </div>
        <div class="kpi-card" style="background: #eef2ff; border-color: #c7d2fe;">
          <div class="kpi-label" style="color: #4338ca;">Faturamento Total Consolidado</div>
          <div class="kpi-value" style="color: #312e81;">${formattedCurrency(totalFreight + totalReceivable)}</div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Pedido</th>
            <th>Data</th>
            <th>Destinatário</th>
            <th>Endereço / Bairro</th>
            <th>Status</th>
            <th style="text-align: right;">Frete</th>
            <th style="text-align: right;">Adicional</th>
            <th style="text-align: right;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml || '<tr><td colspan="8" style="text-align: center; padding: 20px;">Nenhum pedido registrado no período</td></tr>'}
        </tbody>
      </table>

      <div class="signatures">
        <div class="sig-line">Responsável Financeiro (Vinimap)</div>
        <div class="sig-line">Aceite Cliente (${safePartnerName})</div>
      </div>
    `;

    const printWin = window.open('', '_blank');
    if (printWin) {
      printWin.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Fechamento_${safePartnerName}</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 24px; color: #1e293b; font-size: 12px; }
              .header { display: flex; justify-content: space-between; border-bottom: 2px solid #4338ca; padding-bottom: 12px; margin-bottom: 16px; }
              .title { font-size: 16px; font-weight: bold; color: #1e293b; }
              .meta { font-size: 11px; color: #64748b; margin-top: 3px; }
              .kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 16px; }
              .kpi-card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; background: #f8fafc; }
              .kpi-label { font-size: 9px; text-transform: uppercase; color: #64748b; font-weight: bold; letter-spacing: 0.5px; }
              .kpi-value { font-size: 16px; font-weight: bold; color: #0f172a; margin-top: 2px; font-family: monospace; }
              table { width: 100%; border-collapse: collapse; margin-top: 12px; }
              th { background: #f1f5f9; text-align: left; padding: 7px 10px; font-size: 10px; text-transform: uppercase; color: #475569; border-bottom: 1px solid #cbd5e1; }
              td { padding: 7px 10px; border-bottom: 1px solid #f1f5f9; font-size: 11px; }
              .signatures { display: flex; justify-content: space-between; margin-top: 48px; padding-top: 16px; }
              .sig-line { width: 220px; border-top: 1px solid #000; text-align: center; font-size: 11px; padding-top: 6px; }
              @media print {
                body { padding: 0; }
                @page { margin: 1cm; size: portrait; }
              }
            </style>
          </head>
          <body>
            ${html}
            <script>window.onload = function() { window.print(); };</script>
          </body>
        </html>
      `);
      printWin.document.close();
    }
  };

  // Print Courier Repasse Voucher
  const printCourierReport = (courier: Courier, matchOrders: Order[], totalRepasse: number) => {
    const rowsHtml = matchOrders.map(o => {
      const valorCondutor = o.valorCondutor !== undefined ? o.valorCondutor : 9.50;
      const partnerObj = partnerClients.find(p => matchClientCode(p.id, o.codigoCliente));
      const partnerName = partnerObj ? ` (${partnerObj.name})` : '';
      const orderDate = o.dataSolicitacao 
        ? normalizeIncomingDateToBrasilia(o.dataSolicitacao) 
        : (o.createdAt ? formatToBrasiliaDate(new Date(o.createdAt)) : '-');
      const statusPTBR = o.status === 'delivered' ? 'Entregue' :
                         o.status === 'in_route' ? 'Em Rota' :
                         o.status === 'pending' ? 'Pendente' :
                         o.status === 'in_progress' ? 'Em Andamento' :
                         o.status === 'failure' ? 'Ocorrência' :
                         o.status === 'cancelled' ? 'Cancelado' : (o.status || 'Pendente');
      const procurarPor = o.procurarPor || o.customerName || '-';
      const destinatario = o.customerName || o.procurarPor || '-';
      const fullAddress = o.address ? `${o.address}${o.region ? ` - ${o.region}` : ''}` : (o.region || '-');

      return `
        <tr>
          <td style="font-family: monospace; font-weight: bold; color: #0284c7;">${o.id}</td>
          <td>${orderDate}</td>
          <td>${o.codigoCliente || 'Avulso'}${partnerName}</td>
          <td>${procurarPor}</td>
          <td><strong>${destinatario}</strong></td>
          <td>${fullAddress}</td>
          <td>${statusPTBR}</td>
          <td style="text-align: right; font-weight: bold; font-family: monospace; color: #e11d48;">${formattedCurrency(valorCondutor)}</td>
        </tr>
      `;
    }).join('');

    const html = `
      <div class="header">
        <div>
          <div class="title">EXTRATO DE REPASSE OPERACIONAL - CONDUTOR</div>
          <div class="meta"><strong>Condutor:</strong> ${courier.name} (${courier.id})</div>
          <div class="meta"><strong>Telefone:</strong> ${courier.phone || '-'} | <strong>Veículo:</strong> ${courier.vehicle} | <strong>Placa:</strong> ${courier.plate || '-'}</div>
          <div class="meta"><strong>Período de Apuração:</strong> ${startDateStr.split('-').reverse().join('/')} até ${endDateStr.split('-').reverse().join('/')}</div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 14px; font-weight: bold; color: #0284c7;">VINIMAP EXPRESS</div>
          <div class="meta">Emissão: ${new Date().toLocaleString('pt-BR')}</div>
        </div>
      </div>

      <div class="kpis">
        <div class="kpi-card">
          <div class="kpi-label">Total de Entregas Realizadas</div>
          <div class="kpi-value">${matchOrders.length}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Média por Corrida</div>
          <div class="kpi-value">${formattedCurrency(matchOrders.length > 0 ? totalRepasse / matchOrders.length : 0)}</div>
        </div>
        <div class="kpi-card" style="background: #fff1f2; border-color: #fecdd3;">
          <div class="kpi-label" style="color: #be123c;">TOTAL DE REPASSE A PAGAR</div>
          <div class="kpi-value" style="color: #9f1239;">${formattedCurrency(totalRepasse)}</div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Pedido ID</th>
            <th>Data do Pedido</th>
            <th>Cliente Origem</th>
            <th>Procurar Por</th>
            <th>Destinatário</th>
            <th>Endereço</th>
            <th>Status</th>
            <th style="text-align: right;">Repasse Condutor</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml || '<tr><td colspan="8" style="text-align: center; padding: 20px;">Nenhuma entrega registrada no período</td></tr>'}
        </tbody>
      </table>

      <div class="signatures">
        <div class="sig-line">Administração Vinimap Express</div>
        <div class="sig-line">Recebido por: ${courier.name}</div>
      </div>
    `;

    const printWin = window.open('', '_blank');
    if (printWin) {
      printWin.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Extrato_Repasse_${courier.name.replace(/\s+/g, '_')}</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 24px; color: #1e293b; font-size: 12px; }
              .header { display: flex; justify-content: space-between; border-bottom: 2px solid #0284c7; padding-bottom: 12px; margin-bottom: 16px; }
              .title { font-size: 16px; font-weight: bold; color: #1e293b; }
              .meta { font-size: 11px; color: #64748b; margin-top: 3px; }
              .kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 16px; }
              .kpi-card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; background: #f8fafc; }
              .kpi-label { font-size: 9px; text-transform: uppercase; color: #64748b; font-weight: bold; letter-spacing: 0.5px; }
              .kpi-value { font-size: 16px; font-weight: bold; color: #0f172a; margin-top: 2px; font-family: monospace; }
              table { width: 100%; border-collapse: collapse; margin-top: 12px; }
              th { background: #f1f5f9; text-align: left; padding: 7px 10px; font-size: 10px; text-transform: uppercase; color: #475569; border-bottom: 1px solid #cbd5e1; }
              td { padding: 7px 10px; border-bottom: 1px solid #f1f5f9; font-size: 11px; }
              .signatures { display: flex; justify-content: space-between; margin-top: 48px; padding-top: 16px; }
              .sig-line { width: 220px; border-top: 1px solid #000; text-align: center; font-size: 11px; padding-top: 6px; }
              @media print {
                body { padding: 0; }
                @page { margin: 1cm; size: portrait; }
              }
            </style>
          </head>
          <body>
            ${html}
            <script>window.onload = function() { window.print(); };</script>
          </body>
        </html>
      `);
      printWin.document.close();
    }
  };

  // Export Saved Report (Excel)
  const exportSavedReportXLSX = (report: FinancialReport) => {
    try {
      const wb = XLSX.utils.book_new();

      const summaryData = [
        { "Campo": "Código do Fechamento", "Valor": report.id },
        { "Campo": "Título", "Valor": report.title },
        { "Campo": "Tipo", "Valor": report.type === 'partner' ? 'Faturamento de Parceiro' : 'Repasse a Condutor' },
        { "Campo": "Entidade / Beneficiário", "Valor": report.targetName },
        { "Campo": "Documento", "Valor": report.targetDocument || "-" },
        { "Campo": "Data Inicial", "Valor": report.startDate },
        { "Campo": "Data Final", "Valor": report.endDate },
        { "Campo": "Volume de Pedidos", "Valor": report.totalOrders },
        { "Campo": "Valor de Frete (R$)", "Valor": report.totalFreight },
        { "Campo": "Ajustes / Complementares (R$)", "Valor": report.totalAuxiliary },
        { "Campo": "VALOR TOTAL CONSOLIDADO (R$)", "Valor": report.totalAmount },
        { "Campo": "Status Atual", "Valor": report.status },
        { "Campo": "Forma de Pagamento", "Valor": report.paymentMethod || "-" },
        { "Campo": "Data de Quitação / Pagamento", "Valor": report.paymentDate || "-" },
        { "Campo": "Observações", "Valor": report.notes || "-" },
        { "Campo": "Data de Registro", "Valor": new Date(report.createdAt).toLocaleString('pt-BR') }
      ];
      const wsSummary = XLSX.utils.json_to_sheet(summaryData);
      applyOptimalWidth(wsSummary);
      XLSX.utils.book_append_sheet(wb, wsSummary, "Fechamento");

      const safeTitle = (report.title || 'Relatorio').replace(/[^a-zA-Z0-9_-]/g, '_');
      XLSX.writeFile(wb, `${safeTitle}.xlsx`);
    } catch (err) {
      console.error(err);
      alert('Erro ao exportar fechamento.');
    }
  };

  // Export Saved Report (CSV)
  const exportSavedReportCSV = (report: FinancialReport) => {
    const headers = ['Campo', 'Valor'];
    const rows = [
      ['ID', report.id],
      ['Titulo', `"${(report.title || '').replace(/"/g, '""')}"`],
      ['Tipo', report.type === 'partner' ? 'Parceiro' : 'Condutor'],
      ['Entidade', `"${(report.targetName || '').replace(/"/g, '""')}"`],
      ['Documento', `"${(report.targetDocument || '').replace(/"/g, '""')}"`],
      ['Periodo', `"${report.startDate} ate ${report.endDate}"`],
      ['Total Pedidos', String(report.totalOrders)],
      ['Frete (R$)', report.totalFreight.toFixed(2).replace('.', ',')],
      ['Ajustes (R$)', report.totalAuxiliary.toFixed(2).replace('.', ',')],
      ['Total Final (R$)', report.totalAmount.toFixed(2).replace('.', ',')],
      ['Status', report.status],
      ['Forma de Pagamento', `"${report.paymentMethod || ''}"`],
      ['Data Pagamento', `"${report.paymentDate || ''}"`],
      ['Observacoes', `"${(report.notes || '').replace(/"/g, '""')}"`]
    ];

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${(report.title || 'Relatorio').replace(/[^a-zA-Z0-9_-]/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print Saved Report
  const printSavedReport = (report: FinancialReport) => {
    const statusLabel = report.status === 'paid' ? 'PAGO / LIQUIDADO' :
                        report.status === 'approved' ? 'APROVADO' :
                        report.status === 'pending_approval' ? 'PENDENTE DE APROVAÇÃO' :
                        report.status === 'cancelled' ? 'CANCELADO' : 'RASCUNHO';

    const html = `
      <div class="header">
        <div>
          <div class="title">${report.title}</div>
          <div class="meta"><strong>Tipo:</strong> ${report.type === 'partner' ? 'Faturamento de Cliente Parceiro' : 'Extrato de Repasse a Condutor'}</div>
          <div class="meta"><strong>Entidade:</strong> ${report.targetName} | <strong>Doc:</strong> ${report.targetDocument || '-'}</div>
          <div class="meta"><strong>Período:</strong> ${report.startDate.split('-').reverse().join('/')} até ${report.endDate.split('-').reverse().join('/')}</div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 14px; font-weight: bold; color: #4338ca;">VINIMAP EXPRESS</div>
          <div class="meta">Status: <strong style="color: ${report.status === 'paid' ? '#059669' : '#4338ca'}">${statusLabel}</strong></div>
          <div class="meta">Emitido em: ${new Date(report.createdAt).toLocaleString('pt-BR')}</div>
        </div>
      </div>

      <div class="kpis">
        <div class="kpi-card">
          <div class="kpi-label">Volume de Entregas</div>
          <div class="kpi-value">${report.totalOrders}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Tarifas de Frete</div>
          <div class="kpi-value">${formattedCurrency(report.totalFreight)}</div>
        </div>
        <div class="kpi-card" style="background: #eef2ff; border-color: #c7d2fe;">
          <div class="kpi-label" style="color: #4338ca;">VALOR TOTAL CONSOLIDADO</div>
          <div class="kpi-value" style="color: #312e81;">${formattedCurrency(report.totalAmount)}</div>
        </div>
      </div>

      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; margin-top: 16px;">
        <h4 style="margin: 0 0 8px 0; font-size: 12px; color: #334155; text-transform: uppercase;">Dados de Liquidação</h4>
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; font-size: 11px;">
          <div><strong>Forma de Pagamento:</strong> ${report.paymentMethod || 'Pix'}</div>
          <div><strong>Data de Pagamento:</strong> ${report.paymentDate ? report.paymentDate.split('-').reverse().join('/') : 'Em aberto'}</div>
          <div style="grid-column: span 2;"><strong>Observações / Notas:</strong> ${report.notes || 'Sem observações registradas.'}</div>
        </div>
      </div>

      <div class="signatures">
        <div class="sig-line">Gestor Financeiro (Vinimap)</div>
        <div class="sig-line">Assinatura do Beneficiário</div>
      </div>
    `;

    const printWin = window.open('', '_blank');
    if (printWin) {
      printWin.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>${report.title}</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 24px; color: #1e293b; font-size: 12px; }
              .header { display: flex; justify-content: space-between; border-bottom: 2px solid #4338ca; padding-bottom: 12px; margin-bottom: 16px; }
              .title { font-size: 16px; font-weight: bold; color: #1e293b; }
              .meta { font-size: 11px; color: #64748b; margin-top: 3px; }
              .kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 16px; }
              .kpi-card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; background: #f8fafc; }
              .kpi-label { font-size: 9px; text-transform: uppercase; color: #64748b; font-weight: bold; }
              .kpi-value { font-size: 16px; font-weight: bold; color: #0f172a; margin-top: 2px; font-family: monospace; }
              .signatures { display: flex; justify-content: space-between; margin-top: 60px; padding-top: 16px; }
              .sig-line { width: 220px; border-top: 1px solid #000; text-align: center; font-size: 11px; padding-top: 6px; }
              @media print {
                body { padding: 0; }
                @page { margin: 1.5cm; }
              }
            </style>
          </head>
          <body>
            ${html}
            <script>window.onload = function() { window.print(); };</script>
          </body>
        </html>
      `);
      printWin.document.close();
    }
  };

  // CRUD Handler: Calculate report values based on target & dates
  const calculateReportMetrics = (type: 'partner' | 'courier', targetId: string, start: string, end: string) => {
    const ordersInPeriod = orders.filter(o => {
      if (o.status === 'cancelled') return false;
      const orderDate = o.createdAt ? o.createdAt.split('T')[0] : '';
      if (!orderDate) return false;
      return orderDate >= start && orderDate <= end;
    });

    if (type === 'partner') {
      const matchOrders = ordersInPeriod.filter(o => {
        if (targetId === 'avulso') {
          if (!o.codigoCliente) return true;
          return !partnerClients.some(p => p.id.trim().toLowerCase() === o.codigoCliente?.trim().toLowerCase());
        }
        if (!o.codigoCliente) return false;
        const p = partnerClients.find(client => client.id === targetId);
        const pName = p ? p.name.toLowerCase() : '';
        return o.codigoCliente.trim().toLowerCase() === targetId.trim().toLowerCase() ||
               (pName && o.codigoCliente.toLowerCase().includes(pName));
      });

      const freight = matchOrders.reduce((sum, o) => sum + (o.value || 0), 0);
      const auxiliary = matchOrders.reduce((sum, o) => sum + (o.valorReceber || 0), 0);
      return { count: matchOrders.length, freight, auxiliary, total: freight + auxiliary };
    } else {
      const matchOrders = ordersInPeriod.filter(o => o.courierId === targetId);
      const totalRepasse = matchOrders.reduce((sum, o) => sum + (o.valorCondutor !== undefined ? o.valorCondutor : 9.50), 0);
      return { count: matchOrders.length, freight: totalRepasse, auxiliary: 0, total: totalRepasse };
    }
  };

  // CRUD: Open Create modal
  const handleOpenCreateReport = (defaultType: 'partner' | 'courier' = 'partner', defaultTargetId?: string) => {
    setEditingReport(null);
    setRfType(defaultType);
    const initialTargetId = defaultTargetId || (defaultType === 'partner' ? (partnerClients[0]?.id || 'avulso') : (couriers[0]?.id || ''));
    setRfTargetId(initialTargetId);
    setRfStartDate(startDateStr);
    setRfEndDate(endDateStr);

    let targetName = 'Parceiro';
    if (defaultType === 'partner') {
      const p = partnerClients.find(c => c.id === initialTargetId);
      targetName = p ? p.name : (initialTargetId === 'avulso' ? 'Serviços Avulsos' : 'Parceiro');
    } else {
      const c = couriers.find(cr => cr.id === initialTargetId);
      targetName = c ? c.name : 'Condutor';
    }

    setRfTitle(`Fechamento ${targetName} (${startDateStr.split('-').reverse().join('/')} a ${endDateStr.split('-').reverse().join('/')})`);

    const metrics = calculateReportMetrics(defaultType, initialTargetId, startDateStr, endDateStr);
    setRfOrdersCount(metrics.count);
    setRfFreight(metrics.freight);
    setRfAuxiliary(metrics.auxiliary);
    setRfTotalAmount(metrics.total);
    setRfStatus('draft');
    setRfNotes('');
    setRfPaymentMethod('Pix');
    setRfPaymentDate('');
    setIsReportModalOpen(true);
  };

  // CRUD: Open Edit modal
  const handleOpenEditReport = (report: FinancialReport) => {
    setEditingReport(report);
    setRfType(report.type);
    setRfTargetId(report.targetId);
    setRfTitle(report.title);
    setRfStartDate(report.startDate);
    setRfEndDate(report.endDate);
    setRfOrdersCount(report.totalOrders);
    setRfFreight(report.totalFreight);
    setRfAuxiliary(report.totalAuxiliary);
    setRfTotalAmount(report.totalAmount);
    setRfStatus(report.status);
    setRfNotes(report.notes || '');
    setRfPaymentMethod(report.paymentMethod || 'Pix');
    setRfPaymentDate(report.paymentDate || '');
    setIsReportModalOpen(true);
  };

  // CRUD: Save (Create / Update) Submit
  const handleSaveReportSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    let targetName = 'Desconhecido';
    let targetDocument = '';
    if (rfType === 'partner') {
      if (rfTargetId === 'avulso') {
        targetName = 'Serviços Avulsos / Geral';
      } else {
        const p = partnerClients.find(client => client.id === rfTargetId);
        if (p) {
          targetName = p.name;
          targetDocument = p.cnpjCpf || '';
        }
      }
    } else {
      const c = couriers.find(courier => courier.id === rfTargetId);
      if (c) {
        targetName = c.name;
        targetDocument = c.phone || '';
      }
    }

    const reportData: FinancialReport = {
      id: editingReport ? editingReport.id : `frp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      type: rfType,
      targetId: rfTargetId,
      targetName,
      targetDocument,
      title: rfTitle || `Fechamento ${targetName} (${rfStartDate} a ${rfEndDate})`,
      startDate: rfStartDate,
      endDate: rfEndDate,
      totalOrders: Number(rfOrdersCount) || 0,
      totalFreight: Number(rfFreight) || 0,
      totalAuxiliary: Number(rfAuxiliary) || 0,
      totalAmount: Number(rfTotalAmount) || 0,
      status: rfStatus,
      notes: rfNotes,
      paymentMethod: rfPaymentMethod,
      paymentDate: rfPaymentDate,
      createdAt: editingReport ? editingReport.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {
      const method = editingReport ? 'PUT' : 'POST';
      const url = editingReport ? `/api/finance/reports/${editingReport.id}` : '/api/finance/reports';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reportData)
      });

      if (res.ok) {
        const saved = await res.json();
        setSavedReports(prev => {
          const next = editingReport ? prev.map(r => r.id === saved.id ? saved : r) : [saved, ...prev];
          localStorage.setItem('saved_financial_reports', JSON.stringify(next));
          return next;
        });
      } else {
        throw new Error('Erro na API');
      }
    } catch (err) {
      console.warn('Salvando localmente e no Firestore:', err);
      if (db) {
        try {
          await setDoc(doc(db, 'financialReports', reportData.id), reportData);
        } catch (fsErr) {
          console.error('Erro Firestore:', fsErr);
        }
      }
      setSavedReports(prev => {
        const next = editingReport ? prev.map(r => r.id === reportData.id ? reportData : r) : [reportData, ...prev];
        localStorage.setItem('saved_financial_reports', JSON.stringify(next));
        return next;
      });
    }

    setIsReportModalOpen(false);
    setEditingReport(null);
  };

  // CRUD: Delete report
  const handleDeleteFinancialReport = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este relatório financeiro arquivado?')) return;
    try {
      await fetch(`/api/finance/reports/${id}`, { method: 'DELETE' });
    } catch (err) {
      console.warn('Erro ao deletar da API:', err);
    }
    if (db) {
      try {
        await deleteDoc(doc(db, 'financialReports', id));
      } catch (fsErr) {
        console.error('Erro Firestore ao deletar:', fsErr);
      }
    }
    setSavedReports(prev => {
      const next = prev.filter(r => r.id !== id);
      localStorage.setItem('saved_financial_reports', JSON.stringify(next));
      return next;
    });
  };

  // Quick action from Details Modal to save as official report
  const handleQuickSaveFromModal = (type: 'partner' | 'courier', targetId: string) => {
    handleOpenCreateReport(type, targetId);
  };

  // Filtered saved reports for Subtab 5
  const filteredSavedReports = useMemo(() => {
    return savedReports.filter(report => {
      // Type filter
      if (reportFilterType !== 'all' && report.type !== reportFilterType) {
        return false;
      }
      // Status filter
      if (reportFilterStatus !== 'all' && report.status !== reportFilterStatus) {
        return false;
      }
      // Search term
      if (reportSearch.trim()) {
        const query = reportSearch.toLowerCase().trim();
        const matchesTitle = (report.title || '').toLowerCase().includes(query);
        const matchesTarget = (report.targetName || '').toLowerCase().includes(query);
        const matchesDoc = (report.targetDocument || '').toLowerCase().includes(query);
        const matchesId = (report.id || '').toLowerCase().includes(query);
        if (!matchesTitle && !matchesTarget && !matchesDoc && !matchesId) {
          return false;
        }
      }
      return true;
    });
  }, [savedReports, reportFilterType, reportFilterStatus, reportSearch]);

  const handlePrint = () => {
    const el = document.getElementById('print-finance-tab');
    if (!el) return;
    const originalId = el.id;
    el.id = 'printable-area';
    window.print();
    setTimeout(() => {
      el.id = originalId;
    }, 500);
  };

  return (
    <div className="space-y-6" id="print-finance-tab">
      {/* 1. Header with financial controls and date range selector */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-xs flex flex-col xl:flex-row xl:items-center justify-between gap-4 no-print">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 w-full xl:w-auto">
          <div className="flex items-center gap-2">
            <span className="p-2 bg-indigo-50 text-indigo-600 rounded-xl shrink-0">
              <Wallet className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-slate-800 tracking-tight flex items-center gap-2">
                <span>Estúdio Financeiro & DRE de Fechamento</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">Gestão profissional de tarifas de entregas, faturamentos de parceiros e saldo líquido</p>
            </div>
          </div>

          {/* Quick Excel Export and print buttons for mobile dashboard */}
          <div className="sm:hidden flex items-center gap-2">
            <button 
              type="button"
              onClick={handlePrint}
              className="flex items-center justify-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold shadow-xs cursor-pointer transition-transform active:scale-95"
            >
              <Printer className="h-4 w-4 text-slate-500" />
              <span>Imprimir</span>
            </button>
            <button 
              type="button"
              onClick={handleExportToExcel}
              className="flex items-center justify-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer transition-transform active:scale-95"
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span>Exportar Excel</span>
            </button>
          </div>
        </div>

        {/* Date Filters Form Elements */}
        <div className="flex flex-wrap items-center gap-3 bg-slate-50 p-2 rounded-xl border border-slate-100">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-bold px-1">
            <Filter className="h-3.5 w-3.5 text-slate-400" />
            <span>Fechamento por Período:</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <input 
                type="date" 
                value={startDateStr}
                onChange={(e) => setStartDateStr(e.target.value)}
                className="bg-white border border-slate-200 rounded-lg text-xs py-1.5 px-2.5 outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer text-slate-700"
              />
            </div>
            <span className="text-slate-400 text-xs">até</span>
            <div className="relative">
              <input 
                type="date" 
                value={endDateStr}
                onChange={(e) => setEndDateStr(e.target.value)}
                className="bg-white border border-slate-200 rounded-lg text-xs py-1.5 px-2.5 outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer text-slate-700"
              />
            </div>
          </div>

          {/* Preset Buttons */}
          <div className="flex flex-wrap items-center gap-1.5 border-l border-slate-200 pl-3 ml-1.5">
            <button 
              type="button" 
              onClick={() => applyPreset('today')}
              className="px-2 py-1 bg-white hover:bg-slate-150 border border-slate-200 text-[10px] font-bold text-slate-600 rounded-md cursor-pointer transition-colors"
            >
              Hoje
            </button>
            <button 
              type="button" 
              onClick={() => applyPreset('last_7')}
              className="px-2 py-1 bg-white hover:bg-slate-150 border border-slate-200 text-[10px] font-bold text-slate-600 rounded-md cursor-pointer transition-colors"
            >
              7D
            </button>
            <button 
              type="button" 
              onClick={() => applyPreset('last_15')}
              className="px-2 py-1 bg-white hover:bg-slate-150 border border-slate-200 text-[10px] font-bold text-slate-600 rounded-md cursor-pointer transition-colors"
            >
              15D
            </button>
            <button 
              type="button" 
              onClick={() => applyPreset('last_30')}
              className="px-2 py-1 bg-white hover:bg-slate-150 border border-slate-200 text-[10px] font-bold text-slate-600 rounded-md cursor-pointer transition-colors"
            >
              30D
            </button>
            <button 
              type="button" 
              onClick={() => applyPreset('this_month')}
              className="px-2 py-1 bg-white hover:bg-slate-150 border border-slate-200 text-[10px] font-bold text-slate-600 rounded-md cursor-pointer transition-colors"
            >
              Mês
            </button>
          </div>

          {/* Large desktop excel and print download shortcut buttons */}
          <button 
            type="button"
            onClick={handlePrint}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-[11px] font-extrabold shadow-sm cursor-pointer transition-all active:scale-95 ml-2 mr-1"
            title="Sair em lote com impressão rápida apenas no balanço de fechamento"
          >
            <Printer className="h-3.5 w-3.5 text-slate-500" />
            <span>Impressão Rápida</span>
          </button>
          <button 
            type="button"
            onClick={handleExportToExcel}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-extrabold shadow-sm hover:shadow cursor-pointer transition-all active:scale-95 mr-1"
            title="Exportar todos os relatórios financeiros consolidados para Excel (.xlsx)"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            <span>Exportar para Excel</span>
          </button>
        </div>
      </div>

      {/* 2. Top Executive Summary Cards (Consolidated Balanço) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Active Receivables (Contas a Receber) */}
        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-xs relative overflow-hidden">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-450 text-slate-400">Contas a Receber (Ativo)</span>
              <p className="text-xl font-bold font-mono text-indigo-700">{formattedCurrency(consolidatedStats.totalReceivables)}</p>
            </div>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <TrendingUp className="h-4.5 w-4.5" />
            </div>
          </div>
          
          <div className="mt-3 pt-2.5 border-t border-slate-50 flex items-center justify-between text-[11px] text-slate-400">
            <span className="font-medium">Parceiros: {formattedCurrency(consolidatedStats.partnerFreightRevenue)}</span>
            <span className="font-medium">Manual: {formattedCurrency(consolidatedStats.manualReceivables)}</span>
          </div>
        </div>

        {/* KPI 2: Active Payables (Contas a Pagar) */}
        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-xs relative overflow-hidden">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-450 text-slate-400">Contas a Pagar (Passivo)</span>
              <p className="text-xl font-bold font-mono text-rose-600">{formattedCurrency(consolidatedStats.totalPayables)}</p>
            </div>
            <div className="p-2 bg-rose-50 text-rose-500 rounded-xl">
              <TrendingDown className="h-4.5 w-4.5" />
            </div>
          </div>
          
          <div className="mt-3 pt-2.5 border-t border-slate-50 flex items-center justify-between text-[11px] text-slate-400">
            <span className="font-medium">Frota/Condutores: {formattedCurrency(consolidatedStats.courierRepasseTotal)}</span>
            <span className="font-medium">Despesas: {formattedCurrency(consolidatedStats.manualPayables)}</span>
          </div>
        </div>

        {/* KPI 3: Margem Líquida */}
        <div className={`p-4 rounded-2xl border shadow-xs relative overflow-hidden ${
          consolidatedStats.netProfit >= 0 
            ? 'bg-gradient-to-br from-indigo-500 to-blue-600 border-indigo-100 text-white' 
            : 'bg-white border-rose-100'
        }`}>
          <div className="flex items-start justify-between">
            <div className="space-y-0.5">
              <span className={`text-[10px] font-bold uppercase tracking-wider ${
                consolidatedStats.netProfit >= 0 ? 'text-indigo-100' : 'text-slate-400'
              }`}>Saldo Operacional Líquido</span>
              <p className="text-xl font-bold font-mono">{formattedCurrency(consolidatedStats.netProfit)}</p>
            </div>
            <div className={`p-2 rounded-xl ${
              consolidatedStats.netProfit >= 0 ? 'bg-white/10 text-white' : 'bg-rose-50 text-rose-500'
            }`}>
              <DollarSign className="h-4.5 w-4.5" />
            </div>
          </div>
          
          <div className="mt-3.5 flex items-center gap-1.5 text-[10px] font-mono">
            <span className={`px-1.5 py-0.5 rounded ${
              consolidatedStats.netProfit >= 0 ? 'bg-white/15 text-white' : 'bg-rose-100 text-rose-700 font-extrabold'
            }`}>
              Margem Líquida: {consolidatedStats.margin.toFixed(1)}%
            </span>
          </div>
        </div>

        {/* KPI 4: Total Volume de Pedidos */}
        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-xs relative overflow-hidden">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-450 text-slate-400">Entregas no Período</span>
              <p className="text-xl font-bold font-mono text-slate-800">{consolidatedStats.orderCount}</p>
            </div>
            <div className="p-2 bg-indigo-50 text-indigo-700 rounded-xl">
              <Briefcase className="h-4.5 w-4.5" />
            </div>
          </div>
          
          <div className="mt-3 pt-2.5 border-t border-slate-50 text-[11px] text-slate-400 font-medium">
            Média de faturamento por entrega: <span className="text-slate-700 font-bold">{consolidatedStats.orderCount > 0 ? formattedCurrency(consolidatedStats.partnerFreightRevenue / consolidatedStats.orderCount) : 'R$ 0,00'}</span>
          </div>
        </div>
      </div>

      {/* Visualização de Tendências */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 no-print">
        {/* Chart 1: Crescimento Mensal */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                <TrendingUp className="h-4 w-4" />
              </span>
              <div>
                <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Crescimento Mensal de Receita</h3>
                <p className="text-[10px] text-slate-400">Evolução de faturamento total e lucro operacional por mês</p>
              </div>
            </div>
          </div>
          <div className="h-64 w-full">
            {monthlyRevenueData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs italic">
                Sem dados históricos disponíveis
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyRevenueData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="period" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val: number) => `R$ ${val}`} />
                  <Tooltip formatter={(val: number) => [formattedCurrency(val), '']} contentStyle={{ fontSize: '11px', borderRadius: '12px', border: '1px solid #e2e8f0' }} />
                  <Legend iconSize={10} iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Bar name="Receita Bruta" dataKey="revenue" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                  <Bar name="Lucro Operacional" dataKey="profit" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Chart 2: Ganhos Diários */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
                <DollarSign className="h-4 w-4" />
              </span>
              <div>
                <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Faturamento Diário de Fretes</h3>
                <p className="text-[10px] text-slate-400">Receita diária acumulada com tarifas de frete no período</p>
              </div>
            </div>
            {dailyFreightData.length > 0 && (
              <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                Média: {formattedCurrency(dailyFreightData.reduce((sum, d) => sum + d.earnings, 0) / dailyFreightData.length)}/dia
              </span>
            )}
          </div>
          <div className="h-64 w-full">
            {dailyFreightData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs italic">
                Sem dados de frete para o período filtrado
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyFreightData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorEarnings" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="label" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val: number) => `R$ ${val}`} />
                  <Tooltip formatter={(val: number) => [formattedCurrency(val), 'Faturamento']} contentStyle={{ fontSize: '11px', borderRadius: '12px', border: '1px solid #e2e8f0' }} />
                  <Area type="monotone" dataKey="earnings" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorEarnings)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* 3. Navigation between breakdowns: Partners, Couriers, Bookkeeping, History */}
      <div className="flex flex-wrap lg:flex-nowrap gap-1.5 p-1 bg-slate-100 rounded-xl max-w-2xl">
        <button
          onClick={() => setFinanceSubTab('partners')}
          className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            financeSubTab === 'partners'
              ? 'bg-white text-blue-700 shadow-sm'
              : 'text-slate-600 hover:bg-white/40 hover:text-slate-900'
          }`}
        >
          <Building2 className="h-3.5 w-3.5" />
          <span>Faturamento Clientes</span>
        </button>
        
        <button
          onClick={() => setFinanceSubTab('couriers')}
          className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            financeSubTab === 'couriers'
              ? 'bg-white text-blue-700 shadow-sm'
              : 'text-slate-600 hover:bg-white/40 hover:text-slate-900'
          }`}
        >
          <Users className="h-3.5 w-3.5" />
          <span>Contas de Condutores</span>
        </button>

        <button
          onClick={() => setFinanceSubTab('bookkeeping')}
          className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            financeSubTab === 'bookkeeping'
              ? 'bg-white text-blue-700 shadow-sm'
              : 'text-slate-600 hover:bg-white/40 hover:text-slate-900'
          }`}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          <span>Contas Geral (Manual)</span>
        </button>

        <button
          onClick={() => setFinanceSubTab('history')}
          className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            financeSubTab === 'history'
              ? 'bg-white text-blue-700 shadow-sm'
              : 'text-slate-600 hover:bg-white/40 hover:text-slate-900'
          }`}
        >
          <Calendar className="h-3.5 w-3.5" />
          <span>Histórico Mensal</span>
        </button>

        <button
          onClick={() => setFinanceSubTab('reports')}
          className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            financeSubTab === 'reports'
              ? 'bg-white text-indigo-700 shadow-sm'
              : 'text-slate-600 hover:bg-white/40 hover:text-slate-900'
          }`}
        >
          <FileCheck className="h-3.5 w-3.5 text-indigo-600" />
          <span>Relatórios & Fechamentos (CRUD)</span>
          {savedReports.length > 0 && (
            <span className="ml-1 px-1.5 py-0.2 bg-indigo-100 text-indigo-800 rounded-full text-[10px] font-extrabold">
              {savedReports.length}
            </span>
          )}
        </button>
      </div>

      {/* 4. Sub-view Render */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-xs">
        
        {/* SUBTAB 1: Clientes Parceiros */}
        {financeSubTab === 'partners' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-50 pb-3 gap-3">
              <div>
                <h3 className="font-bold text-slate-850 text-sm">Controle de Faturamento por Cliente Parceiro</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Visão consolidada de valores operacionais cobrados de parceiros com contratos ativos</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={exportAllPartnersReportXLSX}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95"
                  title="Exportar planilha Excel de todos os parceiros no período"
                >
                  <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                  <span>Exportar Consolidado (.xlsx)</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleOpenCreateReport('partner')}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md active:scale-95"
                >
                  <Plus className="h-4 w-4" />
                  <span>+ Novo Fechamento</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-bold">
                    <th className="py-3 px-4">Cód. / ID</th>
                    <th className="py-3 px-4">Nome do Parceiro</th>
                    <th className="py-3 px-4 text-center">Entregas Realizadas</th>
                    <th className="py-3 px-4 text-right">Tarifa Frete Total</th>
                    <th className="py-3 px-4 text-right">Valores Complementares</th>
                    <th className="py-3 px-4 text-right">Faturamento Geral</th>
                    <th className="py-3 px-4 text-center">Exportar & Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {partnerBillingList.map(({ partner, totalValue, totalReceivable, totalNfValue, count, orders: partnerOrders }) => (
                    <tr key={partner.id} className="hover:bg-slate-50/50">
                      <td className="py-3 px-4 font-mono font-bold text-indigo-700">{partner.id}</td>
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-bold text-slate-800">{partner.name}</p>
                          <p className="text-[10px] text-slate-400">{partner.cnpjCpf || 'Sem CNPJ'}</p>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full font-bold">
                          {count} pedidos
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right text-slate-700 font-bold font-mono">
                        {formattedCurrency(totalValue)}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-500 font-mono">
                        {formattedCurrency(totalReceivable)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900 font-mono">
                        {formattedCurrency(totalValue + totalReceivable)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => exportPartnerReportXLSX(partner, partnerOrders, totalValue, totalReceivable)}
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer border border-emerald-100"
                            title="Baixar planilha Excel (.xlsx)"
                          >
                            <FileSpreadsheet className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => exportPartnerReportCSV(partner, partnerOrders)}
                            className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer border border-slate-200"
                            title="Baixar arquivo CSV"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => printPartnerReport(partner, partnerOrders, totalValue, totalReceivable)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer border border-blue-100"
                            title="Imprimir Fechamento / Comprovante"
                          >
                            <Printer className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedPartnerDetails(partner)}
                            className="px-2.5 py-1 text-[11px] font-bold text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer border border-indigo-100"
                          >
                            Ver Detalhes
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {/* Standalone rows */}
                  {standaloneBilling.count > 0 && (
                    <tr className="bg-amber-50/20 hover:bg-amber-50/30">
                      <td className="py-3 px-4 font-mono text-amber-700 font-semibold">AVULSOS</td>
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-bold text-slate-800">Serviços Avulsos / Sem Cadastro</p>
                          <p className="text-[10px] text-slate-400">Despachos pontuais de balcão ou e-commerce avulso</p>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full font-bold">
                          {standaloneBilling.count} pedidos
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right text-slate-700 font-bold font-mono">
                        {formattedCurrency(standaloneBilling.totalValue)}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-500 font-mono">
                        {formattedCurrency(standaloneBilling.totalReceivable)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900 font-mono">
                        {formattedCurrency(standaloneBilling.totalValue + standaloneBilling.totalReceivable)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => setSelectedPartnerDetails({
                            id: 'avulso',
                            name: 'Serviços Avulsos / Não Cadastrados',
                            createdAt: ''
                          })}
                          className="px-2.5 py-1 text-[10px] font-bold text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer border border-indigo-100"
                        >
                          Ver Detalhes
                        </button>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* SUBTAB 2: Condutores */}
        {financeSubTab === 'couriers' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-50 pb-3 gap-3">
              <div>
                <h3 className="font-bold text-slate-850 text-sm">Extrato de Pagamentos a Condutores (Repasses)</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Cálculo de repasses totais baseados em taxas de entrega realizadas durante o período selecionado</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={exportAllCouriersReportXLSX}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95"
                  title="Exportar planilha Excel com extrato de todos os condutores"
                >
                  <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                  <span>Exportar Consolidado (.xlsx)</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleOpenCreateReport('courier')}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md active:scale-95"
                >
                  <Plus className="h-4 w-4" />
                  <span>+ Novo Fechamento</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-bold">
                    <th className="py-3 px-4">Condutor</th>
                    <th className="py-3 px-4 text-center">Entregas Efetuadas (Período)</th>
                    <th className="py-3 px-4 text-right">Repasse Total Devido</th>
                    <th className="py-3 px-4 text-center">Status Operacional</th>
                    <th className="py-3 px-4 text-center">Exportar & Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {courierRepasseList.map(({ courier, totalRepasse, count, orders: courierOrders }) => (
                    <tr key={courier.id} className="hover:bg-slate-50/50">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="h-7 w-7 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-650 text-xs text-sky-700">
                            {courier.name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-bold text-slate-800">{courier.name}</p>
                            <p className="text-[10px] text-slate-400 uppercase font-mono">{courier.vehicle} • {courier.phone}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full font-bold">
                          {count} entregas
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-bold font-mono text-rose-600 text-[13px]">
                        {formattedCurrency(totalRepasse)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wide ${
                          courier.status === 'online' ? 'bg-emerald-50 text-emerald-700' :
                          courier.status === 'busy' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {courier.status}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => exportCourierReportXLSX(courier, courierOrders, totalRepasse)}
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer border border-emerald-100"
                            title="Baixar extrato em Excel (.xlsx)"
                          >
                            <FileSpreadsheet className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => exportCourierReportCSV(courier, courierOrders)}
                            className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer border border-slate-200"
                            title="Baixar extrato em CSV"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => printCourierReport(courier, courierOrders, totalRepasse)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer border border-blue-100"
                            title="Imprimir Extrato de Repasse"
                          >
                            <Printer className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedCourierDetails(courier)}
                            className="px-2.5 py-1 text-[11px] font-bold text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer border border-indigo-100"
                          >
                            Ver Extrato
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {couriers.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-slate-450 text-xs italic text-slate-400">Nenhum condutor cadastrado na base de dados.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* SUBTAB 3: Bookkeeping (Contas a Pagar e Receber Manual) */}
        {financeSubTab === 'bookkeeping' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-slate-50 pb-3">
              <div>
                <h3 className="font-bold text-slate-850 text-sm">Livro Auxiliar de Lançamentos de Contas (Pagar / Receber)</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Adicione outras despesas operacionais (como água, luz, aluguel, internet) ou recebimentos adicionais</p>
              </div>

              <button
                onClick={() => setIsAddingTx(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer transition-transform active:scale-95"
              >
                <Plus className="h-4 w-4" />
                <span>Novo Lançamento</span>
              </button>
            </div>

            {/* GRÁFICOS DE DESPESAS: FIXAS VS. VARIÁVEIS / MÓVEIS */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
              <div className="lg:col-span-1 space-y-4 flex flex-col justify-between">
                <div>
                  <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Estrutura de Custos</h4>
                  <p className="text-[10px] text-slate-400 mt-1">Comparativo de desembolsos fixos planejados vs. custos móveis (operacionais sob demanda, incluindo a frota)</p>
                </div>

                <div className="space-y-3">
                  {/* Total Card */}
                  <div className="bg-white p-3 rounded-xl border border-slate-150 shadow-2xs">
                    <span className="text-[9px] font-bold text-slate-400 uppercase">Custos Totais no Período</span>
                    <p className="text-lg font-extrabold text-slate-800 font-mono mt-0.5">{formattedCurrency(expenseDistribution.totalCost)}</p>
                  </div>

                  {/* Fixed Progress Card */}
                  <div className="bg-white p-3 rounded-xl border border-slate-150 shadow-2xs space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-indigo-700 flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-indigo-500" />
                        Despesas Fixas
                      </span>
                      <span className="font-mono font-bold text-slate-700">{formattedCurrency(expenseDistribution.fixedSum)} ({expenseDistribution.fixedPercent.toFixed(1)}%)</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div className="bg-indigo-500 h-full rounded-full transition-all duration-500" style={{ width: `${expenseDistribution.fixedPercent}%` }} />
                    </div>
                  </div>

                  {/* Variable Progress Card */}
                  <div className="bg-white p-3 rounded-xl border border-slate-150 shadow-2xs space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-rose-600 flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-rose-500" />
                        Despesas Móveis / Variáveis
                      </span>
                      <span className="font-mono font-bold text-slate-700">{formattedCurrency(expenseDistribution.variableSum)} ({expenseDistribution.variablePercent.toFixed(1)}%)</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div className="bg-rose-500 h-full rounded-full transition-all duration-500" style={{ width: `${expenseDistribution.variablePercent}%` }} />
                    </div>
                    <p className="text-[8px] text-slate-400 italic">Inclui repasses devidos da frota + combustível e despesas variáveis gerais</p>
                  </div>
                </div>
              </div>

              {/* PieChart Area */}
              <div className="lg:col-span-1 bg-white p-4 rounded-xl border border-slate-150 flex flex-col items-center justify-center min-h-[220px]">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 self-start">Proporção Fixa vs. Variável/Móvel</span>
                <div className="w-full h-[170px] relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={expenseDistribution.chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={70}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {expenseDistribution.chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value: any) => [formattedCurrency(Number(value)), 'Valor']} 
                        contentStyle={{ fontSize: '11px', borderRadius: '8px', padding: '6px' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Total absolute value center display */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-[9px] text-slate-450 uppercase font-bold text-slate-400 leading-none">Custo Total</span>
                    <span className="text-[11px] font-black font-mono text-slate-800 mt-0.5">{formattedCurrency(expenseDistribution.totalCost)}</span>
                  </div>
                </div>
              </div>

              {/* BarChart Category breakdown Area */}
              <div className="lg:col-span-1 bg-white p-4 rounded-xl border border-slate-150 flex flex-col min-h-[220px]">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Maiores Grupos de Custos</span>
                
                {expenseDistribution.breakdownChartData.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-slate-350 text-[10px] italic">
                    Nenhum custo registrado para análise adicional
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto max-h-[175px] pr-1 space-y-1.5 scrollbar-thin">
                    {expenseDistribution.breakdownChartData.map((item, idx) => {
                      const percentage = expenseDistribution.totalCost > 0 ? (item.value / expenseDistribution.totalCost) * 100 : 0;
                      const isFixed = item.name.includes('(Fixa)');
                      return (
                        <div key={idx} className="space-y-0.5 text-[10px]">
                          <div className="flex justify-between text-slate-700">
                            <span className="font-semibold truncate max-w-[170px]">{item.name}</span>
                            <span className="font-mono font-bold">{formattedCurrency(item.value)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-slate-100 h-1 rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full ${isFixed ? 'bg-indigo-400' : 'bg-rose-450 bg-rose-400'}`} 
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                            <span className="text-[8px] font-mono font-bold text-slate-400 shrink-0">{percentage.toFixed(1)}%</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {loadingTxs && (
              <div className="flex items-center justify-center py-10 space-x-2 text-xs text-slate-400">
                <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />
                <span>Buscando lançamentos no banco JSON...</span>
              </div>
            )}

            {!loadingTxs && filteredTransactions.length === 0 && (
              <div className="p-8 text-center text-slate-400 text-xs border border-dashed border-slate-150 rounded-xl space-y-1.5">
                <AlertCircle className="h-5 w-5 mx-auto text-slate-300" />
                <p className="font-semibold text-slate-500">Nenhum lançamento adicional de contas neste período.</p>
                <p className="text-[10px]">Utilize o botão "Novo Lançamento" acima para adicionar despesas e receitas manuais persistentes.</p>
              </div>
            )}

            {!loadingTxs && filteredTransactions.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-bold">
                      <th className="py-3 px-4">Data</th>
                      <th className="py-3 px-4">Descrição</th>
                      <th className="py-3 px-4">Categoria</th>
                      <th className="py-3 px-4">Tipo</th>
                      <th className="py-3 px-4 text-right">Valor</th>
                      <th className="py-3 px-4 text-center">Método</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredTransactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-slate-50/50">
                        <td className="py-3 px-4 font-normal font-mono text-slate-505 whitespace-nowrap">
                          {tx.date.split('-').reverse().join('/')}
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-800">
                          <div className="flex flex-col">
                            <span className="text-slate-800">{tx.description}</span>
                            {tx.isRecurring && (
                              <span className="flex items-center gap-1 text-[9px] text-emerald-600 font-extrabold mt-0.5 leading-none">
                                <RefreshCw className="h-2.5 w-2.5" />
                                <span>Mensal Recorrente {tx.installmentNumber ? `(${tx.installmentNumber}/${tx.totalInstallments || tx.installmentNumber})` : ''}</span>
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap gap-1 items-center">
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-650 rounded-md text-[10px] font-bold">
                              {tx.category}
                            </span>
                            {tx.type === 'payable' && (
                              <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded-md ${
                                tx.expenseNature === 'fixed'
                                  ? 'bg-indigo-50 text-indigo-600 border border-indigo-100'
                                  : 'bg-rose-50 text-rose-650 text-rose-600 border border-rose-100'
                              }`}>
                                {tx.expenseNature === 'fixed' ? 'Fixa' : 'Móvel/Var.'}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center gap-1 text-[10px] font-bold ${
                            tx.type === 'receivable' ? 'text-emerald-700' : 'text-rose-600'
                          }`}>
                            {tx.type === 'receivable' ? (
                              <><ArrowUpRight className="h-3 w-3" /> A Receber</>
                            ) : (
                              <><ArrowDownRight className="h-3 w-3" /> A Pagar</>
                            )}
                          </span>
                        </td>
                        <td className={`py-3 px-4 text-right font-bold font-mono text-[13px] ${
                          tx.type === 'receivable' ? 'text-emerald-600' : 'text-slate-800'
                        }`}>
                          {tx.type === 'receivable' ? '+' : '-'}{formattedCurrency(tx.amount)}
                        </td>
                        <td className="py-3 px-4 text-center text-slate-500 font-medium font-mono text-[10px]">
                          {tx.paymentMethod || 'Pix'}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => handleToggleTxStatus(tx)}
                            title="Clique para inverter o status de pagamento"
                            className={`px-2.5 py-1 rounded-full text-[9px] font-extrabold uppercase tracking-wide cursor-pointer transition-colors ${
                              tx.status === 'paid' 
                                ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-850 text-emerald-800' 
                                : 'bg-amber-50 hover:bg-amber-100 text-amber-850 text-amber-800'
                            }`}
                          >
                            {tx.status === 'paid' ? 'Pago' : 'Pendente'}
                          </button>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => handleDeleteTx(tx.id, tx.description)}
                            className="p-1 hover:bg-rose-50 text-rose-500 rounded cursor-pointer transition-transform hover:scale-105"
                            title="Excluir Lançamento"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* SUBTAB 4: Histórico Mensal por Período */}
        {financeSubTab === 'history' && (() => {
          const exportHistoryMonthCSV = (monthGroup: typeof historicalConsolidation[0]) => {
            const headers = ['ID do Parceiro', 'Nome do Parceiro', 'Volume de Pedidos', 'Frete Acumulado (R$)', 'Valores Secundários (R$)', 'Total Faturamento (R$)'];
            const rows = monthGroup.partnerRows.map(p => [
              p.partnerId,
              p.partnerName,
              p.count,
              p.freight.toFixed(2),
              p.receivable.toFixed(2),
              p.revenue.toFixed(2)
            ]);
            
            const csvContent = "\uFEFF" + [headers.join(';'), ...rows.map(e => e.join(';'))].join('\n');
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.setAttribute("href", url);
            link.setAttribute("download", `faturamento_historico_${monthGroup.periodKey}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          };

          return (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-50 pb-4 gap-3">
                <div>
                  <h3 className="font-bold text-slate-850 text-sm text-slate-800">Consolidação do Faturamento Histórico por Período</h3>
                  <p className="text-[10px] text-slate-400 mt-0.5 font-medium">Balanço retroativo por meses civis com rateio de coletas de parceiros e faturamento acumulado de frete</p>
                </div>
                {activeMonthGroup && (
                  <button
                    onClick={() => exportHistoryMonthCSV(activeMonthGroup)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-indigo-100 bg-indigo-50 hover:bg-indigo-100 text-indigo-750 font-bold text-xs text-indigo-600 rounded-xl transition-colors cursor-pointer"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5" />
                    <span>Exportar CSV ({activeMonthGroup.periodKey})</span>
                  </button>
                )}
              </div>

              {historicalConsolidation.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                  <AlertCircle className="h-8 w-8 text-slate-400 mx-auto stroke-1 mb-3" />
                  <p className="text-xs text-slate-500 font-bold">Nenhum histórico financeiro computado</p>
                  <p className="text-[10px] text-slate-400 mt-1">É necessário ter pedidos registrados com data de solicitação válida para gerar o fechamento.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* 1. Timeline Month Cards */}
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">Ciclos de Fechamento Históricos (Selecione um mês):</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {historicalConsolidation.map((group) => {
                        const isActive = (selectedMonthKey === group.periodKey) || 
                          (!selectedMonthKey && historicalConsolidation[0].periodKey === group.periodKey);
                        
                        return (
                          <div 
                            key={group.periodKey}
                            onClick={() => setSelectedMonthKey(group.periodKey)}
                            className={`p-4 rounded-2xl border transition-all cursor-pointer select-none text-left relative overflow-hidden ${
                              isActive 
                                ? 'bg-indigo-50/80 border-indigo-600 text-indigo-900 shadow-sm shadow-indigo-100/40 ring-1 ring-indigo-300' 
                                : 'bg-white border-slate-150 hover:bg-slate-50/80 hover:border-slate-300 text-slate-700'
                            }`}
                          >
                            {isActive && (
                              <span className="absolute top-2 right-2 flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-650"></span>
                              </span>
                            )}
                            <p className={`text-xs font-bold leading-none ${isActive ? 'text-indigo-850 font-extrabold' : 'text-slate-800'}`}>{group.periodLabel}</p>
                            <p className="text-[10px] font-medium font-mono opacity-80 mt-1">{group.ordersCount} pedidos</p>
                            
                            <div className="mt-3 pt-2 border-t border-slate-100">
                              <span className="text-[8.5px] uppercase font-extrabold tracking-wider block text-slate-400">Total Faturamento:</span>
                              <p className="text-xs font-bold font-mono mt-0.5 tracking-tight text-indigo-700">
                                {formattedCurrency(group.totalRevenue)}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* 2. Detailed Breakdown of Selected Month */}
                  {activeMonthGroup && (
                    <div className="space-y-4 border-t border-slate-100 pt-6">
                      <div className="flex items-center gap-2">
                        <span className="p-1 px-2.5 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-lg text-[10px] font-bold font-mono uppercase">
                          {activeMonthGroup.periodKey}
                        </span>
                        <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                          Detalhamento de Receitas em {activeMonthGroup.periodLabel}
                        </h4>
                      </div>

                      {/* KPIs Panel for the Selected Month */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Metric 1: Frete Básico */}
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-150 text-left">
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Receita de Fretes (A)</span>
                          <p className="text-sm font-extrabold font-mono mt-1 text-slate-800">{formattedCurrency(activeMonthGroup.totalFreight)}</p>
                          <p className="text-[9px] text-slate-400 mt-0.5 font-medium">Soma de todas as tarifas de frete</p>
                        </div>

                        {/* Metric 2: Complementares */}
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-150 text-left">
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Valores Complementares (B)</span>
                          <p className="text-sm font-extrabold font-mono mt-1 text-sky-700">{formattedCurrency(activeMonthGroup.totalReceivable)}</p>
                          <p className="text-[9px] text-slate-400 mt-0.5 font-medium">Soma de outras invoices no mês</p>
                        </div>

                        {/* Metric 3: Repasse */}
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-150 text-left">
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Tarifas de Condutores (C)</span>
                          <p className="text-sm font-extrabold text-rose-600 font-mono mt-1">{formattedCurrency(activeMonthGroup.totalRepasse)}</p>
                          <p className="text-[9px] text-slate-400 mt-0.5 font-medium">Custo com diárias e deslocamento</p>
                        </div>

                        {/* Metric 4: Lucro Líquido do Mês */}
                        <div className="bg-gradient-to-br from-indigo-50/50 to-indigo-50 border border-indigo-100 p-4 rounded-xl text-left">
                          <span className="text-[9px] font-bold text-indigo-700 uppercase tracking-widest block">Saldo Líquido Operacional [(A+B) - C]</span>
                          <p className="text-sm font-black text-indigo-900 font-mono mt-1">
                            {formattedCurrency(activeMonthGroup.totalRevenue - activeMonthGroup.totalRepasse)}
                          </p>
                          <p className="text-[9px] text-indigo-550 text-indigo-500 font-bold mt-0.5">
                            Margem de {activeMonthGroup.totalRevenue > 0 
                              ? (((activeMonthGroup.totalRevenue - activeMonthGroup.totalRepasse) / activeMonthGroup.totalRevenue) * 100).toFixed(1) 
                              : '0.0'}% no período
                          </p>
                        </div>
                      </div>

                      {/* Table of Partners Volume and Freight */}
                      <div className="space-y-2 pt-2">
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Faturamento Consolidado por Cliente Parceiro:</p>
                          <span className="font-mono text-[9px] text-slate-400">Total de parceiros ativos: {activeMonthGroup.partnerRows.length}</span>
                        </div>

                        <div className="overflow-x-auto border border-slate-150 rounded-xl shadow-xs">
                          <table className="w-full text-left text-xs border-collapse bg-white">
                            <thead>
                              <tr className="bg-slate-50 border-b border-slate-150 text-slate-400 font-bold text-[11px]">
                                <th className="py-2.5 px-4">Cód. ID</th>
                                <th className="py-2.5 px-4">Nome do Cliente Parceiro</th>
                                <th className="py-2.5 px-4 text-center">Volume Pedidos</th>
                                <th className="py-2.5 px-4 text-center">Part. Volume</th>
                                <th className="py-2.5 px-4 text-right">Frete Acumulado</th>
                                <th className="py-2.5 px-4 text-right">Valores Complementares</th>
                                <th className="py-2.5 px-4 text-right">Faturamento Geral</th>
                                <th className="py-2.5 px-4 text-center">Ticket Médio</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-medium">
                              {activeMonthGroup.partnerRows.map((partnerRow) => {
                                const pctVolume = activeMonthGroup.ordersCount > 0 
                                  ? (partnerRow.count / activeMonthGroup.ordersCount) * 100 
                                  : 0;
                                
                                const ticketMedio = partnerRow.count > 0 
                                  ? partnerRow.freight / partnerRow.count 
                                  : 0;

                                return (
                                  <tr key={partnerRow.partnerId} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="py-2.5 px-4 font-mono font-bold text-indigo-700">
                                      {partnerRow.partnerId === 'STANDALONE' ? 'AVULSO' : partnerRow.partnerId}
                                    </td>
                                    <td className="py-2.5 px-4 text-slate-800 font-bold">
                                      <div className="flex items-center gap-1.5">
                                        {partnerRow.partnerId === 'STANDALONE' ? (
                                          <Users className="h-3.5 w-3.5 text-slate-400" />
                                        ) : (
                                          <Building2 className="h-3.5 w-3.5 text-slate-400" />
                                        )}
                                        <span>{partnerRow.partnerName}</span>
                                      </div>
                                    </td>
                                    <td className="py-2.5 px-4 text-center">
                                      <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full font-bold">
                                        {partnerRow.count} pedidos
                                      </span>
                                    </td>
                                    <td className="py-2.5 px-4">
                                      <div className="flex items-center justify-center gap-2">
                                        <div className="w-12 bg-slate-100 h-1 rounded-full overflow-hidden hidden sm:block">
                                          <div 
                                            className="bg-indigo-500 h-full rounded-full" 
                                            style={{ width: `${pctVolume}%` }}
                                          />
                                        </div>
                                        <span className="text-[10px] text-slate-500 font-mono font-bold">{pctVolume.toFixed(1)}%</span>
                                      </div>
                                    </td>
                                    <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-800">
                                      {formattedCurrency(partnerRow.freight)}
                                    </td>
                                    <td className="py-2.5 px-4 text-right font-mono text-slate-500">
                                      {formattedCurrency(partnerRow.receivable)}
                                    </td>
                                    <td className="py-2.5 px-4 text-right font-mono font-bold text-indigo-700">
                                      {formattedCurrency(partnerRow.revenue)}
                                    </td>
                                    <td className="py-2.5 px-4 text-center font-mono font-semibold text-slate-550">
                                      {formattedCurrency(ticketMedio)}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()}

        {/* SUBTAB 5: Relatórios & Fechamentos Oficiais (CRUD) */}
        {financeSubTab === 'reports' && (
          <div className="space-y-6">
            {/* Header & Primary Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4 gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                    <FileCheck className="h-4 w-4" />
                  </span>
                  <h3 className="font-bold text-slate-850 text-base">Relatórios Financeiros & Fechamentos Oficiais (CRUD)</h3>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Crie, edite, audite e exporte relatórios consolidados de parceiros e condutores com histórico persistido e controle de liquidação.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={fetchFinancialReports}
                  disabled={loadingReports}
                  className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95 disabled:opacity-50"
                  title="Recarregar relatórios salvos"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loadingReports ? 'animate-spin' : ''}`} />
                  <span>Sincronizar</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleOpenCreateReport('partner')}
                  className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md active:scale-95"
                >
                  <Plus className="h-4 w-4" />
                  <span>+ Novo Fechamento</span>
                </button>
              </div>
            </div>

            {/* KPI Summary Cards for Saved Reports */}
            {(() => {
              const totalSaved = savedReports.length;
              const partnerReports = savedReports.filter(r => r.type === 'partner');
              const courierReports = savedReports.filter(r => r.type === 'courier');
              const totalPartnerRevenue = partnerReports.reduce((sum, r) => sum + (r.totalAmount || 0), 0);
              const totalCourierRepasse = courierReports.reduce((sum, r) => sum + (r.totalAmount || 0), 0);
              const pendingCount = savedReports.filter(r => r.status === 'draft' || r.status === 'pending_approval').length;
              const pendingAmount = savedReports
                .filter(r => r.status === 'draft' || r.status === 'pending_approval')
                .reduce((sum, r) => sum + (r.totalAmount || 0), 0);

              return (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Total de Fechamentos</span>
                    <p className="text-xl font-bold font-mono text-slate-800 mt-1">{totalSaved}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      {partnerReports.length} parceiros • {courierReports.length} condutores
                    </p>
                  </div>

                  <div className="bg-blue-50/40 p-4 rounded-xl border border-blue-100">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 block">Faturamento Fechado (Parceiros)</span>
                    <p className="text-xl font-bold font-mono text-blue-700 mt-1">{formattedCurrency(totalPartnerRevenue)}</p>
                    <p className="text-[10px] text-blue-500 mt-0.5">
                      {partnerReports.filter(r => r.status === 'paid').length} liquidados
                    </p>
                  </div>

                  <div className="bg-rose-50/40 p-4 rounded-xl border border-rose-100">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 block">Repasse Fechado (Condutores)</span>
                    <p className="text-xl font-bold font-mono text-rose-700 mt-1">{formattedCurrency(totalCourierRepasse)}</p>
                    <p className="text-[10px] text-rose-500 mt-0.5">
                      {courierReports.filter(r => r.status === 'paid').length} quitados
                    </p>
                  </div>

                  <div className="bg-amber-50/40 p-4 rounded-xl border border-amber-100">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 block">Pendentes de Quitação</span>
                    <p className="text-xl font-bold font-mono text-amber-800 mt-1">{formattedCurrency(pendingAmount)}</p>
                    <p className="text-[10px] text-amber-600 mt-0.5">
                      {pendingCount} relatórios em aberto / aprovação
                    </p>
                  </div>
                </div>
              );
            })()}

            {/* Filters Bar: Search, Type Filter & Status Filter */}
            <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-100 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Pesquisar por título, cliente, condutor, CPF/CNPJ ou ID..."
                  value={reportSearch}
                  onChange={(e) => setReportSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Type Filter */}
                <div className="flex items-center bg-white p-0.5 rounded-lg border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setReportFilterType('all')}
                    className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                      reportFilterType === 'all'
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Todos
                  </button>
                  <button
                    type="button"
                    onClick={() => setReportFilterType('partner')}
                    className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                      reportFilterType === 'partner'
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Parceiros
                  </button>
                  <button
                    type="button"
                    onClick={() => setReportFilterType('courier')}
                    className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                      reportFilterType === 'courier'
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Condutores
                  </button>
                </div>

                {/* Status Filter */}
                <select
                  value={reportFilterStatus}
                  onChange={(e) => setReportFilterStatus(e.target.value)}
                  className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:ring-1 focus:ring-indigo-500 font-medium cursor-pointer"
                >
                  <option value="all">Todos os Status</option>
                  <option value="draft">Rascunho</option>
                  <option value="pending_approval">Pendente de Aprovação</option>
                  <option value="approved">Aprovado</option>
                  <option value="paid">Pago / Liquidado</option>
                  <option value="cancelled">Cancelado</option>
                </select>
              </div>
            </div>

            {/* Reports List Table */}
            {filteredSavedReports.length === 0 ? (
              <div className="bg-slate-50/50 border border-dashed border-slate-200 rounded-2xl p-10 text-center space-y-3">
                <div className="h-12 w-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
                  <FileText className="h-6 w-6" />
                </div>
                <h4 className="font-bold text-slate-800 text-sm">Nenhum relatório ou fechamento encontrado</h4>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  {savedReports.length === 0
                    ? 'Nenhum fechamento financeiro foi arquivado ainda. Você pode criar um novo fechamento manual ou salvar diretamente a partir das abas de Clientes e Condutores.'
                    : 'Nenhum relatório corresponde aos filtros de busca selecionados.'}
                </p>
                <div className="pt-2 flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleOpenCreateReport('partner')}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md"
                  >
                    + Criar Fechamento de Parceiro
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenCreateReport('courier')}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md"
                  >
                    + Criar Fechamento de Condutor
                  </button>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-100 rounded-xl shadow-xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-bold">
                      <th className="py-3 px-4">Cód. / Data</th>
                      <th className="py-3 px-4">Tipo & Entidade</th>
                      <th className="py-3 px-4">Título & Período</th>
                      <th className="py-3 px-4 text-center">Pedidos</th>
                      <th className="py-3 px-4 text-right">Valor Consolidado</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-center">Exportar & Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredSavedReports.map(report => {
                      const isPartner = report.type === 'partner';
                      const statusColor = report.status === 'paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                          report.status === 'approved' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                          report.status === 'pending_approval' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                          report.status === 'cancelled' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                                          'bg-slate-100 text-slate-600 border-slate-200';
                      const statusLabel = report.status === 'paid' ? 'Pago' :
                                          report.status === 'approved' ? 'Aprovado' :
                                          report.status === 'pending_approval' ? 'Pendente' :
                                          report.status === 'cancelled' ? 'Cancelado' : 'Rascunho';

                      return (
                        <tr key={report.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-3 px-4">
                            <span className="font-mono font-bold text-slate-700 text-[11px] block">{report.id}</span>
                            <span className="text-[10px] text-slate-400">
                              {new Date(report.createdAt).toLocaleDateString('pt-BR')}
                            </span>
                          </td>

                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wide shrink-0 ${
                                isPartner ? 'bg-blue-50 text-blue-700' : 'bg-emerald-50 text-emerald-700'
                              }`}>
                                {isPartner ? 'Cliente' : 'Condutor'}
                              </span>
                              <div>
                                <p className="font-bold text-slate-800">{report.targetName}</p>
                                {report.targetDocument && (
                                  <p className="text-[10px] text-slate-400 font-mono">{report.targetDocument}</p>
                                )}
                              </div>
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            <p className="font-semibold text-slate-800 text-[11px]">{report.title}</p>
                            <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                              {report.startDate.split('-').reverse().join('/')} até {report.endDate.split('-').reverse().join('/')}
                            </p>
                          </td>

                          <td className="py-3 px-4 text-center">
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-full font-bold font-mono text-[11px]">
                              {report.totalOrders}
                            </span>
                          </td>

                          <td className="py-3 px-4 text-right">
                            <p className={`font-mono font-black text-sm ${isPartner ? 'text-indigo-700' : 'text-rose-600'}`}>
                              {formattedCurrency(report.totalAmount)}
                            </p>
                            {report.totalAuxiliary > 0 && (
                              <p className="text-[9px] text-slate-400 font-mono">
                                Frete: {formattedCurrency(report.totalFreight)} + Compl: {formattedCurrency(report.totalAuxiliary)}
                              </p>
                            )}
                          </td>

                          <td className="py-3 px-4 text-center">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${statusColor}`}>
                              {statusLabel}
                            </span>
                            {report.paymentMethod && report.status === 'paid' && (
                              <p className="text-[9px] text-emerald-600 font-medium mt-0.5">
                                via {report.paymentMethod}
                              </p>
                            )}
                          </td>

                          <td className="py-3 px-4">
                            <div className="flex items-center justify-center gap-1.5">
                              {/* View / Print modal trigger */}
                              <button
                                type="button"
                                onClick={() => setViewingReport(report)}
                                className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer border border-indigo-100"
                                title="Ver Detalhes e Comprovante"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </button>

                              {/* Export XLSX */}
                              <button
                                type="button"
                                onClick={() => exportSavedReportXLSX(report)}
                                className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer border border-emerald-100"
                                title="Exportar para Excel (.xlsx)"
                              >
                                <FileSpreadsheet className="h-3.5 w-3.5" />
                              </button>

                              {/* Export CSV */}
                              <button
                                type="button"
                                onClick={() => exportSavedReportCSV(report)}
                                className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer border border-slate-200"
                                title="Exportar para CSV"
                              >
                                <Download className="h-3.5 w-3.5" />
                              </button>

                              {/* Print */}
                              <button
                                type="button"
                                onClick={() => printSavedReport(report)}
                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer border border-blue-100"
                                title="Imprimir Comprovante Oficial"
                              >
                                <Printer className="h-3.5 w-3.5" />
                              </button>

                              {/* Edit */}
                              <button
                                type="button"
                                onClick={() => handleOpenEditReport(report)}
                                className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer border border-amber-100"
                                title="Editar Fechamento"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                              </button>

                              {/* Delete */}
                              <button
                                type="button"
                                onClick={() => handleDeleteFinancialReport(report.id)}
                                className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer border border-rose-100"
                                title="Excluir Fechamento"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      </div>

      {/* 5. POPUP SYSTEM 1: Novo Lançamento de Conta (Bookkeeping Form OverlayModal) */}
      {isAddingTx && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="bg-slate-50 px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-slate-800 text-sm">Adicionar Lançamento no Livro de Contas</h4>
                <p className="text-[10px] text-slate-400">Insira valores que serão sincronizados ao faturamento</p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddingTx(false)}
                className="p-1 hover:bg-slate-150 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <form onSubmit={handleAddTransactionSubmit} className="p-5 space-y-4">
              
              {formError && (
                <p className="text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-lg p-2.5 font-medium">
                  {formError}
                </p>
              )}

              {/* Description */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Descrição / Histórico</label>
                <input 
                  type="text"
                  placeholder="Ex: Conta de Luz CPFL - Junho"
                  value={txDescription}
                  onChange={(e) => setTxDescription(e.target.value)}
                  className="w-full text-xs text-slate-700 bg-white border border-slate-200 rounded-xl py-2 px-3 focus:ring-1 focus:ring-indigo-500 outline-none"
                  required
                />
              </div>

              {/* Type Grid Option */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Natureza da Conta</label>
                  <select
                    value={txType}
                    onChange={(e) => {
                      setTxType(e.target.value as 'receivable' | 'payable');
                      setTxCategory(e.target.value === 'receivable' ? 'Faturamento Extra' : 'Infraestrutura');
                    }}
                    className="w-full text-xs text-slate-705 bg-white border border-slate-200 rounded-xl py-2 px-3 focus:ring-1 focus:ring-indigo-500 outline-none cursor-pointer"
                  >
                    <option value="payable">A Pagar (Despesa)</option>
                    <option value="receivable">A Receber (Receita)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Valor (R$)</label>
                  <input 
                    type="number"
                    step="0.01"
                    placeholder="0,00"
                    value={txAmount}
                    onChange={(e) => setTxAmount(e.target.value)}
                    className="w-full text-xs text-slate-700 font-bold font-mono bg-white border border-slate-200 rounded-xl py-2 px-3 focus:ring-1 focus:ring-indigo-500 outline-none"
                    required
                  />
                </div>
              </div>

              {/* Date and Method */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Vencimento / Data</label>
                  <input 
                    type="date"
                    value={txDate}
                    onChange={(e) => setTxDate(e.target.value)}
                    className="w-full text-xs text-slate-700 bg-white border border-slate-200 rounded-xl py-2 px-3 focus:ring-1 focus:ring-indigo-500 outline-none cursor-pointer"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Meio de Transação</label>
                  <select
                    value={txPaymentMethod}
                    onChange={(e) => setTxPaymentMethod(e.target.value)}
                    className="w-full text-xs text-slate-705 bg-white border border-slate-200 rounded-xl py-2 px-3 focus:ring-1 focus:ring-indigo-500 outline-none cursor-pointer"
                  >
                    <option value="Pix">Pix</option>
                    <option value="Boleto">Boleto Bancário</option>
                    <option value="Transferência">TED / DOC</option>
                    <option value="Cartão">Cartão Corporativo</option>
                    <option value="Dinheiro">Dinheiro Físico</option>
                  </select>
                </div>
              </div>

              {/* Category and Status */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Categoria</label>
                  {txType === 'payable' ? (
                    <select
                      value={txCategory}
                      onChange={(e) => setTxCategory(e.target.value)}
                      className="w-full text-xs bg-white border border-slate-200 rounded-xl py-2 px-3 focus:ring-1 focus:ring-indigo-500 outline-none cursor-pointer"
                    >
                      <option value="Infraestrutura">Infraestrutura</option>
                      <option value="Combustível">Combustível</option>
                      <option value="Aluguel">Aluguel / Imóvel</option>
                      <option value="Internet">Internet / Link</option>
                      <option value="Tecnologia">Tecnologia / APIs</option>
                      <option value="Manutenção">Manutenção / Reparo</option>
                      <option value="Seguros">Seguros</option>
                      <option value="Outros">Outros Extras</option>
                    </select>
                  ) : (
                    <select
                      value={txCategory}
                      onChange={(e) => setTxCategory(e.target.value)}
                      className="w-full text-xs bg-white border border-slate-200 rounded-xl py-2 px-3 focus:ring-1 focus:ring-indigo-500 outline-none cursor-pointer"
                    >
                      <option value="Faturamento Extra">Faturamento Extra</option>
                      <option value="Investimento">Investimento</option>
                      <option value="Ajuste Contábil">Ajuste Contábil</option>
                      <option value="Venda de Equipamento">Venda de Equipamento</option>
                      <option value="Sócio">Aporte de Sócio</option>
                      <option value="Outros">Outros Ganhos</option>
                    </select>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide font-semibold">Status Inicial</label>
                  <select
                    value={txStatus}
                    onChange={(e) => setTxStatus(e.target.value as 'pending' | 'paid')}
                    className="w-full text-xs bg-white border border-slate-200 rounded-xl py-2 px-3 focus:ring-1 focus:ring-indigo-500 outline-none cursor-pointer"
                  >
                    <option value="pending">Aberto / Pendente</option>
                    <option value="paid">Confirmado / Pago</option>
                  </select>
                </div>
              </div>

              {/* Natureza da Despesa (Fixa ou Variável) and Recorrência Mensal */}
              {txType === 'payable' && (
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-150 space-y-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wide">Natureza da Despesa</label>
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      <button
                        type="button"
                        onClick={() => setTxExpenseNature('fixed')}
                        className={`py-1.5 px-2 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                          txExpenseNature === 'fixed'
                            ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-2xs'
                            : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-100'
                        }`}
                      >
                        Despesa Fixa
                      </button>
                      <button
                        type="button"
                        onClick={() => setTxExpenseNature('variable')}
                        className={`py-1.5 px-2 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                          txExpenseNature === 'variable'
                            ? 'bg-rose-50 border-rose-200 text-rose-700 shadow-2xs'
                            : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-100'
                        }`}
                      >
                        Despesa Variável / Móvel
                      </button>
                    </div>
                    <p className="text-[9px] text-slate-400 leading-none mt-1">
                      {txExpenseNature === 'fixed' 
                        ? 'Custos recorrentes estruturais (aluguel, internet, sistemas).' 
                        : 'Custos atrelados ao volume operacional (combustível, fretes, lanches).'}
                    </p>
                  </div>
                </div>
              )}

              {/* Recorrência Mensal Switch & meses para parcelamento/repetição */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-150 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wide">Repetição Contínua</span>
                    <p className="text-[9px] text-slate-400 leading-none">Repetir esta transação mensalmente?</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={txIsRecurring}
                      onChange={(e) => setTxIsRecurring(e.target.checked)}
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                  </label>
                </div>

                {txIsRecurring && (
                  <div className="space-y-1 pt-1.5 border-t border-slate-100 animate-in slide-in-from-top-1">
                    <label className="text-[10px] font-extrabold text-indigo-700 uppercase tracking-wide">Meses para Repetição Automática</label>
                    <select
                      value={txRecurringMonths}
                      onChange={(e) => setTxRecurringMonths(e.target.value)}
                      className="w-full text-xs bg-white border border-slate-200 rounded-lg py-1.5 px-2.5 focus:ring-1 focus:ring-indigo-500 outline-none cursor-pointer"
                    >
                      <option value="2">2 meses (Bimestral)</option>
                      <option value="3">3 meses (Trimestral)</option>
                      <option value="4">4 meses</option>
                      <option value="6">6 meses (Semestral)</option>
                      <option value="12">12 meses (Anuidade / 1 Ano)</option>
                      <option value="24">24 meses (2 Anos)</option>
                      <option value="36">36 meses (3 Anos)</option>
                    </select>
                    <p className="text-[8px] text-indigo-500 font-bold mt-1">
                      O sistema criará lançamentos idênticos sequenciais para os próximos {txRecurringMonths} meses.
                    </p>
                  </div>
                )}
              </div>

              {/* Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsAddingTx(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-500 hover:bg-slate-50 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Fechar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Plus className="h-4 w-4" />
                  <span>Cadastrar Registro</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* 6. POPUP SYSTEM 2: Partner Invoice Order Breakdown Details modal */}
      {selectedPartnerDetails && (() => {
        const pId = selectedPartnerDetails.id;
        const pName = selectedPartnerDetails.name;
        
        // Find matching orders in filtered orders
        const matchOrders = filteredOrders.filter(o => {
          if (pId === 'avulso') {
            if (!o.codigoCliente) return true;
            return !partnerClients.some(p => p.id.trim().toLowerCase() === o.codigoCliente?.trim().toLowerCase());
          }
          if (!o.codigoCliente) return false;
          return o.codigoCliente.trim().toLowerCase() === pId.trim().toLowerCase() ||
                 o.codigoCliente.toLowerCase().includes(pName.toLowerCase()) ||
                 pName.toLowerCase().includes(o.codigoCliente.toLowerCase());
        });

        const freightSum = matchOrders.reduce((sum, o) => sum + (o.value || 0), 0);
        const auxiliarySum = matchOrders.reduce((sum, o) => sum + (o.valorReceber || 0), 0);

        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-xl max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
              <div className="bg-slate-50 px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-850 text-sm">Fechamento Detalhado: {pName}</h4>
                  <p className="text-[10px] text-slate-400 mt-1">Análise de fretes e pedidos realizados do período de faturamento de <span className="font-mono text-slate-650 font-bold">{startDateStr.split('-').reverse().join('/')}</span> até <span className="font-mono text-slate-650 font-bold">{endDateStr.split('-').reverse().join('/')}</span></p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedPartnerDetails(null)}
                  className="p-1 hover:bg-slate-155 rounded text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>

              <div className="p-5 bg-indigo-50/20 border-b border-indigo-50 grid grid-cols-3 gap-4 text-xs">
                <div className="bg-white p-3 rounded-xl border border-indigo-100/30">
                  <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400">Total de Pedidos</span>
                  <p className="text-lg font-bold text-indigo-700 mt-1 font-mono">{matchOrders.length}</p>
                </div>
                <div className="bg-white p-3 rounded-xl border border-indigo-100/30">
                  <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400">Tarifas Frete</span>
                  <p className="text-lg font-bold text-slate-800 mt-1 font-mono">{formattedCurrency(freightSum)}</p>
                </div>
                <div className="bg-white p-3 rounded-xl border border-indigo-100/30">
                  <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400">Total Consolidado</span>
                  <p className="text-lg font-bold text-emerald-700 mt-1 font-mono">{formattedCurrency(freightSum + auxiliarySum)}</p>
                </div>
              </div>

              <div className="p-5 overflow-y-auto flex-1 space-y-4">
                {matchOrders.length === 0 ? (
                  <p className="text-xs text-slate-400 italic text-center py-10">Nenhum despacho ou pedido ativo encontrado para este parceiro no período selecionado.</p>
                ) : (
                  <div className="overflow-x-auto border border-slate-100 rounded-xl">
                    <table className="w-full text-left text-[11px] border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-bold">
                          <th className="py-2.5 px-3">Pedido ID</th>
                          <th className="py-2.5 px-3">Procurar Por</th>
                          <th className="py-2.5 px-3">Destinatário</th>
                          <th className="py-2.5 px-3 text-center">Bairro / CEP</th>
                          <th className="py-2.5 px-3 text-center">Status</th>
                          <th className="py-2.5 px-3 text-right">Frete Cobrado</th>
                          <th className="py-2.5 px-3 text-right">Valor Complementar</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {matchOrders.map(order => (
                          <tr key={order.id} className="hover:bg-slate-50/25">
                            <td className="py-2.5 px-3 font-mono font-bold text-indigo-600">{order.id}</td>
                            <td className="py-2.5 px-3 font-bold text-slate-700">{order.procurarPor || '-'}</td>
                            <td className="py-2.5 px-3">
                              <p className="font-semibold text-slate-750">{order.customerName}</p>
                              <p className="text-[10px] text-slate-400 truncate max-w-[160px]">{order.address}</p>
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono text-slate-500">
                              {order.region} <span className="text-[10px] block opacity-70">{order.cep}</span>
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase ${
                                order.status === 'delivered' ? 'bg-emerald-50 text-emerald-700' :
                                order.status === 'in_route' ? 'bg-sky-50 text-sky-700' : 'bg-slate-100 text-slate-550'
                              }`}>
                                {order.status}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-800">
                              {formattedCurrency(order.value || 0)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-slate-500">
                              {formattedCurrency(order.valorReceber || 0)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="bg-slate-50 px-5 py-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => exportPartnerReportXLSX(selectedPartnerDetails, matchOrders, freightSum, auxiliarySum)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs"
                    title="Exportar planilha Excel"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Excel</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => exportPartnerReportCSV(selectedPartnerDetails, matchOrders)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs"
                    title="Exportar CSV"
                  >
                    <Download className="h-3.5 w-3.5 text-slate-500" />
                    <span>CSV</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => printPartnerReport(selectedPartnerDetails, matchOrders, freightSum, auxiliarySum)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs"
                    title="Imprimir Relatório"
                  >
                    <Printer className="h-3.5 w-3.5 text-blue-600" />
                    <span>Imprimir</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      handleQuickSaveFromModal('partner', selectedPartnerDetails.id);
                      setSelectedPartnerDetails(null);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-sm"
                  >
                    <FileCheck className="h-3.5 w-3.5" />
                    <span>+ Arquivar no CRUD</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedPartnerDetails(null)}
                    className="px-3.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-bold transition-all cursor-pointer"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 7. POPUP SYSTEM 3: Courier Invoice Order Breakdown Details modal */}
      {selectedCourierDetails && (() => {
        const cId = selectedCourierDetails.id;
        const cName = selectedCourierDetails.name;
        
        // Find matching orders in filtered orders for this driver
        const matchOrders = filteredOrders.filter(o => o.courierId === cId && o.status !== 'cancelled');
        const totalRepasseSum = matchOrders.reduce((sum, o) => sum + (o.valorCondutor !== undefined ? o.valorCondutor : 9.50), 0);

        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-xl max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
              <div className="bg-slate-50 px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-850 text-sm">Extrato Detalhado de Repasse: {cName}</h4>
                  <p className="text-[10px] text-slate-400 mt-1">Giro de diárias e entregas realizadas no período selecionado</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedCourierDetails(null)}
                  className="p-1 hover:bg-slate-155 rounded text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>

              <div className="p-5 bg-indigo-50/20 border-b border-indigo-50 grid grid-cols-2 gap-4 text-xs">
                <div className="bg-white p-3 rounded-xl border border-indigo-100/30">
                  <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400">Total de Entregas Realizadas</span>
                  <p className="text-lg font-bold text-indigo-700 mt-1 font-mono">{matchOrders.length}</p>
                </div>
                <div className="bg-white p-3 rounded-xl border border-indigo-100/30">
                  <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400">Total das Taxas a Repassar</span>
                  <p className="text-lg font-bold text-rose-600 mt-1 font-mono">{formattedCurrency(totalRepasseSum)}</p>
                </div>
              </div>

              <div className="p-5 overflow-y-auto flex-1 space-y-4">
                {matchOrders.length === 0 ? (
                  <p className="text-xs text-slate-400 italic text-center py-10">Nenhuma entrega ativa ou devida encontrada para este condutor no período.</p>
                ) : (
                  <div className="overflow-x-auto border border-slate-100 rounded-xl">
                    <table className="w-full text-left text-[11px] border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-bold">
                          <th className="py-2.5 px-3">Pedido ID</th>
                          <th className="py-2.5 px-3">Data do Pedido</th>
                          <th className="py-2.5 px-3">Cliente Origem</th>
                          <th className="py-2.5 px-3">Procurar Por</th>
                          <th className="py-2.5 px-3">Destinatário</th>
                          <th className="py-2.5 px-3">Endereço</th>
                          <th className="py-2.5 px-3 text-center">Status</th>
                          <th className="py-2.5 px-3 text-right">Repasse Condutor</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {matchOrders.map(order => {
                          const partnerObj = partnerClients.find(p => matchClientCode(p.id, order.codigoCliente));
                          const partnerName = partnerObj ? partnerObj.name : '';
                          const orderDate = order.dataSolicitacao 
                            ? normalizeIncomingDateToBrasilia(order.dataSolicitacao) 
                            : (order.createdAt ? formatToBrasiliaDate(new Date(order.createdAt)) : '-');
                          const procurarPor = order.procurarPor || order.customerName || '-';
                          const destinatario = order.customerName || order.procurarPor || '-';
                          const fullAddress = order.address 
                            ? `${order.address}${order.region ? ` • ${order.region}` : ''}` 
                            : (order.region || '-');
                          const statusPTBR = order.status === 'delivered' ? 'Entregue' :
                                             order.status === 'in_route' ? 'Em Rota' :
                                             order.status === 'pending' ? 'Pendente' :
                                             order.status === 'in_progress' ? 'Em Andamento' :
                                             order.status === 'failure' ? 'Ocorrência' :
                                             order.status === 'cancelled' ? 'Cancelado' : (order.status || 'Pendente');

                          return (
                            <tr key={order.id} className="hover:bg-slate-50/25">
                              <td className="py-2.5 px-3 font-mono font-bold text-indigo-600">{order.id}</td>
                              <td className="py-2.5 px-3 font-mono text-slate-600 text-[10px] whitespace-nowrap">{orderDate}</td>
                              <td className="py-2.5 px-3">
                                <div className="flex flex-col">
                                  <span className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded font-semibold font-mono text-[9px] w-fit">
                                    {order.codigoCliente || 'Avulso'}
                                  </span>
                                  {partnerName && (
                                    <span className="text-[10px] font-bold text-slate-800 mt-0.5 truncate max-w-[140px]" title={partnerName}>
                                      ({partnerName})
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-2.5 px-3 font-bold text-slate-700">{procurarPor}</td>
                              <td className="py-2.5 px-3">
                                <p className="font-semibold text-slate-800">{destinatario}</p>
                              </td>
                              <td className="py-2.5 px-3 text-slate-600 max-w-[180px] truncate" title={fullAddress}>
                                {fullAddress}
                              </td>
                              <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase ${
                                  order.status === 'delivered' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                                  order.status === 'in_route' ? 'bg-sky-50 text-sky-700 border border-sky-200' :
                                  order.status === 'cancelled' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                                  'bg-slate-100 text-slate-600 border border-slate-200'
                                }`}>
                                  {statusPTBR}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-600 text-[12px] whitespace-nowrap">
                                {formattedCurrency(order.courierId && order.status !== 'cancelled' ? (order.valorCondutor !== undefined ? order.valorCondutor : 9.50) : 0)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="bg-slate-50 px-5 py-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => exportCourierReportXLSX(selectedCourierDetails, matchOrders, totalRepasseSum)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs"
                    title="Exportar planilha Excel"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Excel</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => exportCourierReportCSV(selectedCourierDetails, matchOrders)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs"
                    title="Exportar CSV"
                  >
                    <Download className="h-3.5 w-3.5 text-slate-500" />
                    <span>CSV</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => printCourierReport(selectedCourierDetails, matchOrders, totalRepasseSum)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs"
                    title="Imprimir Extrato de Repasse"
                  >
                    <Printer className="h-3.5 w-3.5 text-blue-600" />
                    <span>Imprimir</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      handleQuickSaveFromModal('courier', selectedCourierDetails.id);
                      setSelectedCourierDetails(null);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-sm"
                  >
                    <FileCheck className="h-3.5 w-3.5" />
                    <span>+ Arquivar no CRUD</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedCourierDetails(null)}
                    className="px-3.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-bold transition-all cursor-pointer"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 8. POPUP SYSTEM 4: Financial Report Create / Edit Modal (CRUD) */}
      {isReportModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-xl max-w-xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="bg-slate-50 px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-slate-850 text-sm">
                  {editingReport ? 'Editar Relatório / Fechamento' : 'Novo Fechamento Financeiro Oficial'}
                </h4>
                <p className="text-[10px] text-slate-400">
                  {editingReport ? `Modificando registro ID ${editingReport.id}` : 'Cadastrar e persistir fechamento para controle e exportações'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsReportModalOpen(false)}
                className="p-1 hover:bg-slate-150 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <form onSubmit={handleSaveReportSubmit} className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
              {/* Type Switcher */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Tipo de Fechamento</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={!!editingReport}
                    onClick={() => {
                      setRfType('partner');
                      const pId = partnerClients[0]?.id || 'avulso';
                      setRfTargetId(pId);
                      const m = calculateReportMetrics('partner', pId, rfStartDate, rfEndDate);
                      setRfOrdersCount(m.count);
                      setRfFreight(m.freight);
                      setRfAuxiliary(m.auxiliary);
                      setRfTotalAmount(m.total);
                    }}
                    className={`py-2 px-3 rounded-xl font-bold flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                      rfType === 'partner'
                        ? 'bg-blue-50 border-blue-200 text-blue-700 shadow-2xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    } ${editingReport ? 'opacity-70 cursor-not-allowed' : ''}`}
                  >
                    <Building2 className="h-4 w-4" />
                    <span>Cliente Parceiro</span>
                  </button>

                  <button
                    type="button"
                    disabled={!!editingReport}
                    onClick={() => {
                      setRfType('courier');
                      const cId = couriers[0]?.id || '';
                      setRfTargetId(cId);
                      const m = calculateReportMetrics('courier', cId, rfStartDate, rfEndDate);
                      setRfOrdersCount(m.count);
                      setRfFreight(m.freight);
                      setRfAuxiliary(0);
                      setRfTotalAmount(m.total);
                    }}
                    className={`py-2 px-3 rounded-xl font-bold flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                      rfType === 'courier'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-2xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    } ${editingReport ? 'opacity-70 cursor-not-allowed' : ''}`}
                  >
                    <Users className="h-4 w-4" />
                    <span>Condutor (Repasse)</span>
                  </button>
                </div>
              </div>

              {/* Target Entity Select */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                  {rfType === 'partner' ? 'Selecione o Cliente Parceiro' : 'Selecione o Condutor'}
                </label>
                <select
                  value={rfTargetId}
                  disabled={!!editingReport}
                  onChange={(e) => {
                    const newTarget = e.target.value;
                    setRfTargetId(newTarget);
                    const m = calculateReportMetrics(rfType, newTarget, rfStartDate, rfEndDate);
                    setRfOrdersCount(m.count);
                    setRfFreight(m.freight);
                    setRfAuxiliary(m.auxiliary);
                    setRfTotalAmount(m.total);
                  }}
                  className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                >
                  {rfType === 'partner' ? (
                    <>
                      <option value="avulso">Serviços Avulsos / Geral</option>
                      {partnerClients.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.id}) {p.cnpjCpf ? `- ${p.cnpjCpf}` : ''}
                        </option>
                      ))}
                    </>
                  ) : (
                    <>
                      {couriers.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.vehicle} - {c.phone})
                        </option>
                      ))}
                    </>
                  )}
                </select>
              </div>

              {/* Title Field */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Título / Identificador do Fechamento</label>
                <input
                  type="text"
                  value={rfTitle}
                  onChange={(e) => setRfTitle(e.target.value)}
                  placeholder="Ex: Fechamento Quinzenal Junho 2026"
                  className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 outline-none focus:ring-1 focus:ring-indigo-500"
                  required
                />
              </div>

              {/* Period Dates & Auto Recalculate Button */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-150 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold uppercase text-slate-500">Período de Apuração</span>
                  <button
                    type="button"
                    onClick={() => {
                      const m = calculateReportMetrics(rfType, rfTargetId, rfStartDate, rfEndDate);
                      setRfOrdersCount(m.count);
                      setRfFreight(m.freight);
                      setRfAuxiliary(m.auxiliary);
                      setRfTotalAmount(m.total);
                    }}
                    className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="h-3 w-3" />
                    <span>Recalcular Automaticamente da Base</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[9px] text-slate-400 block mb-0.5">Data Inicial</label>
                    <input
                      type="date"
                      value={rfStartDate}
                      onChange={(e) => setRfStartDate(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg py-1.5 px-2.5 text-xs outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-slate-400 block mb-0.5">Data Final</label>
                    <input
                      type="date"
                      value={rfEndDate}
                      onChange={(e) => setRfEndDate(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg py-1.5 px-2.5 text-xs outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Metric Values Breakdown */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div>
                  <label className="text-[9px] font-bold text-slate-400 uppercase">Qtd Pedidos</label>
                  <input
                    type="number"
                    value={rfOrdersCount}
                    onChange={(e) => setRfOrdersCount(parseInt(e.target.value) || 0)}
                    className="w-full bg-white border border-slate-200 rounded-lg py-1.5 px-2 font-mono font-bold text-slate-800 text-xs"
                  />
                </div>

                <div>
                  <label className="text-[9px] font-bold text-slate-400 uppercase">Fretes (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={rfFreight}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setRfFreight(val);
                      setRfTotalAmount(val + rfAuxiliary);
                    }}
                    className="w-full bg-white border border-slate-200 rounded-lg py-1.5 px-2 font-mono font-bold text-slate-800 text-xs"
                  />
                </div>

                <div>
                  <label className="text-[9px] font-bold text-slate-400 uppercase">Adicionais (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={rfAuxiliary}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setRfAuxiliary(val);
                      setRfTotalAmount(rfFreight + val);
                    }}
                    className="w-full bg-white border border-slate-200 rounded-lg py-1.5 px-2 font-mono text-slate-600 text-xs"
                  />
                </div>

                <div>
                  <label className="text-[9px] font-bold text-indigo-700 uppercase">Total (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={rfTotalAmount}
                    onChange={(e) => setRfTotalAmount(parseFloat(e.target.value) || 0)}
                    className="w-full bg-indigo-50 border border-indigo-200 rounded-lg py-1.5 px-2 font-mono font-black text-indigo-900 text-xs"
                  />
                </div>
              </div>

              {/* Status, Payment Method & Payment Date */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Status do Fechamento</label>
                  <select
                    value={rfStatus}
                    onChange={(e) => setRfStatus(e.target.value as any)}
                    className="w-full bg-white border border-slate-200 rounded-lg py-1.5 px-2.5 text-xs outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer mt-1"
                  >
                    <option value="draft">Rascunho</option>
                    <option value="pending_approval">Pendente Aprovação</option>
                    <option value="approved">Aprovado</option>
                    <option value="paid">Pago / Liquidado</option>
                    <option value="cancelled">Cancelado</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Forma de Pagamento</label>
                  <select
                    value={rfPaymentMethod}
                    onChange={(e) => setRfPaymentMethod(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg py-1.5 px-2.5 text-xs outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer mt-1"
                  >
                    <option value="Pix">Pix</option>
                    <option value="Boleto Bancário">Boleto Bancário</option>
                    <option value="Transferência TED">Transferência TED</option>
                    <option value="Cartão de Crédito">Cartão de Crédito</option>
                    <option value="Dinheiro">Dinheiro Espécie</option>
                    <option value="Outro">Outro</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Data da Quitação</label>
                  <input
                    type="date"
                    value={rfPaymentDate}
                    onChange={(e) => setRfPaymentDate(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg py-1.5 px-2.5 text-xs outline-none focus:ring-1 focus:ring-indigo-500 font-mono mt-1"
                  />
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Observações e Informações Adicionais</label>
                <textarea
                  rows={2}
                  value={rfNotes}
                  onChange={(e) => setRfNotes(e.target.value)}
                  placeholder="Ex: Ajuste de fretes com retorno, dados bancários de quitação, etc..."
                  className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 outline-none focus:ring-1 focus:ring-indigo-500 text-xs"
                />
              </div>

              {/* Form Buttons */}
              <div className="bg-slate-50 -mx-5 -mb-5 px-5 py-3 border-t border-slate-100 flex justify-end gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => setIsReportModalOpen(false)}
                  className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md flex items-center gap-1.5"
                >
                  <Save className="h-4 w-4" />
                  <span>{editingReport ? 'Salvar Alterações' : 'Cadastrar Fechamento'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 9. POPUP SYSTEM 5: Detailed Report Viewing & Quick Export Modal */}
      {viewingReport && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="bg-slate-50 px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`p-1.5 rounded-lg ${
                  viewingReport.type === 'partner' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'
                }`}>
                  <FileText className="h-4 w-4" />
                </span>
                <div>
                  <h4 className="font-bold text-slate-850 text-sm">{viewingReport.title}</h4>
                  <p className="text-[10px] text-slate-400">ID do Fechamento: {viewingReport.id}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingReport(null)}
                className="p-1 hover:bg-slate-150 rounded text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-5 text-xs">
              {/* Target Entity Card */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-150 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400 block">
                    {viewingReport.type === 'partner' ? 'Cliente Parceiro' : 'Condutor Responsável'}
                  </span>
                  <p className="text-base font-bold text-slate-800 mt-0.5">{viewingReport.targetName}</p>
                  {viewingReport.targetDocument && (
                    <p className="text-[10px] text-slate-500 font-mono mt-0.5">Doc: {viewingReport.targetDocument}</p>
                  )}
                </div>

                <div className="text-right">
                  <span className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400 block">Período de Faturamento</span>
                  <p className="text-xs font-mono font-bold text-slate-700 mt-0.5">
                    {viewingReport.startDate.split('-').reverse().join('/')} até {viewingReport.endDate.split('-').reverse().join('/')}
                  </p>
                  <span className={`inline-block mt-1 px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase ${
                    viewingReport.status === 'paid' ? 'bg-emerald-50 text-emerald-700' :
                    viewingReport.status === 'approved' ? 'bg-blue-50 text-blue-700' :
                    viewingReport.status === 'pending_approval' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {viewingReport.status}
                  </span>
                </div>
              </div>

              {/* Financial Breakdown KPIs */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white p-3 rounded-xl border border-slate-200">
                  <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400">Volume de Entregas</span>
                  <p className="text-lg font-bold text-slate-800 font-mono mt-1">{viewingReport.totalOrders}</p>
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-200">
                  <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400">Tarifas Frete</span>
                  <p className="text-lg font-bold text-slate-800 font-mono mt-1">{formattedCurrency(viewingReport.totalFreight)}</p>
                </div>
                <div className="bg-indigo-50/50 p-3 rounded-xl border border-indigo-100">
                  <span className="text-[9px] uppercase tracking-wider font-bold text-indigo-600">Total Consolidado</span>
                  <p className="text-lg font-black text-indigo-900 font-mono mt-1">{formattedCurrency(viewingReport.totalAmount)}</p>
                </div>
              </div>

              {/* Liquidation and Payment Info */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-150 space-y-2">
                <h5 className="font-bold text-slate-700 text-xs uppercase tracking-wide">Dados de Liquidação Financeira</h5>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-slate-400 block">Forma de Pagamento:</span>
                    <strong className="text-slate-800">{viewingReport.paymentMethod || 'Pix'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Data da Quitação:</span>
                    <strong className="text-slate-800">{viewingReport.paymentDate ? viewingReport.paymentDate.split('-').reverse().join('/') : 'Em aberto'}</strong>
                  </div>
                </div>
                {viewingReport.notes && (
                  <div className="pt-2 border-t border-slate-200 text-[11px]">
                    <span className="text-slate-400 block">Observações:</span>
                    <p className="text-slate-700 mt-0.5 whitespace-pre-wrap">{viewingReport.notes}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-slate-50 px-5 py-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => exportSavedReportXLSX(viewingReport)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold transition-all cursor-pointer"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Excel (.xlsx)</span>
                </button>
                <button
                  type="button"
                  onClick={() => exportSavedReportCSV(viewingReport)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold transition-all cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5 text-slate-500" />
                  <span>CSV</span>
                </button>
                <button
                  type="button"
                  onClick={() => printSavedReport(viewingReport)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold transition-all cursor-pointer"
                >
                  <Printer className="h-3.5 w-3.5 text-blue-600" />
                  <span>Imprimir</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    handleOpenEditReport(viewingReport);
                    setViewingReport(null);
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-lg text-xs font-bold transition-all cursor-pointer"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  <span>Editar</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewingReport(null)}
                  className="px-3.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-bold transition-all cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
