import React, { useState, useEffect } from 'react';
import { updateSupabaseClient, activeSupabaseUrl, activeSupabaseAnonKey, supabase } from '../lib/supabase';
import { 
  Settings, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  RefreshCw, 
  ShieldAlert, 
  Database, 
  Sparkles, 
  Server, 
  HelpCircle, 
  Copy, 
  Check, 
  ExternalLink,
  Lock,
  Cpu,
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
  CheckCircle,
  Info
} from 'lucide-react';

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
  supabase: {
    VITE_SUPABASE_URL: boolean;
    VITE_SUPABASE_ANON_KEY: boolean;
    SUPABASE_SERVICE_ROLE_KEY: boolean;
    DATABASE_URL: boolean;
    supabaseUrlValue: string;
    isSupabaseRestActive: boolean;
    isDirectPostgresActive: boolean;
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
  shardCloud?: {
    hasConfig: boolean;
    DATABASE_URL: boolean;
    isDirectPostgresActive: boolean;
    isShardCloudActive: boolean;
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
  const [activeView, setActiveView] = useState<'all' | 'supabase' | 'github' | 'shardcloud' | 'firebase' | 'gemini'>('all');

  // Supabase Live Connection Test State
  const [supabaseTestLoading, setSupabaseTestLoading] = useState(false);
  const [supabaseTestResult, setSupabaseTestResult] = useState<any | null>(null);

  // Direct Browser Supabase Test State (for Shard Cloud readiness)
  const [browserSupabaseTestLoading, setBrowserSupabaseTestLoading] = useState(false);
  const [browserSupabaseTestResult, setBrowserSupabaseTestResult] = useState<{
    success: boolean;
    ordersCount?: number;
    couriersCount?: number;
    partnersCount?: number;
    latencyMs?: number;
    error?: string;
    details?: string;
  } | null>(null);
  const [copiedShardCloudEnv, setCopiedShardCloudEnv] = useState(false);

  const runBrowserSupabaseDirectTest = async () => {
    setBrowserSupabaseTestLoading(true);
    setBrowserSupabaseTestResult(null);
    const startTime = performance.now();
    try {
      if (!supabase) {
        throw new Error("Cliente Supabase não está inicializado no navegador. Certifique-se de configurar VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.");
      }

      const [ordersRes, couriersRes, partnersRes] = await Promise.all([
        supabase.from('orders').select('*', { count: 'exact', head: true }),
        supabase.from('couriers').select('*', { count: 'exact', head: true }),
        supabase.from('partner_clients').select('*', { count: 'exact', head: true })
      ]);

      if (ordersRes.error) throw ordersRes.error;
      if (couriersRes.error) throw couriersRes.error;

      const latencyMs = Math.round(performance.now() - startTime);

      setBrowserSupabaseTestResult({
        success: true,
        ordersCount: ordersRes.count ?? 0,
        couriersCount: couriersRes.count ?? 0,
        partnersCount: partnersRes.count ?? 0,
        latencyMs
      });
    } catch (err: any) {
      const latencyMs = Math.round(performance.now() - startTime);
      setBrowserSupabaseTestResult({
        success: false,
        latencyMs,
        error: err?.message || 'Falha na conexão direta com o Supabase a partir do navegador.',
        details: err?.details || err?.hint || String(err)
      });
    } finally {
      setBrowserSupabaseTestLoading(false);
    }
  };

  const getShardCloudEnvSnippet = () => {
    const supabaseUrl = (metaEnv.VITE_SUPABASE_URL || activeSupabaseUrl || data?.supabase?.supabaseUrlValue || '').trim();
    const supabaseAnonKey = (metaEnv.VITE_SUPABASE_ANON_KEY || activeSupabaseAnonKey || '').trim();
    const fbProjectId = (metaEnv.VITE_FIREBASE_PROJECT_ID || data?.firebase?.projectId || '').trim();
    const fbApiKey = (metaEnv.VITE_FIREBASE_API_KEY || '').trim();
    const fbAuthDomain = (metaEnv.VITE_FIREBASE_AUTH_DOMAIN || (fbProjectId ? `${fbProjectId}.firebaseapp.com` : '')).trim();
    const fbDbId = (metaEnv.VITE_FIREBASE_FIRESTORE_DATABASE_ID || data?.firebase?.databaseId || '').trim();

    return `# ========================================================
# VARIÁVEIS DE AMBIENTE PARA O SHARD CLOUD (SETTINGS > ENVIRONMENT VARIABLES)
# ========================================================

# 1. Conexão Direta PostgreSQL (Shard Cloud Pooler)
DATABASE_URL=postgresql://postgres:[SUA_SENHA]@db.gvbsigeuyjlvwcueonmg.supabase.co:5432/postgres
POSTGRES_URL=postgresql://postgres:[SUA_SENHA]@db.gvbsigeuyjlvwcueonmg.supabase.co:5432/postgres

# 2. Supabase API REST (Frontend e Navegador)
VITE_SUPABASE_URL=${supabaseUrl}
VITE_SUPABASE_ANON_KEY=${supabaseAnonKey}

# 3. Firebase Cloud Firestore
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

  // Supabase Configuration Form States
  const [supabaseFormUrl, setSupabaseFormUrl] = useState('');
  const [supabaseFormAnon, setSupabaseFormAnon] = useState('');
  const [supabaseFormServiceRole, setSupabaseFormServiceRole] = useState('');
  const [supabaseFormDbUrl, setSupabaseFormDbUrl] = useState('');
  const [showAnonKey, setShowAnonKey] = useState(false);
  const [showServiceRoleKey, setShowServiceRoleKey] = useState(false);
  const [supabaseSaveLoading, setSupabaseSaveLoading] = useState(false);
  const [supabaseSaveMessage, setSupabaseSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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
        setGithubUser(json.github.usernameValue || '');
        setGithubRepo(json.github.repoValue || '');
      }
      if (json.supabase?.supabaseUrlValue && !json.supabase.supabaseUrlValue.includes('xxxxx')) {
        setSupabaseFormUrl(json.supabase.supabaseUrlValue);
      } else if (activeSupabaseUrl && !activeSupabaseUrl.includes('xxxxx')) {
        setSupabaseFormUrl(activeSupabaseUrl);
      }
      if (activeSupabaseAnonKey && !activeSupabaseAnonKey.includes('sua_chave')) {
        setSupabaseFormAnon(activeSupabaseAnonKey);
      }
    } catch (err: any) {
      console.error("Erro ao carregar diagnóstico de ambiente:", err);
      setError("Não foi possível carregar os diagnósticos do servidor de backend.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSupabaseConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabaseFormUrl.trim() || !supabaseFormAnon.trim()) {
      setSupabaseSaveMessage({ type: 'error', text: 'Preencha a URL e a Chave Anônima (Anon Key) do Supabase.' });
      return;
    }
    setSupabaseSaveLoading(true);
    setSupabaseSaveMessage(null);
    try {
      const res = await fetch('/api/save-supabase-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supabaseUrl: supabaseFormUrl.trim(),
          supabaseAnonKey: supabaseFormAnon.trim(),
          supabaseServiceRoleKey: supabaseFormServiceRole.trim(),
          databaseUrl: supabaseFormDbUrl.trim()
        })
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setSupabaseSaveMessage({
          type: 'success',
          text: `${json.message} ${json.testMessage ? '(' + json.testMessage + ')' : ''}`
        });
        updateSupabaseClient(json.supabaseUrl, json.supabaseAnonKey);
        await fetchDiagnostics();
      } else {
        setSupabaseSaveMessage({ type: 'error', text: json.error || 'Erro ao salvar configurações do Supabase.' });
      }
    } catch (err: any) {
      setSupabaseSaveMessage({ type: 'error', text: 'Erro de comunicação ao salvar credenciais do Supabase.' });
    } finally {
      setSupabaseSaveLoading(false);
    }
  };

  const handleTestSupabaseConnection = async () => {
    setSupabaseTestLoading(true);
    setSupabaseTestResult(null);
    try {
      const res = await fetch('/api/supabase/test-connection');
      const json = await res.json();
      setSupabaseTestResult(json);
    } catch (err: any) {
      setSupabaseTestResult({
        overallStatus: 'error',
        message: 'Falha de comunicação de rede com o backend do Supabase.'
      });
    } finally {
      setSupabaseTestLoading(false);
    }
  };

  const handlePushCode = async (forceEmulate = false) => {
    setPushLoading(true);
    setPushResult(null);
    try {
      const res = await fetch('/api/github/push-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          commitMessage: 'Sincronização de Código e Configurações Shard Cloud/Supabase',
          forceEmulate 
        })
      });
      const json = await res.json();
      setPushResult({
        success: json.success,
        message: json.message || json.error || 'Operação de push concluída.',
        causeAdvice: json.causeAdvice,
        repoUrl: json.repoUrl || (data.github?.usernameValue && data.github?.repoValue ? `https://github.com/${data.github.usernameValue}/${data.github.repoValue}` : undefined),
        canBypass: json.canBypass
      });
      if (json.success) fetchDiagnostics();
    } catch (err: any) {
      setPushResult({
        success: false,
        message: 'Erro de comunicação de rede ao enviar código.'
      });
    } finally {
      setPushLoading(false);
    }
  };

  const handleConnectPat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!githubPat.trim() || !githubUser.trim() || !githubRepo.trim()) {
      setPatError("Por favor, preencha todos os campos do formulário.");
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
          username: githubUser.trim(),
          repo: githubRepo.trim()
        })
      });
      const json = await res.json();
      if (res.ok && json.success) {
        localStorage.setItem('vinimap_github_pat', githubPat.trim());
        setPatSuccess(json.message);
        setGithubPat(githubPat.trim());
        await fetchDiagnostics(); // Reload status and variables
      } else {
        setPatError(json.error || "Erro de validação ou de permissão do Token GitHub.");
      }
    } catch (err: any) {
      console.error("Erro de rede na autenticação PAT:", err);
      setPatError("Falha de comunicação de rede com o backend.");
    } finally {
      setPatLoading(false);
    }
  };

  useEffect(() => {
    fetchDiagnostics();
  }, []);

  const [resetting, setResetting] = useState<boolean>(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  const handleResetSupabaseConfig = async () => {
    if (!window.confirm("Você tem certeza de que deseja EXCLUIR todas as configurações do Supabase e do Shard Cloud? Isso redefinirá suas variáveis de ambiente para valores vazios e encerrará conexões ativas.")) {
      return;
    }
    setResetting(true);
    setResetMessage(null);
    try {
      const res = await fetch('/api/reset-supabase-config', { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        setResetMessage(json.message);
        setTimeout(() => setResetMessage(null), 8000); // Hide message after 8s
        await fetchDiagnostics(); // Reload status
      } else {
        alert("Erro ao redefinir: " + json.error);
      }
    } catch (err: any) {
      console.error("Erro ao resetar ambiente:", err);
      alert("Falha de rede ao tentar redefinir.");
    } finally {
      setResetting(false);
    }
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(label);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  if (loading) {
    return (
      <div id="env-config-loading" className="flex flex-col items-center justify-center p-16 space-y-4 bg-white border border-slate-150 rounded-2xl min-h-[400px]">
        <RefreshCw className="h-8 w-8 text-indigo-600 animate-spin" />
        <p className="text-sm font-medium text-slate-600">Verificando variáveis de ambiente do contêiner...</p>
        <p className="text-xs text-slate-400">Varrendo chaves do Firebase, Supabase e APIs do Gemini...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div id="env-config-error" className="p-8 bg-rose-50 border border-rose-150 rounded-2xl text-center space-y-4 max-w-2xl mx-auto my-10">
        <ShieldAlert className="h-10 w-10 text-rose-500 mx-auto" />
        <h3 className="text-lg font-bold text-rose-800">Falha ao Diagnosticar Ambiente</h3>
        <p className="text-sm text-rose-600 font-sans">{error || 'Dados de diagnóstico ausentes.'}</p>
        <button
          onClick={fetchDiagnostics}
          className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          <span>Tentar Novamente</span>
        </button>
      </div>
    );
  }

  // Count active / missing credentials
  const firebaseKeys = [
    { key: 'VITE_FIREBASE_API_KEY', isSet: data.firebase.VITE_FIREBASE_API_KEY },
    { key: 'VITE_FIREBASE_AUTH_DOMAIN', isSet: data.firebase.VITE_FIREBASE_AUTH_DOMAIN },
    { key: 'VITE_FIREBASE_PROJECT_ID', isSet: data.firebase.VITE_FIREBASE_PROJECT_ID },
    { key: 'VITE_FIREBASE_STORAGE_BUCKET', isSet: data.firebase.VITE_FIREBASE_STORAGE_BUCKET },
    { key: 'VITE_FIREBASE_MESSAGING_SENDER_ID', isSet: data.firebase.VITE_FIREBASE_MESSAGING_SENDER_ID },
    { key: 'VITE_FIREBASE_APP_ID', isSet: data.firebase.VITE_FIREBASE_APP_ID },
    { key: 'VITE_FIREBASE_FIRESTORE_DATABASE_ID', isSet: data.firebase.VITE_FIREBASE_FIRESTORE_DATABASE_ID }
  ];

  const supabaseKeys = [
    { key: 'VITE_SUPABASE_URL', isSet: data.supabase.VITE_SUPABASE_URL },
    { key: 'VITE_SUPABASE_ANON_KEY', isSet: data.supabase.VITE_SUPABASE_ANON_KEY },
    { key: 'SUPABASE_SERVICE_ROLE_KEY', isSet: data.supabase.SUPABASE_SERVICE_ROLE_KEY },
    { key: 'DATABASE_URL', isSet: data.supabase.DATABASE_URL }
  ];

  const githubKeys = [
    { key: 'GITHUB_PAT', isSet: !!data.github?.GITHUB_PAT },
    { key: 'GITHUB_USERNAME', isSet: !!data.github?.GITHUB_USERNAME },
    { key: 'GITHUB_REPO', isSet: !!data.github?.GITHUB_REPO }
  ];

  const firebaseCount = firebaseKeys.filter(k => k.isSet).length;
  const supabaseCount = supabaseKeys.filter(k => k.isSet).length;
  const geminiCount = data.gemini.GEMINI_API_KEY ? 1 : 0;
  const githubCount = githubKeys.filter(k => k.isSet).length;

  return (
    <div id="environment-config-tab" className="space-y-6">
      {resetMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-150 rounded-2xl flex items-center gap-3 text-emerald-800 text-xs font-semibold animate-bounce-subtle">
          <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
          <p>{resetMessage}</p>
        </div>
      )}

      {/* Overview Card */}
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden">
        {/* Background Decorative Circles */}
        <div className="absolute top-[-50px] right-[-50px] w-60 h-60 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-[-30px] left-[20%] w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/10 backdrop-blur-md border border-white/10 rounded-full text-[10.5px] text-indigo-200 font-bold tracking-wider uppercase">
              <Server className="h-3 w-3" />
              <span>Diagnóstico Amplo de Contêiner</span>
            </div>
            <h2 className="text-2xl font-black tracking-tight text-white font-sans sm:text-3xl">
              Configuração de Ambiente de Nuvem
            </h2>
            <p className="text-slate-300 text-sm max-w-2xl leading-relaxed font-sans">
              Veja o status de preenchimento das chaves em lote no arquivo <code className="bg-slate-800 border border-slate-700/60 px-1 py-0.5 rounded font-mono text-xs text-white">.env</code> de produção e no Painel de Secrets da AI Studio. Isso resolve conexões ausentes para Firebase, Supabase e Drizzle.
            </p>
          </div>

          <button
            onClick={fetchDiagnostics}
            className="self-start md:self-auto px-4 py-2.5 bg-white/10 hover:bg-white/20 active:scale-95 text-white text-xs font-bold rounded-2xl border border-white/15 transition-all cursor-pointer flex items-center gap-2 shrink-0 backdrop-blur-md"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Recarregar Variáveis</span>
          </button>
        </div>

        {/* Quick status counters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-6 border-t border-white/10 relative z-10">
          <div className="bg-white/5 border border-white/5 p-4 rounded-2xl flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Firebase Firestore</span>
              <p className="text-lg font-black text-white mt-1">
                {firebaseCount} de {firebaseKeys.length} Configurados
              </p>
            </div>
            <div className={`p-2.5 rounded-xl ${firebaseCount === firebaseKeys.length ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'}`}>
              <Database className="h-5 w-5" />
            </div>
          </div>

          <div className="bg-white/5 border border-white/5 p-4 rounded-2xl flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Supabase & Postgres</span>
              <p className="text-lg font-black text-white mt-1">
                {supabaseCount} de {supabaseKeys.length} Configurados
              </p>
            </div>
            <div className={`p-2.5 rounded-xl ${supabaseCount === supabaseKeys.length ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'}`}>
              <Server className="h-5 w-5" />
            </div>
          </div>

          <div className="bg-white/5 border border-white/5 p-4 rounded-2xl flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Gemini API Key</span>
              <p className="text-lg font-black text-white mt-1">
                {data.gemini.GEMINI_API_KEY ? 'Ativo & Configurado' : '⚠️ Ausente'}
              </p>
            </div>
            <div className={`p-2.5 rounded-xl ${data.gemini.GEMINI_API_KEY ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'}`}>
              <Sparkles className="h-5 w-5" />
            </div>
          </div>

          <div className="bg-white/5 border border-white/5 p-4 rounded-2xl flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">GitHub Link (PAT)</span>
              <p className="text-lg font-black text-white mt-1">
                {githubCount} de {githubKeys.length} Vinculados
              </p>
            </div>
            <div className={`p-2.5 rounded-xl ${githubCount === githubKeys.length ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'}`}>
              <Github className="h-5 w-5" />
            </div>
          </div>
        </div>
      </div>

      {/* PAINEL DE VALIDAÇÃO E PRONTIDÃO PARA O SHARD CLOUD */}
      <div id="shardcloud-readiness-panel" className="bg-white border-2 border-indigo-100 rounded-3xl p-6 shadow-sm space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-bold tracking-wider uppercase border border-indigo-200">
              <Zap className="h-3 w-3 text-indigo-600" />
              <span>Diagnóstico de Prontidão Shard Cloud</span>
            </div>
            <h3 className="text-lg font-black text-slate-900 font-sans flex items-center gap-2">
              <span>Status das Variáveis de Ambiente no Shard Cloud</span>
              {(() => {
                const sbUrl = metaEnv.VITE_SUPABASE_URL || activeSupabaseUrl;
                const sbKey = metaEnv.VITE_SUPABASE_ANON_KEY || activeSupabaseAnonKey;
                const ready = !!(sbUrl && sbKey);
                return ready ? (
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold border border-emerald-200 inline-flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    Pronto para o Shard Cloud
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-bold border border-amber-200 inline-flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                    Atenção: Variáveis Faltando
                  </span>
                );
              })()}
            </h3>
            <p className="text-xs text-slate-500 max-w-2xl leading-relaxed">
              No Shard Cloud, as variáveis cadastradas alimentam o banco de dados PostgreSQL direto e o frontend Vite com as chaves <code className="font-mono text-indigo-600 font-bold bg-slate-100 px-1 py-0.5 rounded">VITE_*</code>. Verifique abaixo o status de cada uma.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={runBrowserSupabaseDirectTest}
              disabled={browserSupabaseTestLoading}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-xs"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${browserSupabaseTestLoading ? 'animate-spin' : ''}`} />
              <span>{browserSupabaseTestLoading ? 'Testando Supabase...' : 'Testar Conexão Direta'}</span>
            </button>
            <button
              type="button"
              onClick={handleCopyShardCloudEnv}
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-xs"
            >
              {copiedShardCloudEnv ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copiedShardCloudEnv ? 'Copiado!' : 'Copiar .env Shard Cloud'}</span>
            </button>
          </div>
        </div>

        {/* Status Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* VITE_SUPABASE_URL */}
          {(() => {
            const val = metaEnv.VITE_SUPABASE_URL || activeSupabaseUrl;
            const ok = !!val;
            return (
              <div className={`p-3.5 rounded-2xl border transition-all ${ok ? 'bg-emerald-50/50 border-emerald-200/80' : 'bg-rose-50/60 border-rose-200'}`}>
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-xs text-slate-800">VITE_SUPABASE_URL</span>
                  <span className={`px-2 py-0.5 rounded text-[9.5px] font-bold uppercase ${ok ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                    {ok ? 'Configurado' : 'Faltando'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1 line-clamp-1 font-mono">
                  {val ? `${val.substring(0, 26)}...` : 'Não detectado no ambiente'}
                </p>
                <div className="mt-2 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[10px]">
                  <span className="text-slate-400 font-medium">Requisito:</span>
                  <span className="font-bold text-rose-600">Crítico / Obrigatório</span>
                </div>
              </div>
            );
          })()}

          {/* VITE_SUPABASE_ANON_KEY */}
          {(() => {
            const val = metaEnv.VITE_SUPABASE_ANON_KEY || activeSupabaseAnonKey;
            const ok = !!val;
            return (
              <div className={`p-3.5 rounded-2xl border transition-all ${ok ? 'bg-emerald-50/50 border-emerald-200/80' : 'bg-rose-50/60 border-rose-200'}`}>
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-xs text-slate-800">VITE_SUPABASE_ANON_KEY</span>
                  <span className={`px-2 py-0.5 rounded text-[9.5px] font-bold uppercase ${ok ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                    {ok ? 'Configurado' : 'Faltando'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1 line-clamp-1 font-mono">
                  {val ? `eyJ...${val.substring(val.length - 8)}` : 'Não detectado no ambiente'}
                </p>
                <div className="mt-2 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[10px]">
                  <span className="text-slate-400 font-medium">Requisito:</span>
                  <span className="font-bold text-rose-600">Crítico / Obrigatório</span>
                </div>
              </div>
            );
          })()}

          {/* VITE_FIREBASE_PROJECT_ID */}
          {(() => {
            const val = metaEnv.VITE_FIREBASE_PROJECT_ID || data?.firebase?.projectId;
            const ok = !!val;
            return (
              <div className={`p-3.5 rounded-2xl border transition-all ${ok ? 'bg-slate-50 border-slate-200' : 'bg-amber-50/50 border-amber-200'}`}>
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-xs text-slate-800">VITE_FIREBASE_PROJECT_ID</span>
                  <span className={`px-2 py-0.5 rounded text-[9.5px] font-bold uppercase ${ok ? 'bg-slate-200 text-slate-700' : 'bg-amber-100 text-amber-800'}`}>
                    {ok ? 'Detectado' : 'Opcional'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1 line-clamp-1 font-mono">
                  {val || 'firebase-applet-config.json'}
                </p>
                <div className="mt-2 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[10px]">
                  <span className="text-slate-400 font-medium">Status Cota:</span>
                  <span className="font-bold text-amber-600">Fallback p/ Supabase</span>
                </div>
              </div>
            );
          })()}

          {/* VITE_FIREBASE_AUTH_DOMAIN */}
          {(() => {
            const val = metaEnv.VITE_FIREBASE_AUTH_DOMAIN;
            const ok = !!val;
            return (
              <div className="p-3.5 rounded-2xl border bg-slate-50 border-slate-200 transition-all">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-xs text-slate-800">VITE_FIREBASE_AUTH_DOMAIN</span>
                  <span className="px-2 py-0.5 rounded text-[9.5px] font-bold uppercase bg-slate-200 text-slate-700">
                    {ok ? 'Detectado' : 'Automático'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1 line-clamp-1 font-mono">
                  {val || `${data?.firebase?.projectId || 'app'}.firebaseapp.com`}
                </p>
                <div className="mt-2 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[10px]">
                  <span className="text-slate-400 font-medium">Finalidade:</span>
                  <span className="font-semibold text-slate-600">Auth Login</span>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Live Test Feedback Banner (if executed) */}
        {browserSupabaseTestResult && (
          <div className={`p-4 rounded-2xl border text-xs space-y-2 ${
            browserSupabaseTestResult.success
              ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
              : 'bg-rose-50/80 border-rose-200 text-rose-950'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold">
                {browserSupabaseTestResult.success ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 text-rose-600 shrink-0" />
                )}
                <span>
                  {browserSupabaseTestResult.success
                    ? 'Conexão Direta com Supabase Validada com Sucesso!'
                    : 'Falha no Teste de Conexão com Supabase'}
                </span>
              </div>
              <span className="font-mono text-[10px] bg-white px-2 py-0.5 rounded border border-slate-200">
                Latência: {browserSupabaseTestResult.latencyMs} ms
              </span>
            </div>

            {browserSupabaseTestResult.success ? (
              <div className="grid grid-cols-3 gap-2 pt-1">
                <div className="bg-white/80 border border-emerald-200/80 p-2 rounded-xl text-center">
                  <span className="block text-[10px] text-emerald-700 font-medium">Pedidos Encontrados</span>
                  <span className="font-extrabold text-emerald-950 text-base">{browserSupabaseTestResult.ordersCount}</span>
                </div>
                <div className="bg-white/80 border border-emerald-200/80 p-2 rounded-xl text-center">
                  <span className="block text-[10px] text-emerald-700 font-medium">Entregadores Ativos</span>
                  <span className="font-extrabold text-emerald-950 text-base">{browserSupabaseTestResult.couriersCount}</span>
                </div>
                <div className="bg-white/80 border border-emerald-200/80 p-2 rounded-xl text-center">
                  <span className="block text-[10px] text-emerald-700 font-medium">Clientes Parceiros</span>
                  <span className="font-extrabold text-emerald-950 text-base">{browserSupabaseTestResult.partnersCount}</span>
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                <p className="font-semibold text-rose-800">{browserSupabaseTestResult.error}</p>
                {browserSupabaseTestResult.details && (
                  <pre className="p-2 bg-rose-100/70 rounded font-mono text-[10px] overflow-x-auto text-rose-900">
                    {browserSupabaseTestResult.details}
                  </pre>
                )}
              </div>
            )}
          </div>
        )}

        {/* Explanatory Banner: How Shard Cloud connects with databases */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2.5">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
            <HelpCircle className="h-4 w-4 text-indigo-600 shrink-0" />
            <span>Como o Shard Cloud opera e integra o banco de dados?</span>
          </div>
          <ol className="list-decimal list-inside text-xs text-slate-600 space-y-1.5 leading-relaxed">
            <li>
              <strong>Execução Server + Client no Shard Cloud:</strong> O Shard Cloud executa o contêiner completo com o servidor Node/Express e o frontend Vite integrado, suportando tanto conexões diretas via pool PostgreSQL quanto chamadas REST.
            </li>
            <li>
              <strong>Injeção de Variáveis:</strong> Configure as variáveis no painel do Shard Cloud em <strong>Environment Variables</strong>: adicione <code className="bg-white px-1 border rounded text-[11px] font-mono font-bold text-indigo-800">DATABASE_URL</code> (ou <code className="bg-white px-1 border rounded text-[11px] font-mono font-bold text-indigo-800">POSTGRES_URL</code>) para o banco e as variáveis <code className="bg-white px-1 border rounded text-[11px] font-mono font-bold text-indigo-800">VITE_SUPABASE_URL</code> e <code className="bg-white px-1 border rounded text-[11px] font-mono font-bold text-indigo-800">VITE_SUPABASE_ANON_KEY</code>.
            </li>
            <li>
              <strong>Deploy Imediato:</strong> Ao salvar as variáveis no Shard Cloud, a instância é atualizada e conecta automaticamente às 8 tabelas de logística com latência otimizada.
            </li>
          </ol>
        </div>
      </div>

      {/* View selector filter tabs */}
      <div className="flex border-b border-slate-200 gap-1.5 no-print overflow-x-auto pb-1">
        {(['all', 'supabase', 'github', 'shardcloud', 'firebase', 'gemini'] as const).map((view) => (
          <button
            key={view}
            onClick={() => setActiveView(view)}
            className={`px-4 py-2.5 font-bold text-xs transition-all border-b-2 cursor-pointer capitalize whitespace-nowrap ${
              activeView === view
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {view === 'all' ? 'Ver Tudo' : view === 'github' ? 'GitHub (PAT)' : view === 'shardcloud' ? 'Shard Cloud' : view}
          </button>
        ))}
      </div>

      {/* Grid containing tables */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Firebase Diagnostics & Supabase Tables */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Firebase Block */}
          {(activeView === 'all' || activeView === 'firebase') && (
            <div className="bg-white border border-slate-150 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-amber-50 text-amber-600 rounded-lg shrink-0">
                    <Database className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm">Firebase Cloud Firestore</h3>
                    <p className="text-[11px] text-slate-400">Banco de dados noSQL em tempo real</p>
                  </div>
                </div>
                <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full ${
                  data.firebase.isLiveFirestoreActive 
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-150' 
                    : 'bg-amber-50 text-amber-700 border border-amber-150'
                }`}>
                  {data.firebase.isLiveFirestoreActive ? 'Conexão Ativa' : 'Sincronização Local Fallback'}
                </span>
              </div>

              {/* Status Table */}
              <div className="border border-slate-150 rounded-xl overflow-hidden bg-slate-50/50">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-600 text-[10px] uppercase font-bold tracking-wider">
                      <th className="p-3">Variável (.env)</th>
                      <th className="p-3">Finalidade</th>
                      <th className="p-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150 text-xs">
                    {firebaseKeys.map(({ key, isSet }) => (
                      <tr key={key} className="hover:bg-slate-100/50 transition-colors">
                        <td className="p-3 font-mono text-[10.5px] font-bold text-slate-700">{key}</td>
                        <td className="p-3 text-slate-500">
                          {key === 'VITE_FIREBASE_API_KEY' && 'Chave de API pública de acesso ao Firebase'}
                          {key === 'VITE_FIREBASE_AUTH_DOMAIN' && 'Domínio para fluxos de autenticação do Google'}
                          {key === 'VITE_FIREBASE_PROJECT_ID' && 'ID único do seu projeto Firebase na GCP'}
                          {key === 'VITE_FIREBASE_STORAGE_BUCKET' && 'Armazenamento de assets e mídias'}
                          {key === 'VITE_FIREBASE_MESSAGING_SENDER_ID' && 'ID de rastreamento de pushes FCM'}
                          {key === 'VITE_FIREBASE_APP_ID' && 'ID de registro do aplicativo Web client'}
                          {key === 'VITE_FIREBASE_FIRESTORE_DATABASE_ID' && 'Nome do banco de dados (padrão ou customizado)'}
                        </td>
                        <td className="p-3 text-center">
                          {isSet ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 border border-emerald-150 px-2 py-0.5 rounded-full text-[10px] font-bold">
                              <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                              <span>Ok</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 border border-amber-150 px-2 py-0.5 rounded-full text-[10px] font-bold">
                              <AlertTriangle className="h-3 w-3 text-amber-500" />
                              <span>Ausente</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Useful config info */}
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 space-y-2">
                <span className="text-[10px] font-bold text-slate-600 block">Dica de Configuração:</span>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Para o Firebase, se você já tiver o arquivo <code className="bg-white px-1 border rounded text-[9.5px] font-mono text-slate-700">firebase-applet-config.json</code> no seu diretório raiz, as variáveis do .env serão preenchidas automaticamente a partir dele. Se você não tiver esse arquivo, crie-o ou rode o utilitário de Setup de Firebase.
                </p>
                {data.firebase.databaseId && (
                  <div className="flex items-center gap-2 text-[10.5px] bg-white border border-slate-150 p-2 rounded-lg">
                    <span className="font-bold text-slate-600">ID Ativo do Banco:</span>
                    <code className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-indigo-600 font-bold">{data.firebase.databaseId}</code>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Supabase Block */}
          {(activeView === 'all' || activeView === 'supabase') && (
            <div className="bg-white border border-slate-150 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg shrink-0">
                    <Database className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm">Supabase & PostgreSQL Drizzle</h3>
                    <p className="text-[11px] text-slate-400">Banco de dados relacional robusto e fila em lote</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <span className={`px-2 py-0.5 text-[9.5px] font-bold rounded-full ${
                    data.supabase.isSupabaseRestActive 
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-150' 
                      : 'bg-rose-50 text-rose-700 border border-rose-150'
                  }`}>
                    REST: {data.supabase.isSupabaseRestActive ? 'Ativo' : 'Offline'}
                  </span>
                  <span className={`px-2 py-0.5 text-[9.5px] font-bold rounded-full ${
                    data.supabase.isDirectPostgresActive 
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-150' 
                      : 'bg-rose-50 text-rose-700 border border-rose-150'
                  }`}>
                    TCP 5432: {data.supabase.isDirectPostgresActive ? 'Conectado' : 'Fallback Local'}
                  </span>
                </div>
              </div>

              {/* Status Table */}
              <div className="border border-slate-150 rounded-xl overflow-hidden bg-slate-50/50">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-600 text-[10px] uppercase font-bold tracking-wider">
                      <th className="p-3">Variável (.env)</th>
                      <th className="p-3">Finalidade</th>
                      <th className="p-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150 text-xs">
                    {supabaseKeys.map(({ key, isSet }) => (
                      <tr key={key} className="hover:bg-slate-100/50 transition-colors">
                        <td className="p-3 font-mono text-[10.5px] font-bold text-slate-700">{key}</td>
                        <td className="p-3 text-slate-500">
                          {key === 'VITE_SUPABASE_URL' && 'URL do projeto REST do Supabase (porta 443)'}
                          {key === 'VITE_SUPABASE_ANON_KEY' && 'Chave anônima para requisições diretas do navegador'}
                          {key === 'SUPABASE_SERVICE_ROLE_KEY' && 'Chave de bypass de RLS para persistência server-side'}
                          {key === 'DATABASE_URL' && 'String de conexão PostgreSQL direta para o Drizzle ORM'}
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

              {/* Form de Conexão Rápida do Supabase */}
              <form onSubmit={handleSaveSupabaseConfig} className="bg-slate-50/80 border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Key className="h-4 w-4 text-indigo-600" />
                    <span>Configuração Rápida de Credenciais do Supabase</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">Gravação automática no .env e sincronização em tempo real</span>
                </div>

                {supabaseSaveMessage && (
                  <div className={`p-3 rounded-lg text-xs font-medium border flex items-center gap-2 ${
                    supabaseSaveMessage.type === 'success' 
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                      : 'bg-rose-50 text-rose-800 border-rose-200'
                  }`}>
                    {supabaseSaveMessage.type === 'success' ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    ) : (
                      <XCircle className="h-4 w-4 text-rose-600 shrink-0" />
                    )}
                    <span>{supabaseSaveMessage.text}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-[11px] font-semibold text-slate-700">URL do Projeto (VITE_SUPABASE_URL) *</label>
                    <input
                      type="url"
                      required
                      placeholder="https://xyz.supabase.co"
                      value={supabaseFormUrl}
                      onChange={(e) => setSupabaseFormUrl(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-semibold text-slate-700">Chave Anônima (VITE_SUPABASE_ANON_KEY) *</label>
                    <div className="relative">
                      <input
                        type={showAnonKey ? "text" : "password"}
                        required
                        placeholder="eyJhbGciOiJIUzI1NiI..."
                        value={supabaseFormAnon}
                        onChange={(e) => setSupabaseFormAnon(e.target.value)}
                        className="w-full pl-3 pr-8 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowAnonKey(!showAnonKey)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showAnonKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-semibold text-slate-700">Chave Service Role (SUPABASE_SERVICE_ROLE_KEY - Opcional)</label>
                    <div className="relative">
                      <input
                        type={showServiceRoleKey ? "text" : "password"}
                        placeholder="eyJhbGciOiJIUzI1NiI... (Bypass RLS)"
                        value={supabaseFormServiceRole}
                        onChange={(e) => setSupabaseFormServiceRole(e.target.value)}
                        className="w-full pl-3 pr-8 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowServiceRoleKey(!showServiceRoleKey)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showServiceRoleKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-semibold text-slate-700">Database Connection URL (DATABASE_URL - Opcional)</label>
                    <input
                      type="text"
                      placeholder="postgresql://postgres:senha@db.xyz.supabase.co:5432/postgres"
                      value={supabaseFormDbUrl}
                      onChange={(e) => setSupabaseFormDbUrl(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    disabled={supabaseSaveLoading}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    {supabaseSaveLoading ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Save className="h-3.5 w-3.5" />
                    )}
                    <span>{supabaseSaveLoading ? 'Salvando...' : 'Salvar e Conectar Supabase'}</span>
                  </button>
                </div>
              </form>

              {/* Warning explanations for users */}
              {!data.supabase.DATABASE_URL && (
                <div className="bg-rose-50 border border-rose-150 p-3.5 rounded-xl text-[11px] text-rose-700 space-y-1.5 font-sans">
                  <p className="font-bold flex items-center gap-1.5 text-rose-800">
                    <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                    Instalação do Banco Relacional PostgreSQL Pendente
                  </p>
                  <p>
                    A variável <code className="font-mono text-[10px] bg-rose-100/60 px-1 py-0.5 rounded">DATABASE_URL</code> não foi configurada. Sem ela, o Drizzle ORM não consegue rodar migrações automatizadas ou estabelecer conexões diretas na porta 5432.
                  </p>
                  <p className="text-[10px] font-medium text-rose-600">
                    Para corrigir, crie um banco PostgreSQL no Supabase, copie a Connection String em formato de URL do postgres e cole no campo "Secrets" ou no .env.
                  </p>
                </div>
              )}

              {/* Live Connection Test Action & Panel */}
              <div className="pt-2 border-t border-slate-100 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">Diagnóstico de Latência & Leitura de Tabelas:</span>
                  <button
                    onClick={handleTestSupabaseConnection}
                    disabled={supabaseTestLoading}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${supabaseTestLoading ? 'animate-spin' : ''}`} />
                    <span>{supabaseTestLoading ? 'Testando...' : 'Testar Conexão Supabase Ao Vivo'}</span>
                  </button>
                </div>

                {supabaseTestResult && (
                  <div className={`p-3.5 rounded-xl border text-xs font-sans space-y-2.5 ${
                    supabaseTestResult.overallStatus === 'healthy' 
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : supabaseTestResult.overallStatus === 'partial'
                      ? 'bg-amber-50 border-amber-200 text-amber-900'
                      : 'bg-rose-50 border-rose-200 text-rose-900'
                  }`}>
                    <div className="flex items-center justify-between font-bold">
                      <div className="flex items-center gap-2">
                        {supabaseTestResult.overallStatus === 'healthy' ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-amber-600" />
                        )}
                        <span>{supabaseTestResult.message}</span>
                      </div>
                      <span className="font-mono text-[10px] bg-white/80 px-2 py-0.5 rounded border border-slate-200">
                        ⚡ {supabaseTestResult.latencyMs} ms
                      </span>
                    </div>

                    {supabaseTestResult.tables && Object.keys(supabaseTestResult.tables).length > 0 && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                        {Object.entries(supabaseTestResult.tables).map(([tbl, info]: [string, any]) => (
                          <div key={tbl} className="bg-white/90 p-2 rounded-lg border border-slate-200 flex items-center justify-between text-[10.5px]">
                            <span className="font-mono font-bold text-slate-800">{tbl}</span>
                            {info.ok ? (
                              <span className="text-emerald-700 font-bold bg-emerald-100 px-1.5 py-0.5 rounded text-[9.5px]">
                                {info.count !== undefined ? `${info.count} regs` : 'OK'}
                              </span>
                            ) : (
                              <span className="text-rose-700 font-bold bg-rose-100 px-1.5 py-0.5 rounded text-[9.5px]">Erro</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Gemini AI Block */}
          {(activeView === 'all' || activeView === 'gemini') && (
            <div className="bg-white border border-slate-150 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg shrink-0">
                    <Cpu className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm">Google Gemini AI Engine</h3>
                    <p className="text-[11px] text-slate-400">Automatização inteligente e roteamento</p>
                  </div>
                </div>
                <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full ${
                  data.gemini.GEMINI_API_KEY 
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-150' 
                    : 'bg-amber-50 text-amber-700 border border-amber-150'
                }`}>
                  {data.gemini.GEMINI_API_KEY ? 'Modelo Ativo' : 'Não Configurado'}
                </span>
              </div>

              <div className="bg-slate-50 border border-slate-150 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                <div className="space-y-1 text-center sm:text-left">
                  <span className="font-bold font-mono text-slate-700 block">GEMINI_API_KEY</span>
                  <p className="text-slate-500 max-w-sm text-[11px] leading-relaxed">
                    Utilizada server-side no backend do contêiner para realizar sumarização de inteligência, alocações de condutores e predições.
                  </p>
                </div>
                <div>
                  {data.gemini.GEMINI_API_KEY ? (
                    <span className="inline-flex items-center gap-1.5 text-emerald-700 bg-emerald-50 border border-emerald-150 px-3 py-1 rounded-full font-bold">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      <span>Configurado</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-amber-700 bg-amber-50 border border-amber-150 px-3 py-1 rounded-full font-bold">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      <span>Faltando</span>
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* GitHub Connection & PAT Block */}
          {(activeView === 'all' || activeView === 'github') && (
            <div className="bg-white border border-slate-150 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-slate-100 text-slate-800 rounded-lg shrink-0">
                    <Github className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm">Vinculação do GitHub (PAT)</h3>
                    <p className="text-[11px] text-slate-400">Autenticação e sincronização de repositório central</p>
                  </div>
                </div>
                <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full ${
                  data.github?.GITHUB_PAT 
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-150' 
                    : 'bg-amber-50 text-amber-700 border border-amber-150'
                }`}>
                  {data.github?.GITHUB_PAT ? 'Repositório Ativo' : 'Não Vinculado'}
                </span>
              </div>

              {/* Status display if GITHUB_PAT is set */}
              {data.github?.GITHUB_PAT && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-150 rounded-xl space-y-2 text-xs text-emerald-800">
                  <p className="font-bold flex items-center gap-1.5 text-emerald-900">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    Status do Repositório: Conexão Validada
                  </p>
                  <p>
                    O projeto está vinculado com sucesso ao repositório <strong className="font-mono text-[11px] bg-emerald-100/60 px-1 py-0.5 rounded text-emerald-900">{data.github?.usernameValue}/{data.github?.repoValue}</strong> no GitHub via Token de Acesso Pessoal (PAT).
                  </p>
                  <div className="text-[10px] text-emerald-600 flex flex-wrap gap-4 pt-1 font-medium">
                    <span>👤 Proprietário: @{data.github?.usernameValue}</span>
                    <span>📂 Repositório: {data.github?.repoValue}</span>
                    <span>🔑 PAT: Ativo (••••••••)</span>
                  </div>
                </div>
              )}

              {/* Token connection form */}
              <form onSubmit={handleConnectPat} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 block">Usuário ou Organização</label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Ex: vinimapfreitas"
                        value={githubUser}
                        onChange={(e) => setGithubUser(e.target.value)}
                        className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-slate-800"
                        required
                      />
                    </div>
                    <p className="text-[10px] text-slate-400">Proprietário do repositório no GitHub.</p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 block">Nome do Repositório</label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Ex: vinimaplog"
                        value={githubRepo}
                        onChange={(e) => setGithubRepo(e.target.value)}
                        className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-slate-800"
                        required
                      />
                    </div>
                    <p className="text-[10px] text-slate-400">Nome do repositório criado no GitHub.</p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 block">Token de Acesso Pessoal (PAT)</label>
                  <div className="relative flex items-center">
                    <input
                      type={showPat ? "text" : "password"}
                      placeholder="Ex: ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                      value={githubPat}
                      onChange={(e) => setGithubPat(e.target.value)}
                      className="w-full pl-9.5 pr-10 py-2 border border-slate-200 rounded-xl text-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-mono text-slate-800"
                      required={!data.github?.GITHUB_PAT}
                    />
                    <div className="absolute left-3 text-slate-400 pointer-events-none">
                      <Key className="h-4 w-4" />
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowPat(!showPat)}
                      className="absolute right-3 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline focus:outline-none"
                    >
                      {showPat ? "Ocultar" : "Mostrar"}
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-normal">
                    Requer permissão de <code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-[9px] text-slate-700">repo</code> clássica ou <code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-[9px] text-slate-700">Contents (read & write)</code> nas chaves Fine-grained para leitura de esquemas de banco.
                  </p>
                </div>

                {patError && (
                  <div className="p-3 bg-rose-50 border border-rose-150 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                    <XCircle className="h-4 w-4 shrink-0 text-rose-500" />
                    <p>{patError}</p>
                  </div>
                )}

                {patSuccess && (
                  <div className="p-3 bg-emerald-50 border border-emerald-150 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                    <p>{patSuccess}</p>
                  </div>
                )}

                {pushResult && (
                  <div className={`p-4 border text-xs rounded-xl space-y-2.5 ${
                    pushResult.success 
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
                      : 'bg-rose-50 border-rose-200 text-rose-900'
                  }`}>
                    <div className="flex items-start gap-2.5">
                      {pushResult.success ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                      ) : (
                        <XCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                      )}
                      <div className="space-y-1">
                        <p className="font-bold leading-tight">{pushResult.message}</p>
                        {pushResult.causeAdvice && (
                          <p className="text-[11px] text-rose-700 bg-white/70 p-2 rounded-lg border border-rose-150 font-medium">
                            💡 <strong>Dica de Correção:</strong> {pushResult.causeAdvice}
                          </p>
                        )}
                      </div>
                    </div>

                    {!pushResult.success && (
                      <div className="pt-2 border-t border-rose-200 flex flex-wrap items-center gap-2">
                        {pushResult.repoUrl && (
                          <a
                            href={pushResult.repoUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded-lg font-bold text-[11px] inline-flex items-center gap-1.5 transition-all shadow-xs"
                          >
                            <ExternalLink className="h-3 w-3" />
                            <span>Abrir Repositório no GitHub</span>
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => handlePushCode(true)}
                          disabled={pushLoading}
                          className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-[11px] inline-flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                        >
                          <RefreshCw className="h-3 w-3" />
                          <span>Forçar Sincronização (Bypass)</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
                  {data.github?.GITHUB_PAT && (
                    <button
                      type="button"
                      onClick={() => handlePushCode()}
                      disabled={pushLoading}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-2 shadow-sm disabled:opacity-50"
                    >
                      {pushLoading ? (
                        <>
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          <span>Sincronizando Código...</span>
                        </>
                      ) : (
                        <>
                          <GitBranch className="h-3.5 w-3.5" />
                          <span>Enviar Código para o GitHub (Push)</span>
                        </>
                      )}
                    </button>
                  )}

                  <button
                    type="submit"
                    disabled={patLoading}
                    className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-2 shadow-sm disabled:opacity-50 ml-auto"
                  >
                    {patLoading ? (
                      <>
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        <span>Validando Conexão...</span>
                      </>
                    ) : (
                      <>
                        <Github className="h-3.5 w-3.5" />
                        <span>{data.github?.GITHUB_PAT ? 'Atualizar Conexão GitHub' : 'Validar & Vincular GitHub'}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Shard Cloud Deploy Block with Environment Validation Dashboard */}
          {(activeView === 'all' || activeView === 'shardcloud') && (
            <div id="shardcloud-env-validator-panel" className="bg-white border border-slate-150 rounded-2xl p-6 shadow-xs space-y-6">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-slate-900 text-white rounded-xl shrink-0 shadow-xs">
                    <Cloud className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                      <span>Validador de Variáveis de Ambiente & Conexão Shard Cloud</span>
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Diagnóstico em tempo real das variáveis do Supabase, PostgreSQL e Firebase para funcionamento no Shard Cloud
                    </p>
                  </div>
                </div>

                {/* Overall Shard Cloud Readiness Badge */}
                {(() => {
                  const hasClientUrl = !!(metaEnv.VITE_SUPABASE_URL || activeSupabaseUrl);
                  const hasClientAnon = !!(metaEnv.VITE_SUPABASE_ANON_KEY || activeSupabaseAnonKey);
                  const hasDb = !!(data?.shardCloud?.DATABASE_URL || data?.supabase?.DATABASE_URL);
                  const isReady = hasClientUrl && hasClientAnon;

                  return (
                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-1.5 text-xs font-bold rounded-full inline-flex items-center gap-1.5 ${
                        isReady
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {isReady ? (
                          <>
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                            <span>Pronto para Shard Cloud ({hasDb ? 'PostgreSQL & Supabase Ativos' : 'Supabase REST Ativo'})</span>
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                            <span>Variáveis Pendentes para Shard Cloud</span>
                          </>
                        )}
                      </span>
                    </div>
                  );
                })()}
              </div>

              {/* Explanatory Educational Callout: Como o Shard Cloud opera e conecta ao banco */}
              <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-indigo-500/20 text-indigo-300 rounded-lg shrink-0 mt-0.5">
                    <Info className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-bold text-sm text-white">
                      Arquitetura e Conexão de Dados no Shard Cloud
                    </h4>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Conheça os pilares de funcionamento da sua infraestrutura no Shard Cloud para máxima estabilidade:
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  <div className="bg-white/5 border border-white/10 rounded-xl p-3.5 space-y-1.5">
                    <div className="flex items-center gap-2 text-indigo-300 font-bold text-xs">
                      <span className="w-5 h-5 rounded-full bg-indigo-500/30 flex items-center justify-center text-[11px]">1</span>
                      <span>Execução Full-Stack Contínua</span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      Diferente de ambientes estáticos, no Shard Cloud o seu servidor Node.js/Express roda continuamente, mantendo endpoints de sincronização e pool de conexões ativos.
                    </p>
                  </div>

                  <div className="bg-white/5 border border-white/10 rounded-xl p-3.5 space-y-1.5">
                    <div className="flex items-center gap-2 text-indigo-300 font-bold text-xs">
                      <span className="w-5 h-5 rounded-full bg-indigo-500/30 flex items-center justify-center text-[11px]">2</span>
                      <span>Conexão Direta ao PostgreSQL</span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      Com a variável <code className="text-amber-300 font-mono">DATABASE_URL</code> ou <code className="text-amber-300 font-mono">POSTGRES_URL</code> configurada, o backend se conecta diretamente ao banco de dados Supabase com alta performance.
                    </p>
                  </div>

                  <div className="bg-white/5 border border-white/10 rounded-xl p-3.5 space-y-1.5">
                    <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      <span>Camada REST do Frontend Vite</span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      O frontend utiliza <code className="text-emerald-300 font-mono">VITE_SUPABASE_URL</code> e <code className="text-emerald-300 font-mono">VITE_SUPABASE_ANON_KEY</code> para carregar dados em tempo real mesmo se o backend estiver em reinício.
                    </p>
                  </div>

                  <div className="bg-white/5 border border-white/10 rounded-xl p-3.5 space-y-1.5">
                    <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      <span>Circuito de Isolamento do Firestore</span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      A cota do Firestore estourou (<code className="text-rose-300 font-mono">RESOURCE_EXHAUSTED</code>). Criamos um circuit-breaker inteligente que prioriza 100% o Supabase/PostgreSQL no Shard Cloud.
                    </p>
                  </div>
                </div>
              </div>

              {/* Live Direct Browser Test Section */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="font-bold text-xs text-slate-800 flex items-center gap-2">
                      <Zap className="h-4 w-4 text-amber-500" />
                      <span>Teste em Tempo Real: Conexão do Navegador com Supabase no Shard Cloud</span>
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Verifica a comunicação direta entre a interface do usuário e o banco de dados no Shard Cloud
                    </p>
                  </div>

                  <button
                    onClick={runBrowserSupabaseDirectTest}
                    disabled={browserSupabaseTestLoading}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold text-xs rounded-xl transition-all cursor-pointer inline-flex items-center gap-2 shadow-xs shrink-0"
                  >
                    {browserSupabaseTestLoading ? (
                      <>
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        <span>Consultando Supabase...</span>
                      </>
                    ) : (
                      <>
                        <Wifi className="h-3.5 w-3.5" />
                        <span>Testar Conexão Direta do Navegador</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Test Result Feedback */}
                {browserSupabaseTestResult && (
                  <div className={`p-3.5 rounded-xl border text-xs space-y-2 ${
                    browserSupabaseTestResult.success
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-rose-50 border-rose-200 text-rose-900'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-bold">
                        {browserSupabaseTestResult.success ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-rose-600" />
                        )}
                        <span>
                          {browserSupabaseTestResult.success
                            ? 'Conexão Direta com Supabase Funcionando Perfeitamente!'
                            : 'Falha no Teste de Conexão com Supabase'}
                        </span>
                      </div>
                      <span className="font-mono text-[10px] bg-white/70 px-2 py-0.5 rounded border border-slate-200">
                        Latência: {browserSupabaseTestResult.latencyMs} ms
                      </span>
                    </div>

                    {browserSupabaseTestResult.success ? (
                      <div className="grid grid-cols-3 gap-2 pt-1">
                        <div className="bg-white/80 border border-emerald-150 p-2 rounded-lg text-center">
                          <span className="block text-[10px] text-emerald-700 font-medium">Pedidos Encontrados</span>
                          <span className="font-bold text-emerald-950 text-sm">{browserSupabaseTestResult.ordersCount}</span>
                        </div>
                        <div className="bg-white/80 border border-emerald-150 p-2 rounded-lg text-center">
                          <span className="block text-[10px] text-emerald-700 font-medium">Entregadores Ativos</span>
                          <span className="font-bold text-emerald-950 text-sm">{browserSupabaseTestResult.couriersCount}</span>
                        </div>
                        <div className="bg-white/80 border border-emerald-150 p-2 rounded-lg text-center">
                          <span className="block text-[10px] text-emerald-700 font-medium">Clientes Parceiros</span>
                          <span className="font-bold text-emerald-950 text-sm">{browserSupabaseTestResult.partnersCount}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1 text-[11px] text-rose-800">
                        <p className="font-medium">{browserSupabaseTestResult.error}</p>
                        {browserSupabaseTestResult.details && (
                          <pre className="p-2 bg-rose-100/60 rounded font-mono text-[10px] overflow-x-auto">
                            {browserSupabaseTestResult.details}
                          </pre>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Matrix of Environment Variables for Shard Cloud */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wider">
                    Matriz de Validação das Variáveis de Ambiente no Shard Cloud
                  </h4>
                  <button
                    onClick={handleCopyShardCloudEnv}
                    className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-all inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    {copiedShardCloudEnv ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                        <span>Copiado para a Área de Transferência!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span>Copiar Todas as Variáveis para Shard Cloud (.env)</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="p-3">Variável</th>
                        <th className="p-3">Importância no Shard Cloud</th>
                        <th className="p-3">Navegador (Vite)</th>
                        <th className="p-3">Servidor (Shard Cloud)</th>
                        <th className="p-3">Status Shard Cloud</th>
                        <th className="p-3 text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-150 text-slate-700">
                      {/* DATABASE_URL / POSTGRES_URL */}
                      {(() => {
                        const hasDb = !!(data?.shardCloud?.DATABASE_URL || data?.supabase?.DATABASE_URL);
                        return (
                          <tr className="hover:bg-slate-50/70 transition-colors">
                            <td className="p-3 font-mono font-bold text-indigo-950">
                              DATABASE_URL / POSTGRES_URL
                            </td>
                            <td className="p-3 text-[11px] text-slate-500">
                              String de conexão PostgreSQL para pool do backend no Shard Cloud
                            </td>
                            <td className="p-3">
                              <span className="inline-flex items-center gap-1 text-slate-500 text-[11px] italic">
                                <Lock className="h-3 w-3" />
                                <span>Server-only</span>
                              </span>
                            </td>
                            <td className="p-3">
                              {hasDb ? (
                                <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold text-[11px]">
                                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                  <span>Conectado</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-amber-600 font-semibold text-[11px]">
                                  <AlertTriangle className="h-3.5 w-3.5" />
                                  <span>Pendente</span>
                                </span>
                              )}
                            </td>
                            <td className="p-3">
                              <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded text-[10px] font-bold uppercase">
                                Recomendado
                              </span>
                            </td>
                            <td className="p-3 text-right">
                              <span className="text-[10px] text-slate-400 italic">Protegido</span>
                            </td>
                          </tr>
                        );
                      })()}

                      {/* VITE_SUPABASE_URL */}
                      {(() => {
                        const clientVal = metaEnv.VITE_SUPABASE_URL || activeSupabaseUrl;
                        const serverVal = data?.supabase?.VITE_SUPABASE_URL;

                        return (
                          <tr className="hover:bg-slate-50/70 transition-colors">
                            <td className="p-3 font-mono font-bold text-indigo-950">
                              VITE_SUPABASE_URL
                            </td>
                            <td className="p-3 text-[11px] text-slate-500">
                              URL da API REST do Supabase para o frontend ler e salvar pedidos
                            </td>
                            <td className="p-3">
                              {clientVal ? (
                                <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold text-[11px]">
                                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                  <span>Definida</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-amber-600 font-semibold text-[11px]">
                                  <AlertTriangle className="h-3.5 w-3.5" />
                                  <span>Não detectada</span>
                                </span>
                              )}
                            </td>
                            <td className="p-3">
                              {serverVal ? (
                                <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold text-[11px]">
                                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                  <span>Presente</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-slate-400 text-[11px]">
                                  <span>Ausente</span>
                                </span>
                              )}
                            </td>
                            <td className="p-3">
                              <span className="px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded text-[10px] font-bold uppercase">
                                Obrigatório
                              </span>
                            </td>
                            <td className="p-3 text-right">
                              <button
                                onClick={() => handleCopy(clientVal || data?.supabase?.supabaseUrlValue || '', 'VITE_SUPABASE_URL')}
                                className="px-2 py-1 border border-slate-200 hover:bg-slate-100 rounded text-[10.5px] font-semibold text-slate-600 inline-flex items-center gap-1"
                              >
                                {copiedKey === 'VITE_SUPABASE_URL' ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                                <span>{copiedKey === 'VITE_SUPABASE_URL' ? 'Copiado' : 'Copiar'}</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })()}

                      {/* VITE_SUPABASE_ANON_KEY */}
                      {(() => {
                        const clientVal = metaEnv.VITE_SUPABASE_ANON_KEY || activeSupabaseAnonKey;
                        const serverVal = data?.supabase?.VITE_SUPABASE_ANON_KEY;

                        return (
                          <tr className="hover:bg-slate-50/70 transition-colors">
                            <td className="p-3 font-mono font-bold text-indigo-950">
                              VITE_SUPABASE_ANON_KEY
                            </td>
                            <td className="p-3 text-[11px] text-slate-500">
                              Chave pública com proteção RLS para acesso direto no navegador
                            </td>
                            <td className="p-3">
                              {clientVal ? (
                                <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold text-[11px]">
                                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                  <span>Definida</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-amber-600 font-semibold text-[11px]">
                                  <AlertTriangle className="h-3.5 w-3.5" />
                                  <span>Não detectada</span>
                                </span>
                              )}
                            </td>
                            <td className="p-3">
                              {serverVal ? (
                                <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold text-[11px]">
                                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                  <span>Presente</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-slate-400 text-[11px]">
                                  <span>Ausente</span>
                                </span>
                              )}
                            </td>
                            <td className="p-3">
                              <span className="px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded text-[10px] font-bold uppercase">
                                Obrigatório
                              </span>
                            </td>
                            <td className="p-3 text-right">
                              <button
                                onClick={() => handleCopy(clientVal || '', 'VITE_SUPABASE_ANON_KEY')}
                                className="px-2 py-1 border border-slate-200 hover:bg-slate-100 rounded text-[10.5px] font-semibold text-slate-600 inline-flex items-center gap-1"
                              >
                                {copiedKey === 'VITE_SUPABASE_ANON_KEY' ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                                <span>{copiedKey === 'VITE_SUPABASE_ANON_KEY' ? 'Copiado' : 'Copiar'}</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })()}

                      {/* VITE_FIREBASE_PROJECT_ID */}
                      {(() => {
                        const clientVal = metaEnv.VITE_FIREBASE_PROJECT_ID || data?.firebase?.projectId;
                        const serverVal = data?.firebase?.VITE_FIREBASE_PROJECT_ID;

                        return (
                          <tr className="hover:bg-slate-50/70 transition-colors">
                            <td className="p-3 font-mono font-bold text-slate-800">
                              VITE_FIREBASE_PROJECT_ID
                            </td>
                            <td className="p-3 text-[11px] text-slate-500">
                              ID do projeto Firebase para telemetria e identificação
                            </td>
                            <td className="p-3">
                              {clientVal ? (
                                <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold text-[11px]">
                                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                  <span>Definida</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-slate-400 text-[11px]">
                                  <span>Opcional</span>
                                </span>
                              )}
                            </td>
                            <td className="p-3">
                              {serverVal ? (
                                <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold text-[11px]">
                                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                  <span>Presente</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-slate-400 text-[11px]">
                                  <span>Config File</span>
                                </span>
                              )}
                            </td>
                            <td className="p-3">
                              <span className="px-2 py-0.5 bg-slate-100 text-slate-600 border border-slate-200 rounded text-[10px] font-bold uppercase">
                                Secundário
                              </span>
                            </td>
                            <td className="p-3 text-right">
                              <button
                                onClick={() => handleCopy(clientVal || '', 'VITE_FIREBASE_PROJECT_ID')}
                                className="px-2 py-1 border border-slate-200 hover:bg-slate-100 rounded text-[10.5px] font-semibold text-slate-600 inline-flex items-center gap-1"
                              >
                                {copiedKey === 'VITE_FIREBASE_PROJECT_ID' ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                                <span>{copiedKey === 'VITE_FIREBASE_PROJECT_ID' ? 'Copiado' : 'Copiar'}</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })()}

                      {/* VITE_FIREBASE_FIRESTORE_DATABASE_ID */}
                      {(() => {
                        const clientVal = metaEnv.VITE_FIREBASE_FIRESTORE_DATABASE_ID || data?.firebase?.databaseId;

                        return (
                          <tr className="hover:bg-slate-50/70 transition-colors">
                            <td className="p-3 font-mono font-bold text-slate-800">
                              VITE_FIREBASE_FIRESTORE_DATABASE_ID
                            </td>
                            <td className="p-3 text-[11px] text-slate-500">
                              Identificador do banco Firestore no Google Cloud
                            </td>
                            <td className="p-3">
                              {clientVal ? (
                                <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold text-[11px]">
                                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                  <span>Definida</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-slate-400 text-[11px]">
                                  <span>Padrão</span>
                                </span>
                              )}
                            </td>
                            <td className="p-3">
                              <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold text-[11px]">
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                <span>Presente</span>
                              </span>
                            </td>
                            <td className="p-3">
                              <span className="px-2 py-0.5 bg-slate-100 text-slate-600 border border-slate-200 rounded text-[10px] font-bold uppercase">
                                Secundário
                              </span>
                            </td>
                            <td className="p-3 text-right">
                              <button
                                onClick={() => handleCopy(clientVal || '', 'VITE_FIREBASE_FIRESTORE_DATABASE_ID')}
                                className="px-2 py-1 border border-slate-200 hover:bg-slate-100 rounded text-[10.5px] font-semibold text-slate-600 inline-flex items-center gap-1"
                              >
                                {copiedKey === 'VITE_FIREBASE_FIRESTORE_DATABASE_ID' ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                                <span>{copiedKey === 'VITE_FIREBASE_FIRESTORE_DATABASE_ID' ? 'Copiado' : 'Copiar'}</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })()}

                      {/* GEMINI_API_KEY */}
                      <tr className="hover:bg-slate-50/70 transition-colors">
                        <td className="p-3 font-mono font-bold text-slate-800">
                          GEMINI_API_KEY
                        </td>
                        <td className="p-3 text-[11px] text-slate-500">
                          Chave da inteligência artificial (Processamento Server-side seguro)
                        </td>
                        <td className="p-3">
                          <span className="inline-flex items-center gap-1 text-slate-500 text-[11px] italic">
                            <Lock className="h-3 w-3" />
                            <span>Server-only</span>
                          </span>
                        </td>
                        <td className="p-3">
                          {data?.gemini?.GEMINI_API_KEY ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold text-[11px]">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                              <span>Configurada</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-slate-400 text-[11px]">
                              <span>Opcional</span>
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-600 border border-slate-200 rounded text-[10px] font-bold uppercase">
                            Server-only
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <span className="text-[10px] text-slate-400 italic">Oculto</span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Quick Deploy Instructions */}
              <div className="bg-slate-50 border border-slate-150 rounded-xl p-4 space-y-3">
                <span className="text-xs font-bold text-slate-800 block">Como Configurar no Painel do Shard Cloud:</span>
                <ol className="list-decimal list-inside space-y-1.5 text-[11px] text-slate-600 leading-relaxed font-medium">
                  <li>Acesse o painel do seu projeto no <strong>Shard Cloud</strong>.</li>
                  <li>Vá em <strong>Settings</strong> &gt; <strong>Environment Variables</strong> (ou Configurações de Ambiente).</li>
                  <li>Clique no botão <strong>"Copiar Todas as Variáveis para Shard Cloud"</strong> acima.</li>
                  <li>Cole as variáveis no painel e clique em <strong>Save / Apply Changes</strong>.</li>
                  <li>O Shard Cloud efetuará a sincronização e o deploy automático do contêiner com as credenciais ativas.</li>
                </ol>

                <div className="pt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleCopyShardCloudEnv}
                    className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    <span>{copiedShardCloudEnv ? 'Variáveis Copiadas!' : 'Copiar Variáveis para Shard Cloud'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Right Column: Copyable .env Template and Guide */}
        <div className="space-y-6">
          
          {/* Quick Copy Env Block */}
          <div className="bg-white border border-slate-150 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Template do Arquivo .env</h4>
              <button
                onClick={() => handleCopy(
                  `VITE_SUPABASE_URL="${data.supabase.supabaseUrlValue || 'https://xxxxx.supabase.co'}"\n` +
                  `VITE_SUPABASE_ANON_KEY="sua_chave_anon_aqui"\n` +
                  `SUPABASE_SERVICE_ROLE_KEY="sua_chave_service_role_aqui"\n` +
                  `DATABASE_URL="postgresql://postgres:sua_senha@db.xxxxx.supabase.co:5432/postgres"\n` +
                  `VITE_FIREBASE_FIRESTORE_DATABASE_ID="${data.firebase.databaseId || 'ai-studio-...'}"\n` +
                  `GEMINI_API_KEY="sua_chave_gemini"\n` +
                  `GITHUB_PAT="ghp_seu_token_pat_aqui"\n` +
                  `GITHUB_USERNAME="${githubUser || 'seu_usuario'}"\n` +
                  `GITHUB_REPO="${githubRepo || 'VINIMAP-ACF'}"`,
                  'env'
                )}
                className="px-2.5 py-1 text-slate-600 hover:text-slate-800 border border-slate-200 rounded-lg text-[10.5px] font-semibold transition-all cursor-pointer inline-flex items-center gap-1 bg-slate-50 hover:bg-slate-100"
              >
                {copiedKey === 'env' ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copiedKey === 'env' ? 'Copiado!' : 'Copiar'}</span>
              </button>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
              Copie o bloco abaixo para criar o seu arquivo local <code className="font-mono bg-slate-100 text-[10px] px-1 rounded text-slate-700">.env</code> na raiz do projeto ou registre esses nomes no menu de Secrets:
            </p>

            <pre className="p-3 bg-slate-900 border border-slate-950 rounded-xl font-mono text-[10px] text-slate-200 overflow-x-auto leading-relaxed shadow-inner">
{`VITE_SUPABASE_URL="${data.supabase.supabaseUrlValue || 'https://xxxxx.supabase.co'}"
VITE_SUPABASE_ANON_KEY="sua_chave_anon_aqui"
SUPABASE_SERVICE_ROLE_KEY="sua_chave_service_role"
DATABASE_URL="postgresql://postgres:senha@db.xxx.co:5432/postgres"
VITE_FIREBASE_FIRESTORE_DATABASE_ID="${data.firebase.databaseId || 'ai-studio-...'}"
GEMINI_API_KEY="sua_chave_gemini_aqui"
GITHUB_PAT="ghp_seu_token_pat_aqui"
GITHUB_USERNAME="${githubUser || 'seu_usuario'}"
GITHUB_REPO="${githubRepo || 'VINIMAP-ACF'}"`}
            </pre>
          </div>

          {/* Guide on how to configure */}
          <div className="bg-white border border-slate-150 rounded-2xl p-5 shadow-xs space-y-4 font-sans">
            <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1">
              <HelpCircle className="h-4 w-4 text-indigo-600" />
              Onde localizar cada credencial?
            </h4>

            <ul className="space-y-3.5 text-[11px] text-slate-600">
              <li className="space-y-1">
                <span className="font-bold text-slate-800 block">1. Supabase URL & Keys:</span>
                <p className="leading-normal">
                  Acesse o painel do seu projeto no <strong className="text-slate-800">Supabase</strong> &gt; <strong className="text-slate-800">Project Settings</strong> &gt; <strong className="text-slate-800">API</strong>.
                  Copie o valor de <code className="bg-slate-100 font-mono text-[9px] px-1 rounded text-slate-700">Project URL</code>, <code className="bg-slate-100 font-mono text-[9px] px-1 rounded text-slate-700">anon (public)</code> e <code className="bg-slate-100 font-mono text-[9px] px-1 rounded text-slate-700">service_role (secret)</code>.
                </p>
              </li>

              <li className="space-y-1">
                <span className="font-bold text-slate-800 block">2. Connection String (DATABASE_URL):</span>
                <p className="leading-normal">
                  No Supabase &gt; <strong className="text-slate-800">Settings</strong> &gt; <strong className="text-slate-800">Database</strong> &gt; <strong className="text-slate-800">Connection string</strong>.
                  Selecione <strong className="text-slate-800">URI</strong> ou <strong className="text-slate-800">Nodejs</strong> e substitua <code className="font-mono text-[9px] bg-slate-100 px-1 rounded text-slate-700">[YOUR-PASSWORD]</code> pela senha definida ao criar o projeto.
                </p>
              </li>

              <li className="space-y-1">
                <span className="font-bold text-slate-800 block">3. Gemini API Key:</span>
                <p className="leading-normal">
                  Acesse a plataforma <strong className="text-slate-800">Google AI Studio</strong> para gerar sua API Key gratuita para desenvolvimento. Registre-a como <code className="bg-slate-100 font-mono text-[9px] px-1 rounded text-slate-700">GEMINI_API_KEY</code>.
                </p>
              </li>

              <li className="space-y-1">
                <span className="font-bold text-slate-800 block">4. Token de Acesso Pessoal (GITHUB_PAT):</span>
                <p className="leading-normal">
                  Acesse <strong className="text-slate-800">GitHub Settings</strong> &gt; <strong className="text-slate-800">Developer Settings</strong> &gt; <strong className="text-slate-800">Personal Access Tokens</strong> &gt; <strong className="text-slate-800">Tokens (classic)</strong>. Clique em gerar novo token clássico e selecione o escopo <code className="bg-slate-100 font-mono text-[9px] px-1 rounded text-slate-700">repo</code>.
                </p>
              </li>
            </ul>

            <div className="pt-2 border-t border-slate-100">
              <a
                href="https://supabase.com"
                target="_blank"
                rel="noreferrer"
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1 hover:underline cursor-pointer"
              >
                <span>Ir para Console do Supabase</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>

          {/* Danger Zone: Reset configurations */}
          <div className="bg-rose-50 border border-rose-150 rounded-2xl p-5 shadow-xs space-y-4 font-sans">
            <h4 className="font-bold text-rose-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
              <ShieldAlert className="h-4 w-4 text-rose-600" />
              Zona de Perigo: Redefinir Conexões
            </h4>
            <p className="text-[11px] text-rose-600 leading-relaxed">
              Exclua todas as chaves e caminhos configurados que apontem para o Supabase ou fiquem salvos como cache. Isso colocará o sistema em um estado limpo de fallback local para que você possa iniciar uma nova integração sem conflitos de senhas.
            </p>
            <button
              onClick={handleResetSupabaseConfig}
              disabled={resetting}
              className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 text-white font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${resetting ? 'animate-spin' : ''}`} />
              <span>{resetting ? 'Limpando Variáveis...' : 'Excluir Configurações do Supabase'}</span>
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}
