import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  RefreshCw, 
  Database, 
  Copy, 
  Check, 
  ExternalLink,
  Lock,
  Github,
  GitBranch,
  Terminal,
  Key,
  FolderOpen,
  Save,
  Eye,
  EyeOff,
  Cloud,
  Globe,
  Wifi,
  Zap,
  Info
} from 'lucide-react';
import { testFirestoreConnection, resetFirestoreCircuit } from '../lib/firebase';

interface EnvDiagnosticsData {
  firebase: {
    hasConfigFile: boolean;
    projectId: string;
    databaseId: string;
    VITE_FIREBASE_API_KEY: boolean;
    VITE_FIREBASE_AUTH_DOMAIN: boolean;
    VITE_FIREBASE_PROJECT_ID: boolean;
    VITE_FIREBASE_STORAGE_BUCKET: boolean;
    VITE_FIREBASE_MESSAGING_SENDER_ID: boolean;
    VITE_FIREBASE_APP_ID: boolean;
    VITE_FIREBASE_FIRESTORE_DATABASE_ID: boolean;
    isLiveFirestoreActive: boolean;
  };
  shardCloud: {
    hasConfig: boolean;
    DATABASE_URL: boolean;
    databaseUrlValue?: string;
    isDirectPostgresActive: boolean;
    isShardCloudActive: boolean;
  };
  gemini: {
    GEMINI_API_KEY: boolean;
  };
  github?: {
    GITHUB_PAT: boolean;
    GITHUB_USERNAME: boolean;
    GITHUB_REPO: boolean;
    usernameValue: string;
    repoValue: string;
  };
  vercel?: {
    hasVercelJson: boolean;
    VERCEL_ENV: boolean;
    VERCEL_URL: string;
    isVercelActive: boolean;
  };
  app: {
    APP_URL: boolean;
    appUrlValue: string;
  };
}

