// Intelligent storage and retrieval for delivery proof photos
// Prevents loss from localStorage 5MB quota and synchronizes base64 images

export const photoMemoryCache = new Map<string, string>();

const DB_NAME = 'vinimap_photo_db';
const STORE_NAME = 'delivery_photos';

function openDB(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch (_) {
      resolve(null);
    }
  });
}

// Generate all possible alias keys for an order to guarantee match
export function getAllOrderKeys(orderOrId: any): string[] {
  const keys = new Set<string>();
  if (!orderOrId) return [];

  if (typeof orderOrId === 'string' || typeof orderOrId === 'number') {
    const s = String(orderOrId).trim();
    if (s) {
      keys.add(s);
      keys.add(s.toLowerCase());
      keys.add(s.toUpperCase());
      const noPed = s.replace(/^PED-?/i, '');
      if (noPed) {
        keys.add(noPed);
        keys.add(`PED-${noPed}`);
        const digits = noPed.replace(/\D/g, '');
        if (digits) {
          keys.add(digits);
          keys.add(`PED-${digits}`);
          keys.add(`PED-${digits.padStart(5, '0')}`);
        }
      }
    }
  } else if (typeof orderOrId === 'object') {
    const candidates = [
      orderOrId.id,
      orderOrId.pedido,
      orderOrId.numeroPedido,
      orderOrId.orderId,
      orderOrId.codigoPedido,
      orderOrId.chamado
    ];
    for (const c of candidates) {
      if (c) {
        for (const k of getAllOrderKeys(c)) {
          keys.add(k);
        }
      }
    }
  }
  return Array.from(keys);
}

// Normalize image string to valid URL or data URI
export function normalizeImageData(raw?: any): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const s = raw.trim();
  if (!s || s === '[saved]' || s === 'null' || s === 'undefined') return null;

  if (s.startsWith('data:') || s.startsWith('http://') || s.startsWith('https://') || s.startsWith('blob:')) {
    return s;
  }
  // Convert raw base64 string to data URI
  if (s.startsWith('/9j/') || s.startsWith('iVBORw0KGgo') || s.startsWith('R0lGOD') || s.startsWith('UklGR')) {
    return `data:image/jpeg;base64,${s}`;
  }
  if (s.length > 100 && /^[A-Za-z0-9+/=]+$/.test(s.slice(0, 100))) {
    return `data:image/jpeg;base64,${s}`;
  }
  return null;
}

// Initialize photo storage and preload all cached photos into memory
let isInitialized = false;
export async function initPhotoStorage(): Promise<void> {
  if (isInitialized || typeof window === 'undefined') return;
  isInitialized = true;
  try {
    const db = await openDB();
    if (db) {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.openCursor();
      req.onsuccess = (e: any) => {
        const cursor = e.target.result;
        if (cursor) {
          if (cursor.key && cursor.value) {
            const normalized = normalizeImageData(cursor.value);
            if (normalized) {
              const aliases = getAllOrderKeys(String(cursor.key));
              for (const a of aliases) {
                photoMemoryCache.set(a, normalized);
              }
            }
          }
          cursor.continue();
        }
      };
    }
  } catch (err) {
    console.warn('[PhotoStorage] Erro ao inicializar cache do IndexedDB:', err);
  }
}

// Automatically trigger background preloading
if (typeof window !== 'undefined') {
  setTimeout(() => {
    initPhotoStorage().catch(() => {});
  }, 100);
}

export async function saveOrderPhoto(orderId: string, photoData: string): Promise<void> {
  if (!orderId || !photoData || photoData === '[saved]') return;
  const normalized = normalizeImageData(photoData);
  if (!normalized) return;

  const aliases = getAllOrderKeys(orderId);
  for (const a of aliases) {
    photoMemoryCache.set(a, normalized);
  }

  try {
    const db = await openDB();
    if (db) {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(normalized, orderId);
      // Also index under main alias
      const cleanPed = String(orderId).replace(/^PED-?/i, '');
      if (cleanPed && cleanPed !== orderId) {
        store.put(normalized, cleanPed);
      }
    }
  } catch (err) {
    console.warn('[PhotoStorage] Falha ao salvar foto no IndexedDB:', err);
  }
}

export async function getOrderPhoto(orderId: string): Promise<string | null> {
  if (!orderId) return null;
  const aliases = getAllOrderKeys(orderId);

  // 1. Check in-memory cache first
  for (const a of aliases) {
    const cached = photoMemoryCache.get(a);
    if (cached) return cached;
  }

  // 2. Check IndexedDB
  try {
    const db = await openDB();
    if (db) {
      for (const a of aliases) {
        const result = await new Promise<string | null>((resolve) => {
          try {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const req = tx.objectStore(STORE_NAME).get(a);
            req.onsuccess = () => {
              const val = normalizeImageData(req.result);
              resolve(val || null);
            };
            req.onerror = () => resolve(null);
          } catch (_) {
            resolve(null);
          }
        });

        if (result) {
          for (const key of aliases) {
            photoMemoryCache.set(key, result);
          }
          return result;
        }
      }
    }
  } catch (_) {}

  return null;
}

