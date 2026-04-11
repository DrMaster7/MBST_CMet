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
        baseUrl: '',                                    // URL base da Carris
        endpoints: {
            arrivals: '',                               // Endpoint para as chegadas (em tempo real)
            patterns: '',                               // Endpoint para detalhes de percursos (patterns)
            stops: '',                                  // Endpoint para lista de paragens
            vehicles: ''                                // Endpoint para a frota
        }
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
        baseUrl: '',                                    // URL base da Comboios de Portugal (CP)
        endpoints: {
            arrivals: '',                               // Endpoint para as chegadas (em tempo real)
            patterns: '',                               // Endpoint para detalhes de percursos (patterns)
            stops: '',                                  // Endpoint para lista de paragens
            vehicles: ''                                // Endpoint para a frota
        }
    },
    'ft': {
        name: 'Fertagus',
        baseUrl: '',                                    // URL base da Fertagus
        endpoints: {
            arrivals: '',                               // Endpoint para as chegadas (em tempo real)
            patterns: '',                               // Endpoint para detalhes de percursos (patterns)
            stops: '',                                  // Endpoint para lista de paragens
            vehicles: ''                                // Endpoint para a frota
        }
    },
    'ml': {
        name: 'Metro de Lisboa (ML)',
        baseUrl: '',                                    // URL base do Metro de Lisboa
        endpoints: {
            arrivals: '',                               // Endpoint para as chegadas (em tempo real)
            patterns: '',                               // Endpoint para detalhes de percursos (patterns)
            stops: '',                                  // Endpoint para lista de paragens
            vehicles: ''                                // Endpoint para a frota
        }
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
        baseUrl: '',                                    // URL base da MobiCascais
        endpoints: {
            arrivals: '',                               // Endpoint para as chegadas (em tempo real)
            patterns: '',                               // Endpoint para detalhes de percursos (patterns)
            stops: '',                                  // Endpoint para lista de paragens
            vehicles: ''                                // Endpoint para a frota
        }
    },
    'tcb': {
        name: 'Transportes Coletivos do Barreiro (TCB)',
        baseUrl: '',                                    // URL base dos Transportes Coletivos do Barreiro
        endpoints: {
            arrivals: '',                               // Endpoint para as chegadas (em tempo real)
            patterns: '',                               // Endpoint para detalhes de percursos (patterns)
            stops: '',                                  // Endpoint para lista de paragens
            vehicles: ''                                // Endpoint para a frota
        }
    },
    'ttsl': {
        name: 'Transtejo Soflusa (TTSL)',
        baseUrl: '',                                    // URL base da Transtejo Soflusa
        endpoints: {
            arrivals: '',                               // Endpoint para as chegadas (em tempo real)
            patterns: '',                               // Endpoint para detalhes de percursos (patterns)
            stops: '',                                  // Endpoint para lista de paragens
            vehicles: ''                                // Endpoint para a frota
        }
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
let patternStopFinalCache = {};  // Guarda { patternId: "ultimoStopId" }

/**
 * Uniformizar a linguagem a ser falada por cada serviço, seguindo o formato da Carris Metropolitana
 * @param {*} operatorKey 
 * @param {*} rawData 
 * @returns 
 */
function normalizeArrivalData(operatorKey, rawData) {
    // Seguir formato da Carris Metropolitana por ser o original e mais completo
    if (operatorKey === 'cmet') return rawData;
    
    if (operatorKey === 'tcb') {
        if (dataType === 'stops') {
            return rawData.map(item => ({
                id: item.id,
                long_name: item.stop_name,
                operational_status: 'active',
                pattern_ids: []
            }));
        }

        if (dataType === 'vehicles') {
            return rawData.map(item => ({
                id: item.id,
                capacity_total: null,
                make: null,
                model: null
            }));
        }
    }
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
        if (!config|| !config.baseUrl) return { error: 'Operador desconhecido' };

        const response = await fetch(`${config.baseUrl}${config.endpoints.stops}`, { timeout: 10000 });
        if (response.ok) {
            const rawData = await response.json();
            const data = normalizeArrivalData(operatorKey, 'stops', rawData);

            // Itera sobre todas as paragens para popular as caches de nomes e patterns
            data.forEach(stop => {
                // Se o status for 'voided', marca como desativada
                opCache.stopNames[stop.id] = stop.operational_status === 'voided' ? 'Paragem Desativada' : stop.long_name;
                // Se a paragem tiver patterns associados, guarda para lógica de filtragem posterior
                if (stop.pattern_ids && stop.pattern_ids.length > 0) {
                    opCache.stopPatterns[stop.id] = stop.pattern_ids.map(String);
                }
            });
            opCache.isLoaded = true; 
            console.log(`Cache [${operatorKey}] carregada: ${Object.keys(opCache.stopNames).length} paragens.`);
        }
    } catch (error) {
        console.error(`Erro ao carregar paragens de ${operatorKey}:`, error.message);
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
async function getFinalStopId(operatorKey, patternId, currentStopId, retries = 2) {
    if (!patternId) return null;

    const cached = patternStopFinalCache[patternId];
    
    // Verifica a cache da memória, retornando-a se existir e for mais recente que 24 horas
    if (cached && (Date.now() - cached.lastUpdated < 24 * 60 * 60 * 1000)) {
        if (cached.stopId === String(currentStopId)) return null;
        return cached.stopId;
    }

    // Ciclo de tentativas para lidar com instabilidade da API (ex: ETIMEDOUT)
    for (let i = 0; i <= retries; i++) {
        try {
            const config = OPERATORS_CONFIG[operatorKey];
            if (!config) return { error: 'Operador desconhecido' };

            const response = await fetch(`${config.baseUrl}${config.endpoints.patterns}${encodeURIComponent(patternId)}`, { timeout: 10000 });
            
            if (!response.ok) {
                if (response.status === 404) return null; // Pattern inexistente (não precisa de ciclo)
                throw new Error(`Status ${response.status}`);
            }

            const patternData = await response.json();
            const patternPath = patternData.path;
        
            if (Array.isArray(patternPath) && patternPath.length > 0) {
                // Obtém a última paragem da lista
                const finalStopContainer = patternPath[patternPath.length - 1]; 
                const finalStopId = String(finalStopContainer.stop?.id || finalStopContainer.stop?.stop_id || null);
                if (finalStopId && finalStopId !== 'null') { 
                    if (finalStopId === String(currentStopId)) { // Se a paragem pesquisada é o destino, descarta na cache
                        return null;
                    } else { // Guarda a cache para uso futuro pelas próximas 24 horas
                        patternStopFinalCache[patternId] = { 
                            stopId: finalStopId,
                            lastUpdated: Date.now()
                        };
                        savePatternCache(); // Sincroniza a memória guardando na cache
                        return finalStopId;
                    }
                }
                break;
            }
        } catch (err) {
            if (i === retries) { // Se falhar e ainda houver tentativas, espera um tempo incremental
                console.error(`Erro ao pattern ${patternId} após ${retries} tentativas:`, err.message);
                // Se a API falhar mas existir um valor antigo (mesmo expirado), usa-se para retornar uma resposta.
                return cached ? cached.stopId : null;
            }
            // Espera de 500ms na 1ª falha, 1000ms na 2ª, 1500ms na 3ª, etc.
            await sleep(500 * (i + 1));
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
        const finalStopResults = [];
        for (const pid of allStopPatterns) {
            const res = await getFinalStopId(operatorKey, pid, currentStopId);
            finalStopResults.push(res);
        }

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

        // Validação de segurança básica
        if (!Array.isArray(operators) || !Array.isArray(stopIds)) {
            return res.status(400).json({ error: 'Pedido inválido: formato de dados incorreto.' });
        }

        if (stopIds.length === 0 || stopIds.length > 25) {
            return res.status(400).json({ error: 'Pedido inválido: envie entre 1 e 25 IDs.' });
        }

        const results = [];

        // Processamento por ID de paragem
        for (const id of stopIds) {
            let found = false;

            // Tentamos encontrar o ID em cada um dos operadores selecionados pelo utilizador
            for (const opKey of operators) {
                // Segurança: Ignora se o operador enviado não existir no servidor
                if (!caches[opKey]) {
                    console.warn(`Aviso: Operador '${opKey}' não configurado.`);
                    continue;
                }

                // Carrega nomes do operador se ainda não estiverem em memória
                if (!caches[opKey].isLoaded) {
                    await loadStopNames(opKey);
                }
                
                // Tenta obter o nome da paragem na cache deste operador
                const stopName = caches[opKey].stopNames[id];

                if (stopName) {
                    // Se encontrou, vai procurar as chegadas reais na API desse operador
                    const stopData = await fetchSingleStopData(opKey, id);
                    
                    results.push({
                        ...stopData,
                        operator: opKey,
                        stopName: stopName
                    });
                    
                    found = true;
                    break; // Para de procurar nos outros operadores para este ID
                }
            }

            // Se o ID não foi encontrado em nenhum operador ativo
            if (!found) {
                results.push({ 
                    stopId: id, 
                    stopName: "Paragem Inexistente", 
                    error: "404 Not Found",
                    data: [] 
                });
            }
        }

        res.json(results);

    } catch (error) {
        console.error('Erro crítico no processamento:', error);
        res.status(500).json({ error: 'Erro interno ao processar múltiplos operadores.' });
    }
});

// Serve a página principal
app.get('/', (_, res) => {
    res.sendFile(path.join(__dirname, 'www', 'mtst_aml.html'));
});

// Inicialização do Servidor
app.listen(PORT, () => {
    console.log(`Servidor ativo em http://localhost:${PORT}`);
    
    // Carrega as caches assim que o servidor liga
    loadPatternCache();
    Object.keys(OPERATORS_CONFIG).forEach(op => {
        if (OPERATORS_CONFIG[op].baseUrl) {
            loadStopNames(op).then(() => {
                updateVehicleCache(op);
                setInterval(() => updateVehicleCache(op), 60000);
            });
        }
    });
});