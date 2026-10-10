// Motor de Otimização e Roteirização Inteligente (VRP / TSP Engine)
// Inspirado em plataformas líderes (RouteXL, Circuit, Routific, OSRM)

export interface RouteStop {
  id: string;
  orderId?: string;
  title: string;
  recipientName: string;
  address: string;
  cep: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  phone?: string;
  notes?: string;
  lat: number;
  lng: number;
  sequence: number;
  originalIndex: number;
  serviceTimeMinutes: number;
  estimatedArrival?: string;
  estimatedDeparture?: string;
  distanceFromPreviousKm?: number;
  durationFromPreviousMin?: number;
  status?: 'pending' | 'completed' | 'skipped';
  isFixed?: boolean;
}

export interface RouteHubLocation {
  id?: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
}

export interface RouteOptimizationResult {
  stops: RouteStop[];
  totalDistanceKm: number;
  totalDurationMinutes: number;
  unoptimizedDistanceKm: number;
  savedDistanceKm: number;
  savedPercent: number;
  savedMinutes: number;
  geometryCoordinates: [number, number][]; // [lat, lng]
  usedEngine: 'osrm' | 'heuristic_2opt';
}

// Fallback hub coordinates (Cerro Corá / Lapa / SP)
export const DEFAULT_HUB_COORDS: RouteHubLocation = {
  name: 'HUB Central Principal',
  address: 'Rua Cerro Corá, 385 - Vila Romana, São Paulo - SP',
  lat: -23.530385,
  lng: -46.702677
};

// Conhecimento de coordenadas base por faixa de CEP (São Paulo e Grande SP / Capitais)
export const CEP_COORDINATE_ANCHORS: { [prefix: string]: { lat: number; lng: number; region: string } } = {
  '010': { lat: -23.5489, lng: -46.6388, region: 'Centro Histórico / Sé' },
  '011': { lat: -23.5284, lng: -46.6432, region: 'Bom Retiro / Barra Funda' },
  '012': { lat: -23.5385, lng: -46.6521, region: 'Santa Cecília / Higienópolis' },
  '013': { lat: -23.5615, lng: -46.6560, region: 'Bela Vista / Av. Paulista' },
  '014': { lat: -23.5682, lng: -46.6698, region: 'Jardins / Cerqueira César' },
  '015': { lat: -23.5645, lng: -46.6264, region: 'Liberdade / Cambuci' },
  '020': { lat: -23.5015, lng: -46.6251, region: 'Santana / Carandiru' },
  '021': { lat: -23.4975, lng: -46.5925, region: 'Vila Maria' },
  '022': { lat: -23.4752, lng: -46.5985, region: 'Tucuruvi / Jaçanã' },
  '023': { lat: -23.4615, lng: -46.6152, region: 'Tremembé' },
  '024': { lat: -23.4885, lng: -46.6450, region: 'Mandaqui' },
  '025': { lat: -23.5085, lng: -46.6685, region: 'Casa Verde / Limão' },
  '030': { lat: -23.5412, lng: -46.6115, region: 'Brás / Pari' },
  '031': { lat: -23.5585, lng: -46.5985, region: 'Mooca' },
  '032': { lat: -23.5825, lng: -46.5512, region: 'Vila Prudente' },
  '033': { lat: -23.5450, lng: -46.5650, region: 'Tatuapé / Anália Franco' },
  '034': { lat: -23.5415, lng: -46.5315, region: 'Vila Formosa / Carrão' },
  '035': { lat: -23.5350, lng: -46.5050, region: 'Vila Matilde / Penha' },
  '036': { lat: -23.5185, lng: -46.5250, region: 'Penha de França' },
  '038': { lat: -23.4950, lng: -46.4820, region: 'Ermelino Matarazzo' },
  '039': { lat: -23.5850, lng: -46.5020, region: 'São Mateus' },
  '040': { lat: -23.5950, lng: -46.6520, region: 'Vila Mariana / Moema' },
  '041': { lat: -23.6120, lng: -46.6350, region: 'Saúde / Jabaquara' },
  '042': { lat: -23.5980, lng: -46.6020, region: 'Ipiranga / Sacomã' },
  '043': { lat: -23.6450, lng: -46.6620, region: 'Jabaquara / Cupecê' },
  '044': { lat: -23.6750, lng: -46.6550, region: 'Cidade Ademar / Pedreira' },
  '045': { lat: -23.5985, lng: -46.6850, region: 'Itaim Bibi / Vila Olímpia' },
  '046': { lat: -23.6285, lng: -46.6850, region: 'Campo Belo / Brooklin' },
  '047': { lat: -23.6550, lng: -46.7050, region: 'Santo Amaro' },
  '048': { lat: -23.7250, lng: -46.7020, region: 'Grajaú / Parelheiros' },
  '050': { lat: -23.5250, lng: -46.6880, region: 'Lapa / Perdizes' },
  '051': { lat: -23.4980, lng: -46.7350, region: 'Pirituba / Jaraguá' },
  '052': { lat: -23.4450, lng: -46.7850, region: 'Perus / Anhanguera' },
  '053': { lat: -23.5350, lng: -46.7450, region: 'Vila Leopoldina / Jaguaré' },
  '054': { lat: -23.5550, lng: -46.6950, region: 'Pinheiros / Vila Madalena' },
  '055': { lat: -23.5780, lng: -46.7250, region: 'Butantã / USP' },
  '056': { lat: -23.6050, lng: -46.7220, region: 'Morumbi / Vila Sônia' },
  '057': { lat: -23.6350, lng: -46.7550, region: 'Campo Limpo' },
  '058': { lat: -23.6680, lng: -46.7750, region: 'Capão Redondo / M’Boi Mirim' },
  '060': { lat: -23.5320, lng: -46.7920, region: 'Osasco Centro' },
  '064': { lat: -23.5120, lng: -46.8750, region: 'Barueri / Alphaville' },
  '070': { lat: -23.4650, lng: -46.5350, region: 'Guarulhos' },
  '090': { lat: -23.6550, lng: -46.5320, region: 'Santo André' },
  '097': { lat: -23.6950, lng: -46.5520, region: 'São Bernardo do Campo' },
  '099': { lat: -23.6920, lng: -46.6220, region: 'Diadema' },
};

