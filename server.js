// Programação no lado do servidor (backend), incluindo a recepção e o processamento de dados das API.
// Server-side (backend) programming, including receiving and processing data from the APIs.

// Importação das bibliotecas necessárias
const express = require('express');  // Framework web para criação do servidor e das rotas
const helmet = require('helmet');    // Middleware de segurança para configurar os headers HTTP
const fetch = require('node-fetch'); // Biblioteca para fazer pedidos HTTP (API externas)
const path = require('path');        // Utilitário para manipular caminhos de diretórios e ficheiros
const app = express();               // Inicialização da aplicação Express
const fs = require('fs');            // Sistema de ficheiros nativos do Node.js

// Definição das configurações das APIs dos operadores (atualmente somente a Carris Metropolitana funciona)
const OPERATORS_CONFIG = {
    'ccfl': {
        name: 'Carris (CCFL)',
        gtfsPath: path.join(__dirname, 'gtfs', 'ccfl'),
        isStatic: true, // Flag para diferenciar de APIs de tempo real
        endpoints: {}
    },
    'cmet': { 
        name: 'Carris Metropolitana (CMet)',
        baseUrl: 'https://api.carrismetropolitana.pt/', // URL base da Carris Metropolitana
        endpoints: {
            arrivals: 'v2/arrivals/by_stop/',           // Endpoint para as chegadas (em tempo real)
            patterns: 'patterns/',                      // Endpoint para detalhes de percursos (patterns)
            stops: 'v2/stops',                          // Endpoint para lista de paragens
            vehicles: 'v2/vehicles'                     // Endpoint para a frota
        }
    },
    'cp': {
        name: 'Comboios de Portugal (CP)',
        gtfsPath: path.join(__dirname, 'gtfs', 'cp'),
        isStatic: true,
        endpoints: {}
    },
    'ft': {
        name: 'Fertagus',
        gtfsPath: path.join(__dirname, 'gtfs', 'ft'),
        isStatic: true,
        endpoints: {}
    },
    'ml': {
        name: 'Metro de Lisboa (ML)',
        gtfsPath: path.join(__dirname, 'gtfs', 'ml'),
        isStatic: true,
        endpoints: {}
    },
    'mst': {
        name: 'Metro Sul do Tejo (MST)',
        baseUrl: '',                                    // URL base do Metro Sul do Tejo
        endpoints: {
            arrivals: '',                               // Endpoint para as chegadas (em tempo real)
            patterns: '',                               // Endpoint para detalhes de percursos (patterns)
            stops: '',                                  // Endpoint para lista de paragens
            vehicles: ''                                // Endpoint para a frota
        }
    },
    'mobi': {
        name: 'MobiCascais',
        gtfsPath: path.join(__dirname, 'gtfs', 'mobi'),
        isStatic: true,
        endpoints: {}
    },
    'tcb': {
        name: 'Transportes Coletivos do Barreiro (TCB)',
        gtfsPath: path.join(__dirname, 'gtfs', 'tcb'),
        isStatic: true,
        endpoints: {}
    },
    'ttsl': {
        name: 'Transtejo Soflusa (TTSL)',
        gtfsPath: path.join(__dirname, 'gtfs', 'ttsl'),
        isStatic: true,
        endpoints: {}
    }
};

if (!fs.existsSync('data')) fs.mkdirSync('data');
const PORT = 8081;                                              // Porta onde o servidor vai correr
const PATTERN_CACHE_FILE = path.join(__dirname, 'data/pattern_cache.json'); // Caminho para o ficheiro JSON (BD local)
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Middlewares
app.use(express.static(path.join(__dirname, 'www'))); // Serve ficheiros HTML/JS/CSS da pasta 'www'
app.use(express.json()); // Permite que o servidor entenda corpos de pedidos no formato JSON

// Configuração do padrão Helmet (incluindo o HSTS que a usar o HTTPS durante 90 dias)
app.use(helmet());
app.use(helmet.hsts({maxAge: 90 * 24 * 60 * 60, force: true, includeSubDomains: true}));