export function resolveOrderPhoto(order?: any): string | null {
  if (!order) return null;

  // Direct properties checks in order of priority (prioritizing proofPhotoUrl)
  const candidates = [
    order.proofPhotoUrl,
    order.deliveryProtocol?.photoUrl,
    order.deliveryProtocol?.photo,
    order.deliveryProtocol?.fotoUrl,
    order.deliveryProtocol?.foto,
    order.deliveryProtocol?.comprovanteUrl,
    order.deliveryProtocol?.fotoComprovante,
    order.deliveryProtocol?.image,
    order.deliveryProtocol?.imagem,
    order.photoUrl,
    order.comprovanteUrl,
    order.fotoUrl,
    order.foto,
    order.photo,
    order.comprovante,
    order.fotoComprovante
  ];

  for (const c of candidates) {
    const norm = normalizeImageData(c);
    if (norm) {
      const keys = getAllOrderKeys(order);
      for (const k of keys) {
        photoMemoryCache.set(k, norm);
      }
      return norm;
    }
  }

  // Check history events
  if (Array.isArray(order.history)) {
    for (let i = order.history.length - 1; i >= 0; i--) {
      const h = order.history[i];
      if (!h) continue;
      const hCandidate = h.photoUrl || h.fotoUrl || h.proofPhotoUrl || h.photo || h.foto || h.comprovanteUrl;
      const norm = normalizeImageData(hCandidate);
      if (norm) {
        const keys = getAllOrderKeys(order);
        for (const k of keys) {
          photoMemoryCache.set(k, norm);
        }
        return norm;
      }
    }
  }

  // Check memory cache with all aliases
  const keys = getAllOrderKeys(order);
  for (const k of keys) {
    const cached = photoMemoryCache.get(k);
    if (cached) return cached;
  }

  return null;
}

export function resolveOrderSignature(order?: any): string | null {
  if (!order) return null;

  const candidates = [
    order.deliveryProtocol?.signatureData,
    order.deliveryProtocol?.signature,
    order.deliveryProtocol?.assinatura,
    order.deliveryProtocol?.assinaturaUrl,
    order.signatureDataUrl,
    order.signatureData,
    order.signature,
    order.assinaturaUrl,
    order.assinatura
  ];

  for (const c of candidates) {
    const norm = normalizeImageData(c);
    if (norm) return norm;
  }

  // Check history
  if (Array.isArray(order.history)) {
    for (let i = order.history.length - 1; i >= 0; i--) {
      const h = order.history[i];
      if (!h) continue;
      const hSig = h.signatureData || h.signature || h.assinatura;
      const norm = normalizeImageData(hSig);
      if (norm) return norm;
    }
  }

  return null;
}

export function resolveReceiverName(order?: any): string {
  if (!order) return 'Recebedor não identificado';
  return (
    order.deliveryProtocol?.signedName?.trim() ||
    order.receiverName?.trim() ||
    order.procurarPor?.trim() ||
    order.customerName?.trim() ||
    order.destinatario?.trim() ||
    'Recebedor não identificado'
  );
}

export function resolveReceiverDoc(order?: any): string {
  if (!order) return 'Não informado';
  return (
    order.deliveryProtocol?.signedDoc?.trim() ||
    order.receiverDoc?.trim() ||
    order.destinatarioCnpjCpf?.trim() ||
    order.documento?.trim() ||
    'Não informado'
  );
}

export function resolveDeliveryTime(order?: any): string {
  if (!order) return 'Horário não registrado';

  const formatDateTime = (val: string): string | null => {
    if (!val) return null;
    const trimmed = val.trim();
    if (!trimmed) return null;
    // Already in formatted date + time (e.g. DD/MM/AAAA HH:MM:SS or DD/MM/AAAA HH:MM)
    if (/^\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}/.test(trimmed)) {
      return trimmed;
    }
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) {
      const datePart = d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
      const timePart = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'America/Sao_Paulo' });
      return `${datePart} ${timePart}`;
    }
    return trimmed;
  };

  // 1. Check deliveredAt
  if (order.deliveredAt) {
    const formatted = formatDateTime(order.deliveredAt);
    if (formatted) return formatted;
  }

  // 2. Check deliveryProtocol.signedAt
  if (order.deliveryProtocol?.signedAt) {
    const formatted = formatDateTime(order.deliveryProtocol.signedAt);
    if (formatted) return formatted;
  }

  // 3. Check deliveryProtocol.updatedAt
  if (order.deliveryProtocol?.updatedAt) {
    const formatted = formatDateTime(order.deliveryProtocol.updatedAt);
    if (formatted) return formatted;
  }

  // 4. Check status transition in history
  if (Array.isArray(order.history)) {
    const deliveredHist = [...order.history].reverse().find(h => h && h.status === 'delivered');
    if (deliveredHist?.time) {
      return deliveredHist.time;
    }
  }

  // 5. Check statusUpdatedAt if status is delivered
  if (order.statusUpdatedAt && order.status === 'delivered') {
    const d = new Date(order.statusUpdatedAt);
    if (!isNaN(d.getTime())) {
      const datePart = d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
      const timePart = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
      return `${datePart} ${timePart}`;
    }
  }

  // 6. Fallback with dataSolicitacao and time
  if (order.dataSolicitacao && order.time) {
    return `${order.dataSolicitacao} ${order.time}`;
  }

  return order.time?.trim() || 'Horário não registrado';
}