// Cache em memória para evitar chamadas de rede repetidas
const geocodeCache = new Map<string, { lat: number; lng: number }>();

/**
 * Calcula a distância em quilômetros em linha reta (Haversine Formula)
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Raio da Terra em KM
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Estima a distância real de rua com base na distância em linha reta (fator logístico urbano 1.35x)
 */
export function estimateStreetDistanceKm(haversineKm: number): number {
  return Math.round(haversineKm * 1.32 * 10) / 10;
}

/**
 * Estima o tempo de condução urbano em minutos para uma determinada distância em KM
 * (média de 22 km/h para centros urbanos como SP)
 */
export function estimateDrivingMinutes(distanceKm: number): number {
  const avgSpeedKmH = 24;
  const minutes = (distanceKm / avgSpeedKmH) * 60;
  return Math.max(3, Math.round(minutes));
}

/**
 * Geocodifica um CEP ou endereço para coordenadas [lat, lng]
 */
export async function geocodeStop(
  cep: string,
  address: string,
  hubFallback: RouteHubLocation = DEFAULT_HUB_COORDS
): Promise<{ lat: number; lng: number }> {
  const cleanCep = (cep || '').replace(/\D/g, '');
  const cacheKey = cleanCep || address.trim().toLowerCase();

  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey)!;
  }

  // 1. Verificar Âncora direta por prefixo de 3 dígitos de CEP
  if (cleanCep && cleanCep.length >= 3) {
    const prefix3 = cleanCep.substring(0, 3);
    const anchor = CEP_COORDINATE_ANCHORS[prefix3];
    if (anchor) {
      // Dispersão suave baseada nos últimos 3 dígitos do CEP para não sobrepor exatamente
      const suffix = cleanCep.length >= 8 ? parseInt(cleanCep.slice(-3), 10) || 0 : 0;
      const jitterLat = ((suffix % 50) - 25) * 0.0003;
      const jitterLng = (((suffix * 3) % 50) - 25) * 0.0003;
      const coords = {
        lat: Math.round((anchor.lat + jitterLat) * 100000) / 100000,
        lng: Math.round((anchor.lng + jitterLng) * 100000) / 100000
      };
      geocodeCache.set(cacheKey, coords);
      return coords;
    }
  }

  // 2. Consulta rápida ViaCEP caso tenhamos 8 dígitos
  if (cleanCep && cleanCep.length === 8) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (!data.erro && data.logradouro) {
          // Tentar Nominatim para endereço detalhado
          const queryStr = `${data.logradouro}, ${data.bairro || ''}, ${data.localidade || 'São Paulo'} - ${data.uf || 'SP'}, Brasil`;
          try {
            const nomCtrl = new AbortController();
            const nomTimeout = setTimeout(() => nomCtrl.abort(), 2500);
            const nomRes = await fetch(
              `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(queryStr)}&limit=1`,
              { signal: nomCtrl.signal, headers: { 'User-Agent': 'ViniMapFleetRouteOptimizer/1.0' } }
            );
            clearTimeout(nomTimeout);
            if (nomRes.ok) {
              const nomData = await nomRes.json();
              if (nomData && nomData[0]) {
                const lat = parseFloat(nomData[0].lat);
                const lng = parseFloat(nomData[0].lon);
                if (!isNaN(lat) && !isNaN(lng)) {
                  const coords = { lat, lng };
                  geocodeCache.set(cacheKey, coords);
                  return coords;
                }
              }
            }
          } catch (_) {}
        }
      }
    } catch (_) {}
  }

  // 3. Fallback inteligente com deslocamento radial a partir do Hub
  const pseudoSeed = (cleanCep ? parseInt(cleanCep.slice(-4), 10) : address.length * 17) || 42;
  const angle = (pseudoSeed % 360) * (Math.PI / 180);
  const radiusKm = 2 + (pseudoSeed % 8);
  const degLat = (radiusKm / 111) * Math.cos(angle);
  const degLng = (radiusKm / (111 * Math.cos((hubFallback.lat * Math.PI) / 180))) * Math.sin(angle);

  const fallbackCoords = {
    lat: Math.round((hubFallback.lat + degLat) * 100000) / 100000,
    lng: Math.round((hubFallback.lng + degLng) * 100000) / 100000
  };
  geocodeCache.set(cacheKey, fallbackCoords);
  return fallbackCoords;
}