// Objeto central de caches
let caches = {};
let patternStopFinalCache = {};  // Guarda { patternId: "ultimoStopId" }

// Inicializa a estrutura de cache para cada operador definido no CONFIG
Object.keys(OPERATORS_CONFIG).forEach(op => {
    caches[op] = {
        stopNames: {},
        stopPatterns: {},
        vehicles: {},
        isLoaded: false
    };
});

// A cache de patterns (destino final) separada por IDs únicos.
// Cache para dados estáticos do GTFS
let staticDataCache = {
    ccfl: { routes: [], stops: {}, stopTimes: [], trips: [] },
    cp: { routes: [], stops: {}, stopTimes: [], trips: [] },
    ft: { routes: [], stops: {}, stopTimes: [], trips: [], vehicles: [] },
    ml: { routes: [], stops: {}, stopTimes: [], trips: [] },
    mobi: { routes: [], stops: {}, stopTimes: [], trips: [], vehicles: [] },
    tcb: { routes: [], stops: {}, stopTimes: [], trips: [] },
    ttsl: { routes: [], stops: {}, stopTimes: [], trips: [] }
};

const parseCSV = (filePath) => {
    if (!fs.existsSync(filePath)) return [];
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    
    return lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
        return headers.reduce((obj, header, i) => {
            obj[header] = values[i];
            return obj;
        }, {});
    });
};

// Carrega GTFS para memória no arranque
function loadStaticGTFS(opKey) {
    if (!opKey || !OPERATORS_CONFIG[opKey]) return;
    const config = OPERATORS_CONFIG[opKey];
    if (!config.isStatic) return;

    try {
        console.log(`A carregar GTFS para ${opKey}...`);
        
        // Carrega e indexa paragens
        const stopsArr = parseCSV(path.join(config.gtfsPath, 'stops.txt'));
        staticDataCache[opKey].stops = {};
        stopsArr.forEach(s => { staticDataCache[opKey].stops[s.stop_id] = s.stop_name; });

        // Indexa Routes por ID
        const routesArr = parseCSV(path.join(config.gtfsPath, 'routes.txt'));
        staticDataCache[opKey].routes = {};
        routesArr.forEach(r => { staticDataCache[opKey].routes[r.route_id] = r; });

        // Indexa Trips por ID
        const tripsArr = parseCSV(path.join(config.gtfsPath, 'trips.txt'));
        staticDataCache[opKey].trips = {};
        tripsArr.forEach(t => { staticDataCache[opKey].trips[t.trip_id] = t; });

        // Agrupa Stop Times por Stop ID
        const allStopTimes = parseCSV(path.join(config.gtfsPath, 'stop_times.txt'));
        staticDataCache[opKey].stopTimesByStop = {};
        allStopTimes.forEach(st => {
            if (!staticDataCache[opKey].stopTimesByStop[st.stop_id]) {
                staticDataCache[opKey].stopTimesByStop[st.stop_id] = [];
            }
            staticDataCache[opKey].stopTimesByStop[st.stop_id].push(st);
        });

        console.log(`GTFS ${opKey} indexado com sucesso.`);
    } catch (err) {
        console.error(`Erro ao carregar ficheiros GTFS de ${opKey}:`, err.message);
    }
}

/**
 * Uniformizar a linguagem a ser falada por cada serviço, seguindo o formato da Carris Metropolitana
 * @param {*} operatorKey 
 * @param {*} rawData 
 * @returns 
 */
function normalizeArrivalData(operatorKey, rawData) {
    // Seguir formato da Carris Metropolitana por ser o original e mais completo
    if (operatorKey === 'cmet') return rawData;
    
    /*
    if (operatorKey === 'carris') {
        return rawData.map(item => ({
            stop_id: item.id_paragem,
            estimated_arrival: item.schedule,
            ...
        }));
    }
    */
}

/**
 * Transforma o objeto JavaScript num ficheiro JSON com os valores da última paragem e a data de atualização
 */
