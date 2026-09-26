import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, Auth, User } from 'firebase/auth';
import { 
  getFirestore, 
  initializeFirestore,
  Firestore, 
  collection, 
  getDocs, 
  doc,
  getDocFromServer,
  limit, 
  query,
  terminate,
  setDoc as rawSetDoc,
  deleteDoc as rawDeleteDoc,
  updateDoc as rawUpdateDoc
} from 'firebase/firestore';
import firebaseConfigJson from '../../firebase-applet-config.json';

const env = (import.meta as any).env || {};

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || firebaseConfigJson.apiKey || "",
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfigJson.authDomain || "",
  projectId: env.VITE_FIREBASE_PROJECT_ID || firebaseConfigJson.projectId || "",
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfigJson.storageBucket || "",
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfigJson.messagingSenderId || "",
  appId: env.VITE_FIREBASE_APP_ID || firebaseConfigJson.appId || ""
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId
);

const QUOTA_STORAGE_KEY = 'vinimap_firestore_quota_exhausted_timestamp';

// Check if quota cooldown is active (persist for up to 12 hours or until next day)
const initQuotaState = (): boolean => {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(QUOTA_STORAGE_KEY) : null;
    if (raw) {
      const ts = Number(raw);
      if (Date.now() - ts < 12 * 60 * 60 * 1000) {
        return true;
      } else {
        localStorage.removeItem(QUOTA_STORAGE_KEY);
      }
    }
  } catch (_) {}
  return false;
};

let firestoreQuotaExceeded = initQuotaState();
const quotaListeners: Array<(exceeded: boolean) => void> = [];

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

if (isFirebaseConfigured) {
  try {
    app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    auth = getAuth(app);
    if (!firestoreQuotaExceeded) {
      const databaseId = env.VITE_FIREBASE_DATABASE_ID || (firebaseConfigJson as any).firestoreDatabaseId || "";
      try {
        db = databaseId
          ? initializeFirestore(app, { experimentalAutoDetectLongPolling: true }, databaseId)
          : initializeFirestore(app, { experimentalAutoDetectLongPolling: true });
      } catch (_) {
        db = databaseId ? getFirestore(app, databaseId) : getFirestore(app);
      }

      // Validar conexão com Cloud Firestore backend conforme requisitos do Skill
      if (db) {
        (async () => {
          try {
            await getDocFromServer(doc(db, 'test', 'connection'));
            console.log("[Firestore] Conexão com o backend do Cloud Firestore confirmada com sucesso.");
          } catch (error: any) {
            const errStr = error instanceof Error ? error.message : String(error);
            if (errStr.includes('the client is offline') || error?.code === 'unavailable') {
              console.warn("[Firestore] Operando em modo offline/cache até restabelecimento automático da conexão.");
            }
          }
        })();
      }
    }
  } catch (err) {
    console.warn("Failed to initialize Firebase:", err);
  }
}

export let isLiveFirebase = Boolean(db && !firestoreQuotaExceeded);

export { auth, db };

export const OperationType = {
  GET: 'read',
  READ: 'read',
  WRITE: 'write',
  DELETE: 'delete',
  UPDATE: 'update'
} as const;

export type OperationType = typeof OperationType[keyof typeof OperationType] | string;

export function isFirestoreQuotaExceeded(): boolean {
  return firestoreQuotaExceeded;
}

export function markFirestoreQuotaExceeded(reason?: string): void {
  if (!firestoreQuotaExceeded) {
    firestoreQuotaExceeded = true;
    isLiveFirebase = false;
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(QUOTA_STORAGE_KEY, String(Date.now()));
      }
    } catch (_) {}
    console.warn(`[Firestore Circuit Breaker] Cota gratuita diária do Firestore atingida (${reason || 'RESOURCE_EXHAUSTED'}). Operações no Firestore suspensas temporariamente para preservar a estabilidade. O sistema opera com 100% de integridade com o Supabase.`);
    if (db) {
      const currentDb = db;
      db = null;
      terminate(currentDb).catch(() => {});
    }
    quotaListeners.forEach(cb => {
      try { cb(true); } catch (_) {}
    });
  }
}

export function onFirestoreQuotaExceeded(callback: (exceeded: boolean) => void): () => void {
  quotaListeners.push(callback);
  if (firestoreQuotaExceeded) {
    try { callback(true); } catch (_) {}
  }
  return () => {
    const idx = quotaListeners.indexOf(callback);
    if (idx !== -1) quotaListeners.splice(idx, 1);
  };
}

