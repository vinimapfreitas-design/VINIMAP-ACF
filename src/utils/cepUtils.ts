/**
 * Utilitário Completo de Higienização, Recuperação do Zero à Esquerda e Validação de CEP
 * Padrão Brasileiro Oficial (00000-000) e Enriquecimento ViaCEP
 */

export interface ViaCepResult {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  ibge?: string;
  gia?: string;
  ddd?: string;
  siafi?: string;
  erro?: boolean;
  regiaoSugerida?: string;
}

export interface AddressIndexResult {
  cep: string;
  cleanCep: string;
  logradouro: string;
  bairro: string;
  localidade: string;
  cidade?: string;
  uf: string;
  estado?: string;
  complemento?: string;
  fullAddress: string;
  region: string;
  regiaoSugerida?: string;
  latitude?: number | null;
  longitude?: number | null;
  source?: string;
  erro?: boolean;
}

/**
 * Higieniza e recupera o zero à esquerda de CEPs de planilhas (Excel float/numérico/pontuações).
 * Ex: 1310100 vira 01310-100; 1310100.0 vira 01310-100; "01.310-100" vira 01310-100.
 */
export function formatCep(raw: string | number | undefined | null): string {
  if (raw === undefined || raw === null) return '';
  const str = String(raw).trim();
  if (!str) return '';

  // Tratar decimais do Excel (ex.: 1310100.0 -> 1310100)
  const integerPart = str.split('.')[0];
  const clean = integerPart.replace(/\D/g, '');

  if (!clean) return '';

  // Recuperar o zero inicial se tiver 7 dígitos (comum em SP 01000 a 09999)
  const padded = clean.length === 7 ? clean.padStart(8, '0') : clean;

  if (padded.length === 8) {
    return `${padded.substring(0, 5)}-${padded.substring(5, 8)}`;
  }

  // Se já tiver mais ou menos dígitos, retornar sanitizado se possível ou original
  return str;
}

/**
 * Retorna apenas os dígitos numéricos higienizados (8 dígitos com zero à esquerda se necessário)
 */
export function cleanCepDigits(raw: string | number | undefined | null): string {
  if (raw === undefined || raw === null) return '';
  const str = String(raw).trim();
  if (!str) return '';

  const integerPart = str.split('.')[0];
  const clean = integerPart.replace(/\D/g, '');

  if (clean.length === 7) {
    return clean.padStart(8, '0');
  }

  return clean;
}

/**
 * Exibição visual garantida de CEP formatado.
 * Retorna traço '-' se vazio ou inválido.
 */
export function formatCepDisplay(raw: string | number | undefined | null): string {
  const formatted = formatCep(raw);
  return formatted || '-';
}

/**
 * Extração inteligente de CEP de dentro do texto do endereço (Fallback).
 * Ex: "Av. Paulista, 1000 - Apto 42 - CEP 01310-100 - Bela Vista"
 * Extrai o CEP 01310-100 e limpa o texto do logradouro.
 */
export function extractCepFromAddress(addressText: string | undefined | null): {
  cep: string;
  formattedCep: string;
  cleanedAddress: string;
} | null {
  if (!addressText || typeof addressText !== 'string') return null;

  // Busca padrão com "CEP" opcional antes
  const fullMatch = addressText.match(/(?:cep\s*[:.-]?\s*)?(\b\d{5}[-\s]?\d{3}\b|\b\d{7,8}\b)/i);
  if (!fullMatch) return null;

  const rawMatch = fullMatch[1];
  const digits = cleanCepDigits(rawMatch);

  if (digits.length !== 8) return null;

  const formatted = `${digits.substring(0, 5)}-${digits.substring(5, 8)}`;

  // Limpar a ocorrência de CEP do texto do endereço para romaneios e etiquetas
  let cleaned = addressText.replace(fullMatch[0], '');
  // Limpar traços ou vírgulas órfãs deixadas pela remoção
  cleaned = cleaned.replace(/\s*-\s*-\s*/g, ' - ')
                   .replace(/,\s*,/g, ', ')
                   .replace(/\s*-\s*,/g, ', ')
                   .replace(/,\s*-\s*/g, ' - ')
                   .trim()
                   .replace(/^[-,.\s]+|[-,.\s]+$/g, '');

  return {
    cep: digits,
    formattedCep: formatted,
    cleanedAddress: cleaned
  };
}