function savePatternCache() {
    try {
        fs.writeFileSync(PATTERN_CACHE_FILE, JSON.stringify(patternStopFinalCache, null, 2));
    } catch (err) {
        console.error('Erro ao gravar cache:', err);
    }
}

/**
 * Lê o ficheiro de cache ao iniciar o servidor. Se existir, restaura os dados da variável 'patternStopFinalCache'
 */
function loadPatternCache() {
    try {
        if (fs.existsSync(PATTERN_CACHE_FILE)) { // Se o ficheiro existir.
            const parsed = JSON.parse(fs.readFileSync(PATTERN_CACHE_FILE, 'utf8'))

            if (typeof parsed === 'object' && parsed !== null) {
                patternStopFinalCache = Object.fromEntries(
                    Object.entries(parsed).filter(([k, v]) => 
                    typeof k === 'string' && v.lastUpdated && (Date.now() - v.lastUpdated) < 24 * 60 * 60 * 1000)
                );
            }
            // Filtra os registos dentro das últimas 24 horas pedidos, eliminando os restantes.
            console.log(`Cache carregada: ${Object.keys(patternStopFinalCache).length} percursos.`);
            savePatternCache();
        }
    } catch (err) { // Em caso de erro (ex: JSON corrompido), inicializa um novo objeto vazio eliminando o antigo.
        console.error('Erro ao ler cache. A reiniciar ficheiro...');
        patternStopFinalCache = {};
        if (fs.existsSync(PATTERN_CACHE_FILE)) fs.unlinkSync(PATTERN_CACHE_FILE);
    }
}

/**
 * Atualiza a cache de veículos no background para não atrasar o pedido do utilizador
 * @param {*} operatorKey 
 * @returns 
 */
async function updateVehicleCache(operatorKey) {
    try {
        const config = OPERATORS_CONFIG[operatorKey];
        if (!config || !config.baseUrl) return;

        const response = await fetch(`${config.baseUrl}${config.endpoints.vehicles}`, { timeout: 10000 }); // Pedido API pelos veículos
        if (response.ok) {
            const data = await response.json();
            // Transforma o array da API num objeto indexado por ID para pesquisa
            caches[operatorKey].vehicles = data.reduce((acc, v) => {
                acc[v.id] = {
                    make: v.make || '-',                    // Marca do veículo
                    model: v.model || '-',                  // Modelo
                    capacity_total: v.capacity_total || '-' // Capacidade total
                };
                return acc;
            }, {});
            console.log(`Cache de veículos [${operatorKey}] atualizada: ${Object.keys(caches[operatorKey].vehicles).length} entradas.`);
        }
    } catch (error) {
        console.error('Erro ao atualizar veículos:', error.message);
    }
}

/**
 * Carrega nomes e patterns de todas as paragens no arranque do servidor
 * @param {*} operatorKey 
 * @returns 
 */
async function loadStopNames(operatorKey) {
    const opCache = caches[operatorKey];
    if (!opCache || opCache.isLoaded) return; // Evita recarregar se já estiver na memória

    console.log('A carregar nomes de paragens da API...');
    try {
        const config = OPERATORS_CONFIG[operatorKey];
        if (!config || !config.baseUrl) return;

        const response = await fetch(`${config.baseUrl}${config.endpoints.stops}`, { timeout: 30000 });
        
        if (!response.ok) {
            console.error(`[${operatorKey}] Erro API: ${response.status}`);
            return;
        }

        const data = await response.json();
        console.log(`[${operatorKey}] A processar ${data.length} paragens...`);

        for (let i = 0; i < data.length; i++) {
            const stop = data[i];
            const sid = String(stop.id);
            // Se o status for 'voided', marca como desativada
            opCache.stopNames[stop.id] = stop.operational_status === 'voided' ? 'Paragem Desativada' : stop.long_name;
            // Se a paragem tiver patterns associados, guarda para lógica de filtragem posterior
            if (stop.pattern_ids?.length > 0) {
                opCache.stopPatterns[sid] = stop.pattern_ids.map(String);
            }

            if (i % 500 === 0) await new Promise(resolve => setImmediate(resolve));
        }

        opCache.isLoaded = true;
        console.log(`[${operatorKey}] Cache carregada com sucesso.`);
    } catch (error) {
        console.error(`[${operatorKey}] Falha no carregamento:`, error.message);
    }
}