export function handleFirestoreError(error: any, operation: any = 'read', collectionName?: string): string {
  const errMsg = String(error?.message || error || '');
  const errCode = String(error?.code || '');

  // Detect Resource Exhausted / Free Quota limit / Write stream queue overflow
  if (
    errCode === 'resource-exhausted' || 
    errCode === '8' ||
    error?.code === 8 ||
    errMsg.includes('RESOURCE_EXHAUSTED') || 
    errMsg.includes('Quota limit exceeded') ||
    errMsg.includes('Quota exceeded') ||
    errMsg.includes('Free daily write units') ||
    errMsg.includes('Free daily read units') ||
    errMsg.includes('Write stream exhausted maximum allowed queued writes') ||
    errMsg.includes('exhausted maximum allowed queued writes')
  ) {
    markFirestoreQuotaExceeded(errMsg);
    return 'Cota diária gratuita do Firestore atingida. A aplicação está operando com o Supabase (Banco Primário).';
  }

  if (error?.code === 'unavailable' || errMsg.includes('unavailable') || errMsg.includes('the client is offline')) {
    console.warn(`[Firestore Offline/Reconnecting during ${operation}${collectionName ? ` on ${collectionName}` : ''}]: Operando em modo offline temporário enquanto reconecta ao Cloud Firestore.`);
    return 'Serviço do Firestore temporariamente operando em modo offline.';
  }

  console.error(`[Firestore Error during ${operation}${collectionName ? ` on ${collectionName}` : ''}]:`, error);
  if (error?.code === 'permission-denied') {
    return 'Permissão negada no Firestore. Verifique suas regras de segurança no Firebase Console.';
  }
  return error?.message || 'Erro ao conectar ao Firestore.';
}

export async function safeFirestoreSetDoc(docRef: any, data: any, options?: any): Promise<boolean> {
  if (!db || isFirestoreQuotaExceeded()) return false;
  try {
    await rawSetDoc(docRef, data, options);
    return true;
  } catch (err: any) {
    handleFirestoreError(err, 'write', docRef?.path);
    return false;
  }
}

export async function safeFirestoreDeleteDoc(docRef: any): Promise<boolean> {
  if (!db || isFirestoreQuotaExceeded()) return false;
  try {
    await rawDeleteDoc(docRef);
    return true;
  } catch (err: any) {
    handleFirestoreError(err, 'delete', docRef?.path);
    return false;
  }
}

export async function safeFirestoreUpdateDoc(docRef: any, data: any): Promise<boolean> {
  if (!db || isFirestoreQuotaExceeded()) return false;
  try {
    await rawUpdateDoc(docRef, data);
    return true;
  } catch (err: any) {
    handleFirestoreError(err, 'update', docRef?.path);
    return false;
  }
}

export async function testFirestoreConnection(): Promise<{ success: boolean; latencyMs?: number; message: string }> {
  if (!db) {
    return {
      success: false,
      message: 'Firestore não inicializado. Chaves VITE_FIREBASE_API_KEY / VITE_FIREBASE_PROJECT_ID ausentes no ambiente.'
    };
  }

  if (isFirestoreQuotaExceeded()) {
    return {
      success: false,
      message: 'Cota diária gratuita do Firestore atingida (RESOURCE_EXHAUSTED). Operações pausadas; o sistema está ativo via Supabase.'
    };
  }

  const start = Date.now();
  try {
    const testCol = collection(db, 'orders');
    const q = query(testCol, limit(1));
    await getDocs(q);
    const latencyMs = Date.now() - start;
    return {
      success: true,
      latencyMs,
      message: `Conexão com Firestore testada e confirmada! (${latencyMs}ms de resposta)`
    };
  } catch (error: any) {
    const formattedError = handleFirestoreError(error, 'test', 'orders');
    return {
      success: false,
      message: formattedError
    };
  }
}

export async function loginWithGoogle(): Promise<User | null> {
  if (!auth) {
    throw new Error("Firebase Auth is not initialized. Please configure Firebase API keys.");
  }
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  return result.user;
}

export async function logoutUser(): Promise<void> {
  if (auth) {
    await signOut(auth);
  }
}

export function observeAuthState(callback: (user: User | null) => void): () => void {
  if (!auth) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
}