/**
 * Compara dois CEPs numericamente para ordenação uniforme de rotas
 */
export function compareOrdersByCep(cepA: string | undefined | null, cepB: string | undefined | null): number {
  const numA = parseInt(cleanCepDigits(cepA), 10) || 0;
  const numB = parseInt(cleanCepDigits(cepB), 10) || 0;
  return numA - numB;
}

/**
 * Determina a região operacional da Grande São Paulo / Capital pelo prefixo do CEP
 */
export function detectRegionByCepPrefix(cep: string): string {
  const digits = cleanCepDigits(cep);
  if (digits.length !== 8) return '';

  const prefix = parseInt(digits.substring(0, 5), 10);

  // Faixas oficiais de CEP da Capital de SP: 01000-000 a 05999-999 e 08000-000 a 08499-999
  if (prefix >= 1000 && prefix <= 1599) return 'Centro';
  if (prefix >= 2000 && prefix <= 2999) return 'Zona Norte';
  if (prefix >= 3000 && prefix <= 3999) return 'Zona Leste';
  if (prefix >= 8000 && prefix <= 8499) return 'Zona Leste';
  if (prefix >= 4000 && prefix <= 4999) return 'Zona Sul';
  if (prefix >= 5000 && prefix <= 5999) return 'Zona Oeste';
  
  // Grande SP (06000 a 07999 e 08500 a 09999)
  if (prefix >= 6000 && prefix <= 6999) return 'Grande SP (Oeste)';
  if (prefix >= 7000 && prefix <= 7999) return 'Grande SP (Norte)';
  if (prefix >= 8500 && prefix <= 8999) return 'Grande SP (Leste)';
  if (prefix >= 9000 && prefix <= 9999) return 'Grande SP (ABC)';

  // Interior de SP: 11000 a 19999
  if (prefix >= 11000 && prefix <= 19999) return 'Interior / Litoral SP';

  return 'Outros';
}

export function detectStandardRegion(cep?: string, bairro?: string): string {
  const digits = cleanCepDigits(cep);
  if (digits.length === 8) {
    const p = parseInt(digits.substring(0, 5), 10);
    if (p >= 1000 && p <= 1599) return 'Centro-Paulista';
    if (p >= 4000 && p <= 4999) return 'Zona Sul';
    if (p >= 5000 && p <= 5999) return 'Zona Oeste';
    if (p >= 2000 && p <= 2999) return 'Zona Norte';
    if ((p >= 3000 && p <= 3999) || (p >= 8000 && p <= 8499)) return 'Zona Leste';
    if (p >= 6000 && p <= 6999) return 'Grande SP (Oeste)';
    if (p >= 7000 && p <= 7999) return 'Grande SP (Norte)';
    if (p >= 8500 && p <= 8999) return 'Grande SP (Leste)';
    if (p >= 9000 && p <= 9999) return 'Grande SP (ABC)';
    if (p >= 11000 && p <= 19999) return 'Interior / Litoral SP';
  }
  const b = String(bairro || '').toLowerCase();
  if (
    b.includes('pinheiros') || b.includes('itaim') || b.includes('paulista') || 
    b.includes('bela vista') || b.includes('consolacao') || b.includes('centro') || 
    b.includes('se') || b.includes('liberdade') || b.includes('paraiso') || 
    b.includes('vila mariana') || b.includes('republica') || b.includes('santa cecilia') || 
    b.includes('perdizes') || b.includes('bom retiro') || b.includes('bras')
  ) {
    return 'Centro-Paulista';
  }
  if (
    b.includes('santo amaro') || b.includes('saude') || b.includes('ipiranga') || 
    b.includes('jabaquara') || b.includes('morumbi') || b.includes('brooklin') || 
    b.includes('campo belo') || b.includes('moema') || b.includes('interlagos') || 
    b.includes('socorro') || b.includes('capao redondo') || b.includes('vila olimpia')
  ) {
    return 'Zona Sul';
  }
  if (
    b.includes('lapa') || b.includes('butanta') || b.includes('barra funda') || 
    b.includes('jaguare') || b.includes('freguesia') || b.includes('perus') || 
    b.includes('vila leopoldina') || b.includes('pirituba')
  ) {
    return 'Zona Oeste';
  }
  if (
    b.includes('santana') || b.includes('tucuruvi') || b.includes('casa verde') || 
    b.includes('vila guilherme') || b.includes('limao') || b.includes('tremembe') || 
    b.includes('mandaqui') || b.includes('vila maria') || b.includes('jacana') || b.includes('jaçana')
  ) {
    return 'Zona Norte';
  }
  if (
    b.includes('tatuape') || b.includes('mooca') || b.includes('penha') || 
    b.includes('itaim paulista') || b.includes('sao mateus') || b.includes('itaquera') || 
    b.includes('vila prudente') || b.includes('sapopemba') || b.includes('guaianases') || 
    b.includes('artur alvim') || b.includes('aricanduva') || b.includes('belem')
  ) {
    return 'Zona Leste';
  }
  return 'Centro-Paulista';
}