/**
 * Obtém o ID da paragem final de um percurso para filtrar autocarros que já terminaram a viagem
 * @param {*} operatorKey 
 * @param {*} patternId 
 * @param {*} currentStopId 
 * @param {*} retries 
 * @returns 
 */
async function getFinalStopId(operatorKey, patternId, currentStopId, retries = 1) {
    if (!patternId) return null;

    // Verifica a cache da memória, retornando-a se existir e for mais recente que 24 horas
    const cached = patternStopFinalCache[patternId];
    if (cached && (Date.now() - cached.lastUpdated < 24 * 60 * 60 * 1000)) {
        return cached.stopId === String(currentStopId) ? null : cached.stopId;
    }

    const config = OPERATORS_CONFIG[operatorKey];

    // Ciclo de tentativas para lidar com instabilidade da API (ex: ETIMEDOUT)
    for (let i = 0; i <= retries; i++) {
        try {
            // AbortController impede que o fetch fique "eternamente" à espera
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 2000);

            const response = await fetch(`${config.baseUrl}${config.endpoints.patterns}${patternId}`, { 
                signal: controller.signal 
            });
            clearTimeout(timeout);
            
            if (!response.ok) continue;

            const patternData = await response.json();
            const lastStop = patternData.path?.[patternData.path.length - 1];
            const finalStopId = String(lastStop?.stop?.id || lastStop?.stop?.stop_id || "");

            if (finalStopId) {
                patternStopFinalCache[patternId] = { stopId: finalStopId, lastUpdated: Date.now() };
                savePatternCache();
                return finalStopId === String(currentStopId) ? null : finalStopId;
            }
        } catch (err) {
            if (i === retries) return null;
            await sleep(300);
        }
    }
    return null;
}

/**
 * Função auxiliar para obter patterns da cache de forma síncrona
 * @param {*} operatorKey
 * @param {*} stopId
 * @return {*} 
 */
async function getpatternIdsForStop(operatorKey, stopId) {
    return caches[operatorKey] ? (caches[operatorKey].stopPatterns[String(stopId)] || []) : [];
}

/**
 * **
 * Processa os dados de uma única paragem (chegadas + filtragem de destino final)
 * @param {*} operatorKey 
 * @param {*} currentStopId 
 * @returns 
 */
async function fetchSingleStopData(operatorKey, currentStopId) {
    try {
        const config = OPERATORS_CONFIG[operatorKey];
        if (!config) return { error: 'Operador desconhecido' };

        const response = await fetch(`${config.baseUrl}${config.endpoints.arrivals}${currentStopId}`, { timeout: 8000 });
        
        if (response.status === 429) return { stopId: currentStopId, error: 'Limite de pedidos excedido.' };
        if (!response.ok) return { stopId: currentStopId, error: `Erro API: ${response.status}` };

        const rawData = await response.json(); // Chegadas em tempo real
        const data = normalizeArrivalData(operatorKey, rawData); // Normalização dos dados
        const allStopPatterns = await getpatternIdsForStop(operatorKey, currentStopId); // Patterns que passam nesta paragem
        
        // Resolve em paralelo os IDs das paragens finais de todos os patterns desta paragem
        const finalStopResults = await Promise.all(
            allStopPatterns.map(pid => getFinalStopId(operatorKey, pid, currentStopId))
        );

        const finalStopMap = {};
        allStopPatterns.forEach((pid, index) => {
            if (finalStopResults[index]) finalStopMap[pid] = finalStopResults[index];
        });

        // Remove os horários cujo destino final é a paragem atual (paragem final)
        const filteredArrivals = data.filter(arrival => {
            const finalStopId = finalStopMap[arrival.pattern_id];
            if (!finalStopId) return false;
            return String(finalStopId) !== String(currentStopId);
        });

        return { stopId: currentStopId, data: filteredArrivals };
    } catch (error) {
        return { stopId: currentStopId, error: 'Erro interno.' };
    }
}