/**
 * Algoritmo Local de Otimização Caixeiro Viajante (TSP) com Heurística 2-Opt
 * Garante resultado imediato e funciona 100% offline se a API OSRM oscilar.
 */
export function optimizeRoute2Opt(
  origin: RouteHubLocation,
  stops: RouteStop[],
  returnToHub: boolean = false
): RouteStop[] {
  if (stops.length <= 1) {
    return stops.map((s, idx) => ({ ...s, sequence: idx + 1 }));
  }

  // Separar paradas fixadas (como parada prioritária na posição 1)
  const fixedStops = stops.filter(s => s.isFixed);
  const mutableStops = stops.filter(s => !s.isFixed);

  // 1. Construção Gulosa (Nearest-Neighbor)
  const unvisited = [...mutableStops];
  const ordered: RouteStop[] = [...fixedStops];

  let currentLat = ordered.length > 0 ? ordered[ordered.length - 1].lat : origin.lat;
  let currentLng = ordered.length > 0 ? ordered[ordered.length - 1].lng : origin.lng;

  while (unvisited.length > 0) {
    let bestIdx = 0;
    let minDistance = Infinity;

    for (let i = 0; i < unvisited.length; i++) {
      const dist = calculateHaversineDistance(currentLat, currentLng, unvisited[i].lat, unvisited[i].lng);
      if (dist < minDistance) {
        minDistance = dist;
        bestIdx = i;
      }
    }

    const nextStop = unvisited.splice(bestIdx, 1)[0];
    ordered.push(nextStop);
    currentLat = nextStop.lat;
    currentLng = nextStop.lng;
  }

  // 2. Refinamento por 2-Opt Swaps
  const startIndex = fixedStops.length;
  let improved = true;
  let iterations = 0;
  const maxIterations = 50;

  const calculateTotalTourDistance = (tour: RouteStop[]): number => {
    let total = 0;
    let prevLat = origin.lat;
    let prevLng = origin.lng;

    for (let i = 0; i < tour.length; i++) {
      total += calculateHaversineDistance(prevLat, prevLng, tour[i].lat, tour[i].lng);
      prevLat = tour[i].lat;
      prevLng = tour[i].lng;
    }

    if (returnToHub && tour.length > 0) {
      total += calculateHaversineDistance(prevLat, prevLng, origin.lat, origin.lng);
    }
    return total;
  };

  let bestTour = [...ordered];
  let bestDist = calculateTotalTourDistance(bestTour);

  while (improved && iterations < maxIterations) {
    improved = false;
    iterations++;

    for (let i = startIndex; i < bestTour.length - 1; i++) {
      for (let j = i + 1; j < bestTour.length; j++) {
        // Inverte o segmento entre i e j (2-opt swap)
        const newTour = [
          ...bestTour.slice(0, i),
          ...bestTour.slice(i, j + 1).reverse(),
          ...bestTour.slice(j + 1)
        ];

        const newDist = calculateTotalTourDistance(newTour);
        if (newDist < bestDist - 0.001) {
          bestDist = newDist;
          bestTour = newTour;
          improved = true;
          break;
        }
      }
      if (improved) break;
    }
  }

  return bestTour.map((stop, index) => ({
    ...stop,
    sequence: index + 1
  }));
}