// In-Memory and LocalStorage Cache
const clientCepCache = new Map<string, AddressIndexResult>();
const clientAddressCache = new Map<string, AddressIndexResult[]>();

function getLocalStoredCep(clean: string): AddressIndexResult | null {
  if (clientCepCache.has(clean)) return clientCepCache.get(clean)!;
  try {
    const raw = localStorage.getItem(`vinimap_cep_${clean}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      clientCepCache.set(clean, parsed);
      return parsed;
    }
  } catch (_) {}
  return null;
}

function setLocalStoredCep(clean: string, data: AddressIndexResult): void {
  clientCepCache.set(clean, data);
  try {
    localStorage.setItem(`vinimap_cep_${clean}`, JSON.stringify(data));
  } catch (_) {}
}

/**
 * Consulta de CEP com enriquecimento bidirecional completo, geocodificação e fallback múltiplo.
 * (Pode ser chamado ao digitar o CEP)
 */
export async function fetchAddressByCep(cep: string): Promise<AddressIndexResult | null> {
  const digits = cleanCepDigits(cep);
  if (digits.length !== 8) return null;

  // Check cache
  const cached = getLocalStoredCep(digits);
  if (cached) return cached;

  const formatted = `${digits.substring(0, 5)}-${digits.substring(5)}`;

  // 1. Try local backend proxy (/api/cep/:cep)
  try {
    const res = await fetch(`/api/cep/${digits}`);
    if (res.ok) {
      const data: AddressIndexResult = await res.json();
      if (data && !data.erro) {
        setLocalStoredCep(digits, data);
        return data;
      }
    }
  } catch (err) {
    console.debug('[CEP Service] Backend proxy offline ou inacessível, tentando fallback direto:', err);
  }

  // 2. Direct browser fallback via ViaCEP
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`, {
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const vData: any = await response.json();
      if (!vData.erro) {
        const fullAddr = `${vData.logradouro || ''}, ${vData.bairro || ''} - ${vData.localidade || 'São Paulo'}/${vData.uf || 'SP'}`.replace(/^[,\s-]+|[,\s-]+$/g, '');
        const region = detectStandardRegion(digits, vData.bairro);
        const result: AddressIndexResult = {
          cep: formatted,
          cleanCep: digits,
          logradouro: vData.logradouro || '',
          bairro: vData.bairro || '',
          localidade: vData.localidade || 'São Paulo',
          cidade: vData.localidade || 'São Paulo',
          uf: vData.uf || 'SP',
          estado: vData.estado || vData.uf || 'São Paulo',
          complemento: vData.complemento || '',
          fullAddress: fullAddr,
          region,
          regiaoSugerida: region,
          latitude: null,
          longitude: null,
          source: 'viacep'
        };

        // Geocoding Nominatim
        try {
          const q = encodeURIComponent(`${vData.logradouro || ''}, ${vData.localidade || 'São Paulo'}, Brasil`);
          const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${q}&limit=1`, {
            headers: { 'User-Agent': 'ViniMapLogistica-App/1.0' }
          });
          if (geoRes.ok) {
            const geoJson = await geoRes.json();
            if (Array.isArray(geoJson) && geoJson.length > 0) {
              result.latitude = parseFloat(geoJson[0].lat) || null;
              result.longitude = parseFloat(geoJson[0].lon) || null;
            }
          }
        } catch (_) {}

        setLocalStoredCep(digits, result);
        return result;
      }
    }
  } catch (err) {
    console.warn(`[ViaCEP] Falha na consulta direta de ${digits}:`, err);
  }

  // 3. Direct browser fallback via BrasilAPI
  try {
    const bRes = await fetch(`https://brasilapi.com.br/api/cep/v2/${digits}`);
    if (bRes.ok) {
      const bData: any = await bRes.json();
      const street = bData.street || '';
      const neighborhood = bData.neighborhood || '';
      const city = bData.city || 'São Paulo';
      const state = bData.state || 'SP';
      const fullAddr = `${street}, ${neighborhood} - ${city}/${state}`.replace(/^[,\s-]+|[,\s-]+$/g, '');
      const region = detectStandardRegion(digits, neighborhood);

      let lat = null;
      let lon = null;
      if (bData.location && bData.location.coordinates) {
        lat = parseFloat(bData.location.coordinates.latitude) || null;
        lon = parseFloat(bData.location.coordinates.longitude) || null;
      }

      const result: AddressIndexResult = {
        cep: formatted,
        cleanCep: digits,
        logradouro: street,
        bairro: neighborhood,
        localidade: city,
        cidade: city,
        uf: state,
        estado: state,
        complemento: '',
        fullAddress: fullAddr,
        region,
        regiaoSugerida: region,
        latitude: lat,
        longitude: lon,
        source: 'brasilapi'
      };

      setLocalStoredCep(digits, result);
      return result;
    }
  } catch (err) {
    console.warn(`[BrasilAPI] Falha na consulta direta de ${digits}:`, err);
  }

  return null;
}

/**
 * INDEXAÇÃO INVERSA: Busca CEP a partir do Endereço (Logradouro, Rua, Bairro, etc.)
 * Permite que ao preencher o endereço, o CEP e todos os dados sejam preenchidos automaticamente.
 */
export async function searchCepByAddress(
  addressText: string,
  options?: { city?: string; state?: string }
): Promise<AddressIndexResult[]> {
  const query = (addressText || '').trim();
  if (!query || query.length < 3) return [];

  const defaultCity = options?.city || 'São Paulo';
  const defaultState = options?.state || 'SP';
  const cacheKey = `${defaultState}_${defaultCity}_${query.toLowerCase()}`;

  if (clientAddressCache.has(cacheKey)) {
    return clientAddressCache.get(cacheKey)!;
  }

  // 1. Se o próprio texto contiver um CEP (ex: "Av Paulista 1000 - 01310-100"), extrai e indexa imediatamente
  const extracted = extractCepFromAddress(query);
  if (extracted) {
    const singleResult = await fetchAddressByCep(extracted.cep);
    if (singleResult) {
      clientAddressCache.set(cacheKey, [singleResult]);
      return [singleResult];
    }
  }

  // 2. Tenta a API do backend (/api/cep/search-address)
  try {
    const params = new URLSearchParams({
      q: query,
      cidade: defaultCity,
      uf: defaultState
    });
    const res = await fetch(`/api/cep/search-address?${params.toString()}`);
    if (res.ok) {
      const list: AddressIndexResult[] = await res.json();
      if (Array.isArray(list) && list.length > 0) {
        clientAddressCache.set(cacheKey, list);
        return list;
      }
    }
  } catch (err) {
    console.debug('[CEP Search] Falha no backend proxy de busca por endereço:', err);
  }

  // 3. Fallback direto no navegador: ViaCEP busca por logradouro
  // Remove número e complementos da busca
  const cleanLogradouro = query
    .replace(/\b(n[ºo]?|número|numero|apto|ap|bloco|cj|casa|sala)\s*\d+.*$/i, '')
    .replace(/,\s*\d+.*$/, '')
    .replace(/\b\d{1,5}\b/g, '')
    .replace(/[-,]/g, ' ')
    .trim();

  if (cleanLogradouro.length >= 3) {
    try {
      const url = `https://viacep.com.br/ws/${defaultState}/${encodeURIComponent(defaultCity)}/${encodeURIComponent(cleanLogradouro)}/json/`;
      const vRes = await fetch(url);
      if (vRes.ok) {
        const vList = await vRes.json();
        if (Array.isArray(vList) && vList.length > 0) {
          const mapped: AddressIndexResult[] = vList.slice(0, 8).map((item: any) => {
            const digits = cleanCepDigits(item.cep);
            const formatted = `${digits.substring(0, 5)}-${digits.substring(5)}`;
            const fullAddr = `${item.logradouro || ''}, ${item.bairro || ''} - ${item.localidade || defaultCity}/${item.uf || defaultState}`;
            const region = detectStandardRegion(digits, item.bairro);
            return {
              cep: formatted,
              cleanCep: digits,
              logradouro: item.logradouro || '',
              bairro: item.bairro || '',
              localidade: item.localidade || defaultCity,
              cidade: item.localidade || defaultCity,
              uf: item.uf || defaultState,
              estado: item.estado || defaultState,
              complemento: item.complemento || '',
              fullAddress: fullAddr,
              region,
              regiaoSugerida: region,
              latitude: null,
              longitude: null,
              source: 'viacep'
            };
          });

          clientAddressCache.set(cacheKey, mapped);
          return mapped;
        }
      }
    } catch (vErr) {
      console.warn('[ViaCEP] Falha na busca direta de logradouro:', vErr);
    }
  }

  // 4. Fallback direto via Nominatim OpenStreetMap
  try {
    const geoQ = encodeURIComponent(`${query}, Brasil`);
    const nRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${geoQ}&addressdetails=1&countrycodes=br&limit=5`, {
      headers: { 'User-Agent': 'ViniMapLogistica-App/1.0' }
    });
    if (nRes.ok) {
      const nList = await nRes.json();
      if (Array.isArray(nList)) {
        const results: AddressIndexResult[] = [];
        const seen = new Set<string>();

        for (const item of nList) {
          const addr = item.address || {};
          const postcode = cleanCepDigits(addr.postcode);
          if (postcode.length === 8 && !seen.has(postcode)) {
            seen.add(postcode);
            const formatted = `${postcode.substring(0, 5)}-${postcode.substring(5)}`;
            const road = addr.road || addr.pedestrian || query;
            const neighborhood = addr.suburb || addr.neighbourhood || addr.city_district || '';
            const city = addr.city || addr.town || defaultCity;
            const state = addr.state_code || addr.state || defaultState;
            const fullAddr = `${road}${neighborhood ? `, ${neighborhood}` : ''} - ${city}/${state}`;
            const region = detectStandardRegion(postcode, neighborhood);

            results.push({
              cep: formatted,
              cleanCep: postcode,
              logradouro: road,
              bairro: neighborhood,
              localidade: city,
              cidade: city,
              uf: String(state).substring(0, 2).toUpperCase(),
              estado: addr.state || state,
              complemento: '',
              fullAddress: fullAddr,
              region,
              regiaoSugerida: region,
              latitude: parseFloat(item.lat) || null,
              longitude: parseFloat(item.lon) || null,
              source: 'nominatim'
            });
          }
        }

        if (results.length > 0) {
          clientAddressCache.set(cacheKey, results);
          return results;
        }
      }
    }
  } catch (nErr) {
    console.warn('[Nominatim] Falha no fallback direto:', nErr);
  }

  return [];
}

