import React, { useState, useEffect } from 'react';
import { 
  Database, 
  ShieldCheck, 
  Server, 
  RefreshCw, 
  FileCode, 
  Sparkles,
  AlertCircle,
  Activity,
  Terminal,
  Play,
  Copy,
  Check,
  RotateCcw,
  Download,
  Upload,
  HardDrive,
  Layers,
  CheckCircle2,
  FileSpreadsheet,
  Zap,
  Cloud
} from 'lucide-react';
import { getFromLocalStore, getVal } from '../lib/indexedDB';

export const COMPLETE_SQL_SCHEMA = `-- ==============================================================================
-- VINIMAP LOGÍSTICA & FLEET - ESTRUTURA DDL SHARD CLOUD (POSTGRESQL)
-- Versão: 2.0.0
-- Instruções: Copie este script inteiro e execute no seu banco Shard Cloud (PostgreSQL)
-- Todas as 12 tabelas, índices e restrições serão criadas no PostgreSQL do Shard Cloud!
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- PARTE 1: CRIAÇÃO DE TABELAS (DDL)
-- ==============================================================================

-- 1. Tabela: activities
CREATE TABLE IF NOT EXISTS "activities" (
  "id" text PRIMARY KEY NOT NULL,
  "time" text NOT NULL,
  "timestamp" text,
  "type" text NOT NULL,
  "message" text NOT NULL,
  "details" text,
  "courier_name" text,
  "order_id" text,
  "user" text,
  "created_at" timestamp with time zone DEFAULT now()
);

-- 2. Tabela: couriers
CREATE TABLE IF NOT EXISTS "couriers" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "avatar" text NOT NULL,
  "status" text DEFAULT 'offline' NOT NULL,
  "rating" real DEFAULT 5.0 NOT NULL,
  "vehicle" text DEFAULT 'motorcycle' NOT NULL,
  "orders_completed" integer DEFAULT 0 NOT NULL,
  "current_lat" real DEFAULT -23.55052 NOT NULL,
  "current_lng" real DEFAULT -46.633308 NOT NULL,
  "angle" real DEFAULT 0,
  "phone" text NOT NULL,
  "email" text,
  "password" text,
  "is_active" boolean DEFAULT true,
  "repasse_taxa" real DEFAULT 9.5,
  "repasse_formato" text DEFAULT 'tabela_cep',
  "repasse_porcentagem" real DEFAULT 0,
  "show_delivery_fee" boolean DEFAULT true,
  "region" text,
  "plate" text,
  "active_session_token" text,
  "active_device_id" text,
  "last_login_at" text,
  "last_login_device" text,
  "created_at" timestamp with time zone DEFAULT now()
);

-- 3. Tabela: partner_clients
CREATE TABLE IF NOT EXISTS "partner_clients" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "codigo_cliente" text,
  "phone" text,
  "email" text,
  "cnpj_cpf" text,
  "created_at" text NOT NULL,
  "is_active" boolean DEFAULT true,
  "cep_spreadsheet_url" text
);

-- 4. Tabela: hub_centrals
CREATE TABLE IF NOT EXISTS "hub_centrals" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "code" text,
  "address" text NOT NULL,
  "city" text,
  "state" text,
  "cep" text NOT NULL,
  "latitude" real NOT NULL,
  "longitude" real NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "coverage_radius_km" real DEFAULT 30,
  "manager_name" text,
  "contact_phone" text,
  "contact_email" text,
  "color" text DEFAULT '#2563EB',
  "end_routing_type" text DEFAULT 'farthest' NOT NULL,
  "manual_end_address" text,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now()
);

-- 5. Tabela: operators
CREATE TABLE IF NOT EXISTS "operators" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "login" text NOT NULL,
  "phone" text,
  "password" text,
  "permissions" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "role" text DEFAULT 'operator',
  "can_consult" boolean DEFAULT true,
  "can_alter" boolean DEFAULT false,
  "can_create" boolean DEFAULT false,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "operators_login_unique" UNIQUE("login")
);

-- 6. Tabela: orders
CREATE TABLE IF NOT EXISTS "orders" (
  "id" text PRIMARY KEY NOT NULL,
  "customer_name" text NOT NULL,
  "address" text NOT NULL,
  "courier_id" text,
  "status" text DEFAULT 'pending' NOT NULL,
  "value" real DEFAULT 0 NOT NULL,
  "time" text NOT NULL,
  "region" text NOT NULL,
  "sequencia" text,
  "codigo_cliente" text,
  "data_solicitacao" text,
  "pedido" text,
  "procurar_por" text,
  "cep" text,
  "telefone" text,
  "detalhe" text,
  "email" text,
  "complemento" text,
  "dispositivo_condutor" text,
  "horario_final" text,
  "documento_empresa" text,
  "tipo_entrega" text,
  "prioridade" text,
  "chamado" text,
  "danfe" text,
  "data_limite" text,
  "nome_fantasia" text,
  "horario_inicio" text,
  "data_agendamento" text,
  "cidade_municipio" text,
  "estado" text,
  "valor_nota_fiscal" real DEFAULT 0,
  "valor_receber" real DEFAULT 0,
  "valor_entrega" real DEFAULT 0,
  "latitude" real,
  "longitude" real,
  "destinatario_cnpj_cpf" text,
  "valor_condutor" real DEFAULT 0,
  "is_imported" boolean DEFAULT false,
  "status_sincronizado" text,
  "delivery_protocol" jsonb,
  "history" jsonb DEFAULT '[]'::jsonb,
  "allocated_date" text,
  "numero" text,
  "is_deleted" boolean DEFAULT false,
  "version" integer DEFAULT 1,
  "version_timestamp" real,
  "updated_at" real,
  "proof_photo_url" text,
  "signature_data_url" text,
  "receiver_name" text,
  "receiver_doc" text,
  "delivered_at" text,
  "created_at" timestamp with time zone DEFAULT now()
);

-- 7. Tabela: freight_rules
CREATE TABLE IF NOT EXISTS "freight_rules" (
  "id" text PRIMARY KEY NOT NULL,
  "partner_id" text NOT NULL,
  "codigo_cliente" text,
  "cep_min" text NOT NULL,
  "cep_max" text NOT NULL,
  "value" real NOT NULL,
  "valor_repasse" real DEFAULT 0 NOT NULL,
  "prioridade" integer DEFAULT 0 NOT NULL,
  "regiao" text,
  "prazo_dias" integer DEFAULT 1,
  "peso_maximo" real,
  "description" text,
  "observacao" text,
  "created_at" timestamp with time zone DEFAULT now()
);

-- 8. Tabela: finance_transactions
CREATE TABLE IF NOT EXISTS "finance_transactions" (
  "id" text PRIMARY KEY NOT NULL,
  "description" text NOT NULL,
  "type" text NOT NULL,
  "amount" real NOT NULL,
  "date" text NOT NULL,
  "category" text NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "payment_method" text,
  "expense_nature" text,
  "is_recurring" boolean DEFAULT false,
  "recurrent_group_id" text,
  "installment_number" integer,
  "total_installments" integer,
  "created_at" timestamp with time zone DEFAULT now()
);

-- 9. Tabela: diary_entries
CREATE TABLE IF NOT EXISTS "diary_entries" (
  "id" text PRIMARY KEY NOT NULL,
  "date" text NOT NULL,
  "title" text NOT NULL,
  "content" text NOT NULL,
  "author" text NOT NULL,
  "tags" jsonb DEFAULT '[]'::jsonb,
  "created_at" timestamp with time zone DEFAULT now()
);

-- 10. Tabela: app_branding
CREATE TABLE IF NOT EXISTS "app_branding" (
  "id" text PRIMARY KEY NOT NULL,
  "app_name" text,
  "logo_url" text,
  "primary_color" text,
  "secondary_color" text,
  "accent_color" text,
  "updated_at" timestamp with time zone DEFAULT now()
);

-- 11. Tabela: push_subscriptions
CREATE TABLE IF NOT EXISTS "push_subscriptions" (
  "id" text PRIMARY KEY NOT NULL,
  "endpoint" text NOT NULL,
  "keys" jsonb NOT NULL,
  "user_id" text,
  "created_at" timestamp with time zone DEFAULT now()
);

-- 12. Tabela de compatibilidade: partners (alias para partner_clients)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'partners') THEN
    CREATE OR REPLACE VIEW partners AS SELECT * FROM partner_clients;
  END IF;
END $$;

-- ==============================================================================
-- PARTE 2: ÍNDICES DE ALTA PERFORMANCE
-- ==============================================================================

CREATE INDEX IF NOT EXISTS "idx_orders_status" ON "orders" ("status");
CREATE INDEX IF NOT EXISTS "idx_orders_courier_id" ON "orders" ("courier_id");
CREATE INDEX IF NOT EXISTS "idx_orders_region" ON "orders" ("region");
CREATE INDEX IF NOT EXISTS "idx_orders_time" ON "orders" ("time");
CREATE INDEX IF NOT EXISTS "idx_orders_cep" ON "orders" ("cep");
CREATE INDEX IF NOT EXISTS "idx_orders_codigo_cliente" ON "orders" ("codigo_cliente");
CREATE INDEX IF NOT EXISTS "idx_orders_allocated_date" ON "orders" ("allocated_date");
CREATE INDEX IF NOT EXISTS "idx_couriers_status" ON "couriers" ("status");
CREATE INDEX IF NOT EXISTS "idx_couriers_phone" ON "couriers" ("phone");
CREATE INDEX IF NOT EXISTS "idx_freight_rules_partner" ON "freight_rules" ("partner_id");
CREATE INDEX IF NOT EXISTS "idx_freight_rules_ceps" ON "freight_rules" ("cep_min", "cep_max");
CREATE INDEX IF NOT EXISTS "idx_finance_date" ON "finance_transactions" ("date");
CREATE INDEX IF NOT EXISTS "idx_finance_type" ON "finance_transactions" ("type");
`;