/**
 * Consulta a API OSRM Trip pública para roteamento de rua real e sequenciamento TSP
 */
export async function optimizeWithOSRM(
  origin: RouteHubLocation,
  stops: RouteStop[],
  returnToHub: boolean = false
): Promise<{
  orderedStops: RouteStop[];
  geometryCoordinates: [number, number][];
  totalDistanceKm: number;
  totalDurationMinutes: number;
} | null> {
  // Limite seguro de coordenadas para URL pública OSRM: máx 40 paradas
  if (stops.length === 0 || stops.length > 40) {
    return null;
  }

  try {
    // Montar coordenadas: [lon, lat]
    // Ponto 0 é a Origem (Hub)
    const coordinatesList = [
      `${origin.lng.toFixed(6)},${origin.lat.toFixed(6)}`,
      ...stops.map(s => `${s.lng.toFixed(6)},${s.lat.toFixed(6)}`)
    ];

    if (returnToHub) {
      // Se retorna ao hub no final, o source e destination fecham o ciclo
    }

    const coordsParam = coordinatesList.join(';');
    const sourceParam = 'source=first';
    const destinationParam = returnToHub ? '&destination=first' : '&destination=last';
    const url = `https://router.project-osrm.org/trip/v1/driving/${coordsParam}?overview=full&geometries=geojson&${sourceParam}${destinationParam}&roundtrip=${returnToHub}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) return null;

    const data = await response.json();
    if (data.code !== 'Ok' || !data.trips || !data.trips[0] || !data.waypoints) {
      return null;
    }

    const trip = data.trips[0];
    const waypoints: Array<{ waypoint_index: number; trips_index: number }> = data.waypoints;

    // Ordenar os waypoints pela sua ordem na rota (trips_index)
    // O ponto 0 era a origem
    const sortedWaypoints = [...waypoints]
      .filter(w => w.waypoint_index !== 0) // Remover a origem da lista de paradas de entrega
      .sort((a, b) => a.trips_index - b.trips_index);

    const orderedStops: RouteStop[] = sortedWaypoints.map((w, idx) => {
      const originalStop = stops[w.waypoint_index - 1];
      return {
        ...originalStop,
        sequence: idx + 1
      };
    });

    // Converter coordenadas geojson [lon, lat] para formato Leaflet [lat, lon]
    const geometryCoordinates: [number, number][] = (trip.geometry?.coordinates || []).map(
      (c: [number, number]) => [c[1], c[0]]
    );

    const totalDistanceKm = Math.round((trip.distance / 1000) * 10) / 10;
    const totalDurationMinutes = Math.round(trip.duration / 60);

    return {
      orderedStops,
      geometryCoordinates,
      totalDistanceKm,
      totalDurationMinutes
    };
  } catch (err) {
    console.warn('[OSRM Trip API Warning] Fallback para algoritmo local 2-Opt ativado:', err);
    return null;
  }
}

/**
 * Consulta a rota detalhada OSRM Route para desenhar as geometrias exatas das ruas
 */
export async function fetchOSRMRouteGeometry(
  points: { lat: number; lng: number }[]
): Promise<[number, number][]> {
  if (points.length < 2) return [];

  // Se mais de 40 pontos, reduzir para os principais para não exceder limites de URL
  const selectedPoints = points.length > 40
    ? points.filter((_, idx) => idx % Math.ceil(points.length / 40) === 0 || idx === points.length - 1)
    : points;

  try {
    const coordsStr = selectedPoints.map(p => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(';');
    const url = `https://router.project-osrm.org/route/v1/driving/${coordsStr}?overview=full&geometries=geojson`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data.code === 'Ok' && data.routes && data.routes[0]) {
        return (data.routes[0].geometry?.coordinates || []).map((c: [number, number]) => [c[1], c[0]]);
      }
    }
  } catch (_) {}

  // Fallback linha reta entre os pontos
  return points.map(p => [p.lat, p.lng]);
}