/**
 * Rota principal da API que o Frontend consome
 */
app.post('/api/arrivals', async (req, res) => {
    try {
        const { operators, stopIds } = req.body;
        if (!Array.isArray(operators) || !Array.isArray(stopIds)) {
            return res.status(400).json({ error: 'Pedido inválido.' });
        }

        // Processa as paragens em paralelo, mas de forma isolada
        const results = await Promise.all(stopIds.map(async (id) => {
            for (const opKey of operators) {
                const config = OPERATORS_CONFIG[opKey];
                if (!config) continue;

                // Dados estáticos (GTFS)
                if (config.isStatic) {
                    const opStatic = staticDataCache[opKey];
                    const stopName = opStatic.stops[id];

                    if (stopName) {
                        // Busca instantânea pelo ID da paragem
                        const stopPassages = opStatic.stopTimesByStop[id] || [];
                        
                        const data = stopPassages.slice(0, 50).map(passage => {
                            const trip = opStatic.trips[passage.trip_id];
                            const route = trip ? opStatic.routes[trip.route_id] : null;
                            
                            let lineId = route?.route_short_name || "Linha";
                            let headsign = trip?.trip_headsign || route?.route_long_name || "Destino";

                            if (opKey === 'ccfl') {
                                headsign = headsign.split(' - ').pop().trim();
                            }
                            if (opKey === 'cp') {
                                lineId = lineId.replace(/^Linha d[oae]s?\s+/gi, '').trim();
                            }
                            if (opKey === 'tcb') {
                                headsign = headsign.replace(/^\S+\s+/, '').trim();
                            }

                            return {
                                line_id: lineId,
                                headsign: headsign,
                                scheduled_arrival: passage.arrival_time,
                                realtime: false
                            };
                        });

                        return { stopId: id, stopName: stopName, operator: opKey, data: data };
                    }
                } 
                // Dados em tempo real
                else {
                    if (!caches[opKey].isLoaded) await loadStopNames(opKey);
                    const stopName = caches[opKey].stopNames[id];

                    if (stopName) {
                        const stopData = await fetchSingleStopData(opKey, id);
                        if (stopData.error) return stopData;

                        // Anexar detalhes dos veículos guardados na cache
                        const dataWithDetails = (stopData.data || []).map(arrival => ({
                            ...arrival,
                            vehicleDetails: caches[opKey].vehicles[arrival.vehicle_id] || null
                        }));

                        return { ...stopData, data: dataWithDetails, operator: opKey, stopName: stopName };
                    }
                }
            }
            return { stopId: id, stopName: "Não Encontrado", error: "404", data: [] };
        }));

        res.json(results);
    } catch (error) {
        console.error('Erro crítico na rota:', error);
        if (!res.headersSent) res.status(500).json({ error: 'Erro interno.' });
    }
});

// Serve a página principal
app.get('/', (_, res) => {
    res.sendFile(path.join(__dirname, 'www', 'mtst_aml.html'));
});

// Inicialização do Servidor
app.listen(PORT, async () => {
    console.log(`Servidor ativo em http://localhost:${PORT}`);
    
    // Carrega as caches assim que o servidor liga
    loadPatternCache();

    // Carrega GTFS estáticos primeiro
    for (const op in OPERATORS_CONFIG) {
        if (OPERATORS_CONFIG[op].isStatic) loadStaticGTFS(op);
    }

    // Carrega as APIs uma de cada vez
    for (const op in OPERATORS_CONFIG) {
        if (OPERATORS_CONFIG[op].baseUrl) {
            await loadStopNames(op); // Espera um terminar antes de começar outro
            updateVehicleCache(op);
            setInterval(() => updateVehicleCache(op), 60000);
        }
    }
});