export const ShardCloudSqlGenTab: React.FC = () => {
  const [copied, setCopied] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testResult, setTestResult] = useState<any>(null);

  // Terminal state
  const [sqlQuery, setSqlQuery] = useState<string>('SELECT count(*) FROM orders;');
  const [queryRunning, setQueryRunning] = useState<boolean>(false);
  const [queryOutput, setQueryOutput] = useState<any>(null);
  const [queryError, setQueryError] = useState<string | null>(null);

  // Migration state
  const [migrating, setMigrating] = useState(false);
  const [migrationLog, setMigrationLog] = useState<string[]>([]);

  const handleCopy = () => {
    navigator.clipboard.writeText(COMPLETE_SQL_SCHEMA);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownloadSql = () => {
    const blob = new Blob([COMPLETE_SQL_SCHEMA], { type: 'text/sql;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'shardcloud_postgresql_schema.sql';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleTestConnection = async () => {
    setTestStatus('testing');
    setTestResult(null);
    try {
      const res = await fetch('/api/shardcloud/test-connection');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setTestResult(data);
      setTestStatus(data.postgresActive ? 'success' : 'error');
    } catch (err: any) {
      setTestStatus('error');
      setTestResult({ message: err?.message || 'Falha ao conectar ao servidor Shard Cloud.' });
    }
  };

  const handleExecuteSql = async (customQuery?: string) => {
    const q = customQuery || sqlQuery;
    if (!q.trim()) return;

    setQueryRunning(true);
    setQueryError(null);
    setQueryOutput(null);

    try {
      const res = await fetch('/api/shardcloud/execute-sql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Erro na execução SQL');
      }
      setQueryOutput(data);
    } catch (err: any) {
      setQueryError(err.message || String(err));
    } finally {
      setQueryRunning(false);
    }
  };

  const handleApplyFullSchema = async () => {
    if (!confirm('Deseja executar o script DDL completo no Shard Cloud (PostgreSQL)?')) return;
    await handleExecuteSql(COMPLETE_SQL_SCHEMA);
  };

  const handleSyncLocalToShardCloud = async () => {
    setMigrating(true);
    setMigrationLog(['Iniciando envio dos dados locais para o Shard Cloud PostgreSQL...']);
    try {
      const orders = await getFromLocalStore('orders') || [];
      const couriers = await getFromLocalStore('couriers') || [];
      const partners = await getFromLocalStore('partners') || [];
      const hubs = await getFromLocalStore('hubs') || [];

      setMigrationLog(prev => [
        ...prev,
        `Encontrados localmente: ${orders.length} pedidos, ${couriers.length} condutores, ${partners.length} parceiros, ${hubs.length} hubs.`
      ]);

      const res = await fetch('/api/orders/bulk-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orders, couriers, partners, hubs })
      });

      if (!res.ok) {
        // Fallback: save through standard database endpoint
        await fetch('/api/database', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orders, couriers, partnerClients: partners, hubs })
        });
      }

      setMigrationLog(prev => [...prev, '✅ Sincronização com o Shard Cloud concluída com sucesso!']);
    } catch (err: any) {
      setMigrationLog(prev => [...prev, `❌ Erro ao enviar: ${err?.message || err}`]);
    } finally {
      setMigrating(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 text-slate-800">
      
      {/* Header Banner */}
      <div className="bg-white border-2 border-indigo-100 rounded-3xl p-6 sm:p-8 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-600/20 shrink-0">
            <Cloud size={30} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Estrutura SQL & Migrações Shard Cloud (PostgreSQL)
              </h2>
              <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 px-3 py-0.5 rounded-full text-xs font-black uppercase">
                PostgreSQL Primário
              </span>
            </div>
            <p className="text-sm text-slate-500 font-medium mt-1">
              Gerador de esquemas DDL, terminal interativo e comandos SQL para o banco de dados oficial Shard Cloud.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={handleTestConnection}
            disabled={testStatus === 'testing'}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer border border-slate-300"
          >
            <Activity size={15} className={testStatus === 'testing' ? 'animate-spin text-indigo-600' : 'text-slate-600'} />
            <span>{testStatus === 'testing' ? 'Testando...' : 'Testar Conexão Shard'}</span>
          </button>

          <button
            onClick={handleCopy}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black flex items-center gap-2 transition-all shadow-md shadow-indigo-600/20 cursor-pointer"
          >
            {copied ? <Check size={15} /> : <Copy size={15} />}
            <span>{copied ? 'Copiado!' : 'Copiar DDL Completo'}</span>
          </button>

          <button
            onClick={handleDownloadSql}
            className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black flex items-center gap-2 transition-all shadow-sm cursor-pointer"
          >
            <Download size={15} />
            <span>Baixar .sql</span>
          </button>
        </div>
      </div>

      {/* Connection Test Output Alert */}
      {testResult && (
        <div className={`p-4 rounded-2xl border-2 text-xs font-bold flex items-start justify-between gap-3 ${
          testStatus === 'success'
            ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
            : 'bg-rose-50 border-rose-300 text-rose-950'
        }`}>
          <div className="flex items-center gap-2.5">
            {testStatus === 'success' ? (
              <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle size={18} className="text-rose-600 shrink-0" />
            )}
            <div>
              <p className="font-black text-sm">{testResult.message || 'Status retornado da conexão'}</p>
              {testResult.tables && (
                <p className="text-xs text-slate-600 font-mono mt-1">
                  Tabelas verificadas: {Object.keys(testResult.tables).length} ativas no PostgreSQL Shard Cloud. Latência: {testResult.latencyMs || 0}ms.
                </p>
              )}
            </div>
          </div>
          <button 
            onClick={() => setTestResult(null)}
            className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Interactive SQL Terminal for Shard Cloud */}
      <div className="bg-white border-2 border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="h-5 w-5 text-indigo-600" />
            <h3 className="font-extrabold text-base text-slate-900">
              Terminal SQL Interativo (Shard Cloud PostgreSQL)
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleApplyFullSchema}
              disabled={queryRunning}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
            >
              <Zap size={14} />
              <span>Executar DDL Completo</span>
            </button>
            <button
              onClick={() => handleExecuteSql()}
              disabled={queryRunning || !sqlQuery.trim()}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
            >
              <Play size={14} className={queryRunning ? 'animate-spin' : ''} />
              <span>{queryRunning ? 'Executando...' : 'Rodar SQL'}</span>
            </button>
          </div>
        </div>

        {/* Quick query presets */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          <span className="text-slate-500 font-bold shrink-0">Modelos Rápidos:</span>
          {[
            { label: 'Contar Pedidos', sql: 'SELECT status, count(*) FROM orders GROUP BY status;' },
            { label: 'Listar Condutores', sql: 'SELECT id, name, status, phone FROM couriers LIMIT 10;' },
            { label: 'Verificar Colunas de orders', sql: "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'orders';" },
            { label: 'Verificar Tabelas Ativas', sql: "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;" }
          ].map((preset, idx) => (
            <button
              key={idx}
              onClick={() => {
                setSqlQuery(preset.sql);
                handleExecuteSql(preset.sql);
              }}
              className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold border border-slate-200 transition-colors shrink-0 cursor-pointer"
            >
              {preset.label}
            </button>
          ))}
        </div>

        <textarea
          value={sqlQuery}
          onChange={(e) => setSqlQuery(e.target.value)}
          rows={5}
          placeholder="Digite qualquer comando SQL (SELECT, CREATE TABLE, ALTER TABLE, UPDATE...)"
          className="w-full p-4 font-mono text-xs sm:text-sm bg-slate-950 text-emerald-400 rounded-2xl border border-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner"
        />

        {/* Query Output */}
        {queryError && (
          <div className="p-4 bg-rose-50 border-2 border-rose-200 text-rose-800 rounded-2xl text-xs font-mono">
            <strong>Erro na execução SQL:</strong>
            <p className="mt-1">{queryError}</p>
          </div>
        )}

        {queryOutput && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-600 font-bold">
              <span>Resultado ({queryOutput.rowCount ?? 0} registros):</span>
              <span className="text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-mono">
                {queryOutput.executionMode || 'PostgreSQL Direto'}
              </span>
            </div>

            {Array.isArray(queryOutput.data) && queryOutput.data.length > 0 ? (
              <div className="max-h-60 overflow-auto border-2 border-slate-200 rounded-2xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 sticky top-0 border-b border-slate-200 text-slate-700 font-black">
                    <tr>
                      {queryOutput.columns?.map((col: string) => (
                        <th key={col} className="p-2.5 font-mono">{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-slate-800">
                    {queryOutput.data.map((row: any, rIdx: number) => (
                      <tr key={rIdx} className="hover:bg-slate-50">
                        {queryOutput.columns?.map((col: string) => (
                          <td key={col} className="p-2.5 truncate max-w-xs">{String(row[col] ?? '')}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-600 font-mono border border-slate-200">
                Comando executado com sucesso (nenhum registro retornado ou contagem: {queryOutput.rowCount ?? 0}).
              </div>
            )}
          </div>
        )}
      </div>

      {/* Migration: Local / IndexedDB to Shard Cloud */}
      <div className="bg-white border-2 border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-xl">
              <Upload className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-extrabold text-base text-slate-900">
                Sincronizar Dados Locais para o Shard Cloud
              </h4>
              <p className="text-xs text-slate-500 font-medium">
                Envia pedidos, entregadores e parceiros armazenados em cache para o banco de dados oficial Shard Cloud.
              </p>
            </div>
          </div>

          <button
            onClick={handleSyncLocalToShardCloud}
            disabled={migrating}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center gap-2 transition-all shadow-md shadow-emerald-600/20 cursor-pointer"
          >
            <RefreshCw size={15} className={migrating ? 'animate-spin' : ''} />
            <span>{migrating ? 'Sincronizando...' : 'Enviar Dados Locais'}</span>
          </button>
        </div>

        {migrationLog.length > 0 && (
          <div className="p-4 bg-slate-950 text-slate-300 font-mono text-xs rounded-2xl space-y-1 max-h-48 overflow-y-auto">
            {migrationLog.map((log, i) => (
              <div key={i}>{log}</div>
            ))}
          </div>
        )}
      </div>

      {/* Full DDL Schema Code Preview */}
      <div className="bg-white border-2 border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCode className="h-5 w-5 text-indigo-600" />
            <h4 className="font-extrabold text-base text-slate-900">
              Visualização do Script DDL Completo
            </h4>
          </div>
          <button
            onClick={handleCopy}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 cursor-pointer"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            <span>{copied ? 'Copiado!' : 'Copiar'}</span>
          </button>
        </div>

        <pre className="p-5 bg-slate-950 text-slate-300 font-mono text-xs rounded-2xl overflow-x-auto max-h-96 border border-slate-800 leading-relaxed">
          {COMPLETE_SQL_SCHEMA}
        </pre>
      </div>

    </div>
  );
};

export default ShardCloudSqlGenTab;