export default function EnvironmentConfigTab() {
  const metaEnv = (import.meta as any).env || {};
  const [data, setData] = useState<EnvDiagnosticsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'all' | 'shardcloud' | 'github' | 'firebase' | 'gemini'>('all');

  // Shard Cloud Live Connection Test State
  const [shardTestLoading, setShardTestLoading] = useState(false);
  const [shardTestResult, setShardTestResult] = useState<any | null>(null);
  const [copiedShardCloudEnv, setCopiedShardCloudEnv] = useState(false);

  // Shard Cloud Database URL Form State
  const [databaseUrlForm, setDatabaseUrlForm] = useState('');
  const [showDbUrl, setShowDbUrl] = useState(false);
  const [shardSaveLoading, setShardSaveLoading] = useState(false);
  const [shardSaveMessage, setShardSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // GitHub Quick Push State
  const [pushLoading, setPushLoading] = useState(false);
  const [pushResult, setPushResult] = useState<{
    success: boolean;
    message: string;
    causeAdvice?: string;
    repoUrl?: string;
    canBypass?: boolean;
  } | null>(null);

  // GitHub Personal Access Token Form States
  const [githubPat, setGithubPat] = useState('');
  const [githubUser, setGithubUser] = useState('');
  const [githubRepo, setGithubRepo] = useState('');
  const [showPat, setShowPat] = useState(false);
  const [patLoading, setPatLoading] = useState(false);
  const [patError, setPatError] = useState<string | null>(null);
  const [patSuccess, setPatSuccess] = useState<string | null>(null);

  // Firebase Live Test / Reconnect State
  const [fbTestLoading, setFbTestLoading] = useState(false);
  const [fbTestResult, setFbTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleTestFirestore = async () => {
    setFbTestLoading(true);
    setFbTestResult(null);
    try {
      const res = await testFirestoreConnection();
      setFbTestResult(res);
      await fetchDiagnostics();
    } catch (err: any) {
      setFbTestResult({ success: false, message: err?.message || 'Erro ao testar Firestore' });
    } finally {
      setFbTestLoading(false);
    }
  };

  const getShardCloudEnvSnippet = () => {
    const fbProjectId = (metaEnv.VITE_FIREBASE_PROJECT_ID || data?.firebase?.projectId || '').trim();
    const fbApiKey = (metaEnv.VITE_FIREBASE_API_KEY || '').trim();
    const fbAuthDomain = (metaEnv.VITE_FIREBASE_AUTH_DOMAIN || (fbProjectId ? `${fbProjectId}.firebaseapp.com` : '')).trim();
    const fbDbId = (metaEnv.VITE_FIREBASE_FIRESTORE_DATABASE_ID || data?.firebase?.databaseId || '').trim();

    return `# ========================================================
# VARIÁVEIS DE AMBIENTE - SHARD CLOUD (SETTINGS > ENVIRONMENT VARIABLES)
# ========================================================

# 1. Conexão Principal PostgreSQL no Shard Cloud (Drizzle ORM)
DATABASE_URL=postgresql://postgres:[SUA_SENHA]@[HOST_SHARD_CLOUD]:5432/postgres?sslmode=require
POSTGRES_URL=postgresql://postgres:[SUA_SENHA]@[HOST_SHARD_CLOUD]:5432/postgres?sslmode=require

# 2. Firebase Cloud Firestore (Backup e Sincronização em Tempo Real)
VITE_FIREBASE_PROJECT_ID=${fbProjectId}
${fbApiKey ? `VITE_FIREBASE_API_KEY=${fbApiKey}\n` : ''}VITE_FIREBASE_AUTH_DOMAIN=${fbAuthDomain}
VITE_FIREBASE_FIRESTORE_DATABASE_ID=${fbDbId}
`;
  };

  const handleCopyShardCloudEnv = () => {
    const text = getShardCloudEnvSnippet();
    navigator.clipboard.writeText(text);
    setCopiedShardCloudEnv(true);
    setTimeout(() => setCopiedShardCloudEnv(false), 2500);
  };

  const fetchDiagnostics = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/env-diagnostics');
      if (!res.ok) {
        throw new Error(`Erro HTTP: ${res.status}`);
      }
      const json = await res.json();
      setData(json);
      if (json.github) {
        setGithubUser(json.github.usernameValue || 'VINIMAPLOG');
        setGithubRepo('VINIMAP-ACF');
      }
      if (json.shardCloud?.databaseUrlValue && !json.shardCloud.databaseUrlValue.includes('xxxxx')) {
        setDatabaseUrlForm(json.shardCloud.databaseUrlValue);
      }
    } catch (err: any) {
      console.error("Erro ao carregar diagnóstico de ambiente:", err);
      setError("Não foi possível carregar os diagnósticos do servidor de backend.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveShardCloudConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!databaseUrlForm.trim()) {
      setShardSaveMessage({ type: 'error', text: 'Informe a Connection String do PostgreSQL (DATABASE_URL) do Shard Cloud.' });
      return;
    }
    setShardSaveLoading(true);
    setShardSaveMessage(null);
    try {
      const res = await fetch('/api/save-shardcloud-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ databaseUrl: databaseUrlForm.trim() })
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setShardSaveMessage({
          type: 'success',
          text: json.message || 'Configuração salva com sucesso no Shard Cloud!'
        });
        await fetchDiagnostics();
      } else {
        setShardSaveMessage({ type: 'error', text: json.error || 'Erro ao salvar configurações do Shard Cloud.' });
      }
    } catch (err: any) {
      setShardSaveMessage({ type: 'error', text: 'Erro de comunicação ao salvar credenciais do Shard Cloud.' });
    } finally {
      setShardSaveLoading(false);
    }
  };

  const handleTestShardCloudConnection = async () => {
    setShardTestLoading(true);
    setShardTestResult(null);
    try {
      const res = await fetch('/api/shardcloud/test-connection');
      const json = await res.json();
      setShardTestResult(json);
    } catch (err: any) {
      setShardTestResult({
        overallStatus: 'error',
        message: 'Falha de comunicação com o backend do Shard Cloud.'
      });
    } finally {
      setShardTestLoading(false);
    }
  };

  const handlePushCode = async (forceEmulate = false) => {
    setPushLoading(true);
    setPushResult(null);
    try {
      const res = await fetch('/api/github/push-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forceEmulate })
      });
      const json = await res.json();
      setPushResult({
        success: json.success,
        message: json.message || (json.success ? 'Deploy enviado com sucesso!' : 'Erro ao enviar código'),
        causeAdvice: json.causeAdvice,
        repoUrl: json.repoUrl,
        canBypass: json.canBypass
      });
      if (json.success) {
        fetchDiagnostics();
      }
    } catch (err: any) {
      setPushResult({
        success: false,
        message: `Falha na requisição: ${err.message || 'Erro de conexão'}`
      });
    } finally {
      setPushLoading(false);
    }
  };

  const handleSavePat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!githubPat.trim()) {
      setPatError('Informe o Personal Access Token (PAT).');
      return;
    }
    setPatLoading(true);
    setPatError(null);
    setPatSuccess(null);
    try {
      const res = await fetch('/api/github/connect-pat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pat: githubPat.trim(),
          token: githubPat.trim(),
          username: githubUser.trim(),
          repo: githubRepo.trim()
        })
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setPatSuccess(json.message);
        setGithubPat('');
        await fetchDiagnostics();
      } else {
        setPatError(json.error || 'Erro ao vincular token GitHub.');
      }
    } catch (err: any) {
      setPatError('Erro de comunicação com o servidor.');
    } finally {
      setPatLoading(false);
    }
  };

  useEffect(() => {
    fetchDiagnostics();
  }, []);

  const handleCopy = (val: string, keyName: string) => {
    if (!val) return;
    navigator.clipboard.writeText(val);
    setCopiedKey(keyName);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-150 p-8 flex flex-col items-center justify-center min-h-[350px]">
        <RefreshCw className="h-8 w-8 text-blue-600 animate-spin mb-3" />
        <p className="text-sm font-bold text-slate-700">Auditando conexões do Shard Cloud...</p>
        <p className="text-xs text-slate-400 mt-1">Verificando PostgreSQL, GitHub e Firebase</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-white rounded-2xl border border-rose-200 p-8 flex flex-col items-center justify-center min-h-[350px]">
        <AlertTriangle className="h-8 w-8 text-rose-500 mb-3" />
        <p className="text-sm font-bold text-rose-700">{error || 'Falha ao carregar dados'}</p>
        <button
          onClick={fetchDiagnostics}
          className="mt-4 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all flex items-center gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          <span>Tentar Novamente</span>
        </button>
      </div>
    );
  }

  const fbKeys = [
    { key: 'VITE_FIREBASE_PROJECT_ID', isSet: data.firebase.VITE_FIREBASE_PROJECT_ID },
    { key: 'VITE_FIREBASE_API_KEY', isSet: data.firebase.VITE_FIREBASE_API_KEY },
    { key: 'VITE_FIREBASE_AUTH_DOMAIN', isSet: data.firebase.VITE_FIREBASE_AUTH_DOMAIN },
    { key: 'VITE_FIREBASE_FIRESTORE_DATABASE_ID', isSet: data.firebase.VITE_FIREBASE_FIRESTORE_DATABASE_ID },
  ];

  const shardKeys = [
    { key: 'DATABASE_URL', isSet: data.shardCloud?.DATABASE_URL || false },
    { key: 'POSTGRES_URL', isSet: data.shardCloud?.DATABASE_URL || false },
  ];

  const fbCount = fbKeys.filter(k => k.isSet).length;
  const shardCount = shardKeys.filter(k => k.isSet).length;

  return (
    <div className="space-y-6">
      {/* Top Banner Overview */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 rounded-2xl p-6 text-white shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Shard Cloud • PostgreSQL Full-Stack
            </span>
          </div>
          <h2 className="text-xl font-black tracking-tight">Painel de Configurações & Ambiente Shard Cloud</h2>
          <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
            Diagnóstico em tempo real da infraestrutura PostgreSQL no Shard Cloud, repositório GitHub e contingência em tempo real.
          </p>
        </div>

        <div className="flex items-center gap-2 self-stretch md:self-auto justify-end">
          <button
            onClick={fetchDiagnostics}
            className="px-3.5 py-2 bg-white/10 hover:bg-white/15 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 border border-white/10 cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Atualizar Status</span>
          </button>
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Shard Cloud PostgreSQL */}
        <div 
          onClick={() => setActiveView('shardcloud')}
          className={`bg-white border rounded-2xl p-4.5 cursor-pointer transition-all ${
            activeView === 'shardcloud' ? 'ring-2 ring-blue-600 border-blue-600' : 'border-slate-150 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Shard Cloud</span>
            <div className={`p-2 rounded-xl ${data.shardCloud?.isDirectPostgresActive ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
              <Database className="h-4 w-4" />
            </div>
          </div>
          <p className="text-lg font-black text-slate-900 mt-2">PostgreSQL</p>
          <div className="flex items-center justify-between text-xs mt-1">
            <span className="text-slate-500 font-medium">Status da Conexão</span>
            <span className={`font-bold ${data.shardCloud?.isDirectPostgresActive ? 'text-emerald-600' : 'text-rose-600'}`}>
              {data.shardCloud?.isDirectPostgresActive ? 'Conectado (TCP 5432)' : 'Configurar URL'}
            </span>
          </div>
        </div>

        {/* GitHub Repository */}
        <div 
          onClick={() => setActiveView('github')}
          className={`bg-white border rounded-2xl p-4.5 cursor-pointer transition-all ${
            activeView === 'github' ? 'ring-2 ring-blue-600 border-blue-600' : 'border-slate-150 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">GitHub CI/CD</span>
            <div className={`p-2 rounded-xl ${data.github?.GITHUB_PAT ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
              <Github className="h-4 w-4" />
            </div>
          </div>
          <p className="text-lg font-black text-slate-900 mt-2">Deploy Shard Cloud</p>
          <div className="flex items-center justify-between text-xs mt-1">
            <span className="text-slate-500 font-medium">Token PAT</span>
            <span className={`font-bold ${data.github?.GITHUB_PAT ? 'text-emerald-600' : 'text-amber-600'}`}>
              {data.github?.GITHUB_PAT ? 'Conectado' : 'Pendente'}
            </span>
          </div>
        </div>

        {/* Firebase Firestore */}
        <div 
          onClick={() => setActiveView('firebase')}
          className={`bg-white border rounded-2xl p-4.5 cursor-pointer transition-all ${
            activeView === 'firebase' ? 'ring-2 ring-blue-600 border-blue-600' : 'border-slate-150 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Firebase</span>
            <div className={`p-2 rounded-xl ${fbCount === fbKeys.length ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
              <Cloud className="h-4 w-4" />
            </div>
          </div>
          <p className="text-lg font-black text-slate-900 mt-2">Firestore Backup</p>
          <div className="flex items-center justify-between text-xs mt-1">
            <span className="text-slate-500 font-medium">{fbCount} de {fbKeys.length} Variáveis</span>
            <span className={`font-bold ${fbCount === fbKeys.length ? 'text-emerald-600' : 'text-amber-600'}`}>
              {fbCount === fbKeys.length ? '100% Configurado' : 'Parcial'}
            </span>
          </div>
        </div>

        {/* Gemini AI */}
        <div 
          onClick={() => setActiveView('gemini')}
          className={`bg-white border rounded-2xl p-4.5 cursor-pointer transition-all ${
            activeView === 'gemini' ? 'ring-2 ring-blue-600 border-blue-600' : 'border-slate-150 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Inteligência Artificial</span>
            <div className={`p-2 rounded-xl ${data.gemini.GEMINI_API_KEY ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
              <Zap className="h-4 w-4" />
            </div>
          </div>
          <p className="text-lg font-black text-slate-900 mt-2">Gemini 2.5</p>
          <div className="flex items-center justify-between text-xs mt-1">
            <span className="text-slate-500 font-medium">Chave de API</span>
            <span className={`font-bold ${data.gemini.GEMINI_API_KEY ? 'text-indigo-600' : 'text-slate-400'}`}>
              {data.gemini.GEMINI_API_KEY ? 'Ativa' : 'Não configurada'}
            </span>
          </div>
        </div>
      </div>

      {/* Navegação entre Sub-Abas de Configuração */}
      <div className="flex items-center gap-1.5 border-b border-slate-200 pb-2 overflow-x-auto">
        {[
          { id: 'all', label: 'Visão Geral Completa' },
          { id: 'shardcloud', label: 'Shard Cloud (PostgreSQL)' },
          { id: 'github', label: 'GitHub Sync & Deploy' },
          { id: 'firebase', label: 'Firebase Firestore' },
          { id: 'gemini', label: 'Gemini IA' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveView(tab.id as any)}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap cursor-pointer ${
              activeView === tab.id
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Conteúdo da Aba */}
      <div className="space-y-6">
        {/* SHARD CLOUD POSTGRESQL PANEL */}
        {(activeView === 'all' || activeView === 'shardcloud') && (
          <div className="bg-white border border-slate-150 rounded-2xl p-6 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-600 text-white rounded-xl shrink-0 shadow-xs">
                  <Database className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">PostgreSQL Shard Cloud (Drizzle ORM)</h3>
                  <p className="text-[11px] text-slate-400">Banco de dados relacional principal de alta performance conectado na porta 5432</p>
                </div>
              </div>

              <div className="flex gap-2">
                <span className={`px-2.5 py-1 text-xs font-bold rounded-full ${
                  data.shardCloud?.isDirectPostgresActive 
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                }`}>
                  TCP 5432: {data.shardCloud?.isDirectPostgresActive ? 'Conectado' : 'Aguardando Conexão'}
                </span>
              </div>
            </div>

            {/* Informações da Conexão */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-2">
                  <Key className="h-4 w-4 text-blue-600" />
                  <span>Configurar Connection String do Shard Cloud</span>
                </span>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Informe a URL de conexão do PostgreSQL (DATABASE_URL) fornecida pelo Shard Cloud para conexão imediata via pooler.
                </p>

                <form onSubmit={handleSaveShardCloudConfig} className="space-y-3 pt-2">
                  {shardSaveMessage && (
                    <div className={`p-2.5 rounded-lg text-xs font-medium ${
                      shardSaveMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
                    }`}>
                      {shardSaveMessage.text}
                    </div>
                  )}

                  <div className="relative">
                    <input
                      type={showDbUrl ? 'text' : 'password'}
                      placeholder="postgresql://postgres:senha@host-shard-cloud:5432/postgres?sslmode=require"
                      value={databaseUrlForm}
                      onChange={(e) => setDatabaseUrlForm(e.target.value)}
                      className="w-full text-xs font-mono px-3 py-2 pr-10 rounded-lg border border-slate-300 focus:outline-blue-600 bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowDbUrl(!showDbUrl)}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      {showDbUrl ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={shardSaveLoading}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                    >
                      {shardSaveLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                      <span>{shardSaveLoading ? 'Salvando...' : 'Salvar no Shard Cloud'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleTestShardCloudConnection}
                      disabled={shardTestLoading}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${shardTestLoading ? 'animate-spin' : ''}`} />
                      <span>{shardTestLoading ? 'Testando...' : 'Testar Conexão Ao Vivo'}</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Status do Teste ao Vivo */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <Terminal className="h-4 w-4 text-emerald-600" />
                      <span>Integridade das Tabelas do Shard Cloud</span>
                    </span>
                    <button
                      onClick={handleCopyShardCloudEnv}
                      className="text-[11px] text-blue-600 hover:text-blue-700 font-bold flex items-center gap-1"
                    >
                      {copiedShardCloudEnv ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                      <span>{copiedShardCloudEnv ? 'Copiado!' : 'Copiar Variáveis'}</span>
                    </button>
                  </div>

                  {shardTestResult ? (
                    <div className="mt-3 space-y-2">
                      <div className={`p-2.5 rounded-lg text-xs font-medium flex items-center justify-between ${
                        shardTestResult.overallStatus === 'healthy' 
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                          : 'bg-amber-50 text-amber-800 border border-amber-200'
                      }`}>
                        <span>{shardTestResult.message}</span>
                        <span className="text-[10px] font-mono font-bold bg-white/60 px-1.5 py-0.5 rounded">
                          ⚡ {shardTestResult.latencyMs} ms
                        </span>
                      </div>

                      {shardTestResult.tables && (
                        <div className="grid grid-cols-2 gap-1.5 text-[11px] font-mono mt-2">
                          {Object.entries(shardTestResult.tables).map(([tbl, info]: [string, any]) => (
                            <div key={tbl} className="flex items-center justify-between p-1.5 bg-white border border-slate-200 rounded">
                              <span className="text-slate-600">{tbl}</span>
                              <span className={info.ok ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>
                                {info.ok ? `${info.count ?? 0} reg.` : 'ausente'}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 mt-4 leading-relaxed">
                      Clique em &quot;Testar Conexão Ao Vivo&quot; para auditar a latência e a contagem de registros em cada uma das 8 tabelas relacionais do sistema.
                    </p>
                  )}
                </div>

                <div className="text-[11px] text-slate-400 pt-2 border-t border-slate-200">
                  Pooler PostgreSQL Shard Cloud ativo na porta 5432 com TLS habilitado.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* GITHUB INTEGRATION PANEL */}
        {(activeView === 'all' || activeView === 'github') && (
          <div className="bg-white border border-slate-150 rounded-2xl p-6 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-slate-900 text-white rounded-xl shrink-0 shadow-xs">
                  <Github className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">Sincronização com GitHub e Shard Cloud</h3>
                  <p className="text-[11px] text-slate-400">Deploy contínuo para o Shard Cloud via commit na branch main</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePushCode(false)}
                  disabled={pushLoading}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${pushLoading ? 'animate-spin' : ''}`} />
                  <span>{pushLoading ? 'Enviando ao GitHub...' : 'Fazer Deploy no Shard Cloud'}</span>
                </button>
              </div>
            </div>

            {pushResult && (
              <div className={`p-4 rounded-xl text-xs space-y-2 border ${
                pushResult.success ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'
              }`}>
                <div className="flex items-center gap-2 font-bold">
                  {pushResult.success ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertTriangle className="h-4 w-4 text-rose-600" />}
                  <span>{pushResult.message}</span>
                </div>
                {pushResult.causeAdvice && (
                  <p className="text-[11px] leading-relaxed opacity-90">{pushResult.causeAdvice}</p>
                )}
                {pushResult.repoUrl && (
                  <a
                    href={pushResult.repoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-bold underline mt-1"
                  >
                    <span>Ver no GitHub</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            )}

            {/* Form de Vinculação PAT */}
            <form onSubmit={handleSavePat} className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Key className="h-4 w-4 text-slate-700" />
                <span>Credenciais do GitHub (Personal Access Token)</span>
              </span>

              {patError && (
                <div className="p-2.5 rounded-lg text-xs bg-rose-50 text-rose-700 border border-rose-200">
                  {patError}
                </div>
              )}
              {patSuccess && (
                <div className="p-2.5 rounded-lg text-xs bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {patSuccess}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Usuário / Organização</label>
                  <input
                    type="text"
                    placeholder="ex: vinimapfreitas"
                    value={githubUser}
                    onChange={(e) => setGithubUser(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-slate-900 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Nome do Repositório</label>
                  <input
                    type="text"
                    placeholder="ex: vinimap-acf"
                    value={githubRepo}
                    onChange={(e) => setGithubRepo(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-slate-900 bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Personal Access Token (PAT) com escopo &apos;repo&apos;</label>
                <div className="relative">
                  <input
                    type={showPat ? 'text' : 'password'}
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                    value={githubPat}
                    onChange={(e) => setGithubPat(e.target.value)}
                    className="w-full text-xs font-mono px-3 py-2 pr-10 rounded-lg border border-slate-300 focus:outline-slate-900 bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPat(!showPat)}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    {showPat ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={patLoading}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
              >
                {patLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                <span>{patLoading ? 'Salvando...' : 'Salvar Token GitHub'}</span>
              </button>
            </form>
          </div>
        )}

        {/* FIREBASE FIRESTORE PANEL */}
        {(activeView === 'all' || activeView === 'firebase') && (
          <div className="bg-white border border-slate-150 rounded-2xl p-6 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-500 text-white rounded-xl shrink-0 shadow-xs">
                  <Cloud className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">Firebase Cloud Firestore</h3>
                  <p className="text-[11px] text-slate-400">Espelhamento e contingência em tempo real para dispositivos móveis</p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={handleTestFirestore}
                  disabled={fbTestLoading}
                  className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-xl font-bold text-xs shadow-2xs cursor-pointer transition-all disabled:opacity-50"
                  title="Testar conexão ativa com o Cloud Firestore e liberar circuito"
                >
                  <RefreshCw size={12} className={fbTestLoading ? "animate-spin" : ""} />
                  <span>{fbTestLoading ? "Verificando..." : "Testar e Reconectar Firestore"}</span>
                </button>

                <span className={`px-2.5 py-1 text-xs font-bold rounded-full ${
                  data.firebase.isLiveFirestoreActive 
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}>
                  {data.firebase.isLiveFirestoreActive ? 'Firestore Ativo' : 'Modo Standby / Pausa'}
                </span>
              </div>
            </div>

            {fbTestResult && (
              <div className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                fbTestResult.success 
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                  : 'bg-amber-50 border-amber-200 text-amber-800'
              }`}>
                {fbTestResult.success ? (
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle size={16} className="text-amber-600 shrink-0" />
                )}
                <span>{fbTestResult.message}</span>
              </div>
            )}

            <div className="border border-slate-150 rounded-xl overflow-hidden bg-slate-50/50">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-600 text-[10px] uppercase font-bold tracking-wider">
                    <th className="p-3">Variável</th>
                    <th className="p-3">Finalidade</th>
                    <th className="p-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150 text-xs">
                  {fbKeys.map(({ key, isSet }) => (
                    <tr key={key} className="hover:bg-slate-100/50 transition-colors">
                      <td className="p-3 font-mono text-[10.5px] font-bold text-slate-700">{key}</td>
                      <td className="p-3 text-slate-500">
                        {key === 'VITE_FIREBASE_PROJECT_ID' && 'ID do projeto no Google Cloud'}
                        {key === 'VITE_FIREBASE_API_KEY' && 'Chave de API pública do Firebase'}
                        {key === 'VITE_FIREBASE_AUTH_DOMAIN' && 'Domínio de autenticação'}
                        {key === 'VITE_FIREBASE_FIRESTORE_DATABASE_ID' && 'ID do banco de dados Firestore (padrão ou dedicado)'}
                      </td>
                      <td className="p-3 text-center">
                        {isSet ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 border border-emerald-150 px-2 py-0.5 rounded-full text-[10px] font-bold">
                            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                            <span>Ok</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-rose-700 bg-rose-50 border border-rose-150 px-2 py-0.5 rounded-full text-[10px] font-bold">
                            <XCircle className="h-3 w-3 text-rose-500" />
                            <span>Ausente</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* GEMINI AI PANEL */}
        {(activeView === 'all' || activeView === 'gemini') && (
          <div className="bg-white border border-slate-150 rounded-2xl p-6 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-600 text-white rounded-xl shrink-0 shadow-xs">
                  <Zap className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">Google Gemini AI</h3>
                  <p className="text-[11px] text-slate-400">Otimização inteligente de rotas, preenchimento de endereços e sugestões</p>
                </div>
              </div>

              <span className={`px-2.5 py-1 text-xs font-bold rounded-full ${
                data.gemini.GEMINI_API_KEY 
                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' 
                  : 'bg-slate-100 text-slate-600 border border-slate-200'
              }`}>
                {data.gemini.GEMINI_API_KEY ? 'IA Conectada' : 'Chave não detectada'}
              </span>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              O motor Gemini utiliza a variável <code className="font-mono bg-slate-100 px-1 py-0.5 rounded">GEMINI_API_KEY</code> para geocodificação semântica de endereços e roteirização assistida por inteligência artificial.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