/**
 * Função Mestre de Otimização:
 * Tenta OSRM Trip primeiro (motor de rua real). Se falhar ou estiver offline, roda 2-Opt local.
 * Em seguida calcula horários previstos (ETA), distâncias entre paradas e economia.
 */
export async function runFullRouteOptimization(
  origin: RouteHubLocation,
  stops: RouteStop[],
  options: {
    returnToHub?: boolean;
    startTime?: string; // "08:00"
    defaultServiceTimeMin?: number; // ex: 6 min por entrega
  } = {}
): Promise<RouteOptimizationResult> {
  const returnToHub = options.returnToHub ?? false;
  const startTimeStr = options.startTime || '08:00';
  const serviceTimeMin = options.defaultServiceTimeMin ?? 6;

  // Calcular distância não otimizada (na ordem original de chegada)
  let unoptimizedDistanceKm = 0;
  let prevLat = origin.lat;
  let prevLng = origin.lng;
  for (const s of stops) {
    const d = calculateHaversineDistance(prevLat, prevLng, s.lat, s.lng);
    unoptimizedDistanceKm += estimateStreetDistanceKm(d);
    prevLat = s.lat;
    prevLng = s.lng;
  }
  if (returnToHub && stops.length > 0) {
    unoptimizedDistanceKm += estimateStreetDistanceKm(
      calculateHaversineDistance(prevLat, prevLng, origin.lat, origin.lng)
    );
  }
  unoptimizedDistanceKm = Math.round(unoptimizedDistanceKm * 10) / 10;

  // 1. Tentar OSRM Trip
  let optimizedStops: RouteStop[] = [];
  let geometryCoordinates: [number, number][] = [];
  let totalDistanceKm = 0;
  let totalDrivingMinutes = 0;
  let usedEngine: 'osrm' | 'heuristic_2opt' = 'osrm';

  const osrmResult = await optimizeWithOSRM(origin, stops, returnToHub);

  if (osrmResult && osrmResult.orderedStops.length === stops.length) {
    optimizedStops = osrmResult.orderedStops;
    geometryCoordinates = osrmResult.geometryCoordinates;
    totalDistanceKm = osrmResult.totalDistanceKm;
    totalDrivingMinutes = osrmResult.totalDurationMinutes;
  } else {
    // 2. Fallback Heurística 2-Opt
    usedEngine = 'heuristic_2opt';
    optimizedStops = optimizeRoute2Opt(origin, stops, returnToHub);

    // Calcular distâncias com base nas paradas reordenadas
    let currentTourDist = 0;
    let curLat = origin.lat;
    let curLng = origin.lng;

    const tourPoints: { lat: number; lng: number }[] = [{ lat: origin.lat, lng: origin.lng }];

    for (const st of optimizedStops) {
      const d = calculateHaversineDistance(curLat, curLng, st.lat, st.lng);
      currentTourDist += estimateStreetDistanceKm(d);
      curLat = st.lat;
      curLng = st.lng;
      tourPoints.push({ lat: st.lat, lng: st.lng });
    }

    if (returnToHub) {
      currentTourDist += estimateStreetDistanceKm(
        calculateHaversineDistance(curLat, curLng, origin.lat, origin.lng)
      );
      tourPoints.push({ lat: origin.lat, lng: origin.lng });
    }

    totalDistanceKm = Math.round(currentTourDist * 10) / 10;
    totalDrivingMinutes = estimateDrivingMinutes(totalDistanceKm);

    // Tentar desenhar geometria bonita das vias via OSRM Route
    geometryCoordinates = await fetchOSRMRouteGeometry(tourPoints);
  }

  // 3. Calcular Horários Previstos de Chegada (ETA) e Partida
  const [startHour, startMin] = startTimeStr.split(':').map(n => parseInt(n, 10) || 0);
  let currentTotalMinutes = startHour * 60 + startMin;

  let lastLat = origin.lat;
  let lastLng = origin.lng;

  const finalStopsWithSchedule: RouteStop[] = optimizedStops.map((stop) => {
    const legDistance = estimateStreetDistanceKm(calculateHaversineDistance(lastLat, lastLng, stop.lat, stop.lng));
    const legDrivingMin = estimateDrivingMinutes(legDistance);

    currentTotalMinutes += legDrivingMin;
    const arrH = Math.floor(currentTotalMinutes / 60) % 24;
    const arrM = currentTotalMinutes % 60;
    const estimatedArrival = `${String(arrH).padStart(2, '0')}:${String(arrM).padStart(2, '0')}`;

    const effectiveServiceTime = stop.serviceTimeMinutes || serviceTimeMin;
    currentTotalMinutes += effectiveServiceTime;
    const depH = Math.floor(currentTotalMinutes / 60) % 24;
    const depM = currentTotalMinutes % 60;
    const estimatedDeparture = `${String(depH).padStart(2, '0')}:${String(depM).padStart(2, '0')}`;

    lastLat = stop.lat;
    lastLng = stop.lng;

    return {
      ...stop,
      distanceFromPreviousKm: legDistance,
      durationFromPreviousMin: legDrivingMin,
      serviceTimeMinutes: effectiveServiceTime,
      estimatedArrival,
      estimatedDeparture
    };
  });

  // Tempo total da rota inclui tempo de direção + tempo de atendimento de todas as paradas
  const totalServiceMinutes = stops.length * serviceTimeMin;
  const totalDurationMinutes = totalDrivingMinutes + totalServiceMinutes;

  // Economia gerada pela otimização
  const savedDistanceKm = Math.max(0, Math.round((unoptimizedDistanceKm - totalDistanceKm) * 10) / 10);
  const savedPercent = unoptimizedDistanceKm > 0
    ? Math.min(65, Math.max(0, Math.round((savedDistanceKm / unoptimizedDistanceKm) * 100)))
    : 0;
  const savedMinutes = Math.round((savedDistanceKm / 24) * 60);

  return {
    stops: finalStopsWithSchedule,
    totalDistanceKm,
    totalDurationMinutes,
    unoptimizedDistanceKm,
    savedDistanceKm,
    savedPercent,
    savedMinutes,
    geometryCoordinates,
    usedEngine
  };
}

/**
 * Gera o link universal oficial do Google Maps com paradas na ordem otimizada
 */
export function generateGoogleMapsNavigationUrl(
  origin: RouteHubLocation,
  stops: RouteStop[],
  returnToHub: boolean = false
): string {
  if (stops.length === 0) return '';

  const originParam = `${origin.lat},${origin.lng}`;
  const finalDest = returnToHub ? originParam : `${stops[stops.length - 1].lat},${stops[stops.length - 1].lng}`;

  const waypointsList = (returnToHub ? stops : stops.slice(0, stops.length - 1))
    .map(s => `${s.lat},${s.lng}`);

  // O Google Maps aceita até ~9 waypoints no link da web
  const cappedWaypoints = waypointsList.slice(0, 9).join('|');

  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(originParam)}&destination=${encodeURIComponent(finalDest)}${cappedWaypoints ? `&waypoints=${encodeURIComponent(cappedWaypoints)}` : ''}&travelmode=driving`;
}

/**
 * Gera o link do Waze para uma parada específica
 */
export function generateWazeNavigationUrl(stop: RouteStop): string {
  return `https://waze.com/ul?ll=${stop.lat},${stop.lng}&navigate=yes`;
}
