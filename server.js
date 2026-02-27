// Programação no lado do servidor (backend), incluindo a recepção e o processamento de dados da API Carris Metropolitana.
// Server-side (backend) programming, including receiving and processing data from the Carris Metropolitana API.

// Carrega as variáveis de ambiente do ficheiro .env para o objeto process.env do Node.js
require('dotenv').config();

// Importação das bibliotecas necessárias
const express = require('express');  // Framework web para criação do servidor e das rotas
const helmet = require('helmet');    // Middleware de segurança para configurar os headers HTTP
const fetch = require('node-fetch'); // Biblioteca para fazer pedidos HTTP (API externas)
const path = require('path');        // Utilitário para manipular caminhos de diretórios e ficheiros
const app = express();               // Inicialização da aplicação Express

// Definição dos endpoints da API da Carris Metropolitana (CM)
const CMET_API_BASE = process.env.CMET_API_BASE || 'https://api.carrismetropolitana.pt/'; // Base URL
const CMET_ARRIVALS_API = 'v2/arrivals/by_stop/' // Endpoint para chegadas em tempo real
const CMET_STOPS_API = 'v2/stops';               // Endpoint para lista de paragens e metadados
const CMET_PATTERNS_API = 'patterns/';           // Endpoint para detalhes de percursos (patterns)
const CMET_VEHICLES = 'v2/vehicles';             // Endpoint para estado atual da frota
const PORT = process.env.PORT || 8081;           // Porta onde o servidor vai correr

// Middlewares
app.use(express.static(path.join(__dirname, 'www'))); // Serve ficheiros HTML/JS/CSS da pasta 'www'
app.use(express.json()); // Permite que o servidor entenda corpos de pedidos no formato JSON

// Configuração de segurança HSTS via Helmet (força HTTPS durante 90 dias)
app.use(helmet.hsts({maxAge: 90 * 24 * 60 * 60, force: true, includeSubDomains: true}));

// Caches globais para evitar pedidos redundantes à API externa e acelerar a resposta
let stopNameCache = {};          // Guarda { stopId: "Nome da Paragem" }
let patternStopFinalCache = {};  // Guarda { patternId: "ultimoStopId" }
let stopPatternCache = {};       // Guarda { stopId: [lista de patterns] }
let vehicleCache = {};           // Guarda detalhes técnicos dos veículos (modelo, capacidade)
let stopCacheLoaded = false;     // Flag para verificar se a base de paragens já foi carregada

/**
 * Atualiza a cache de veículos no background para não atrasar o pedido do utilizador
 */
async function updateVehicleCache() {
    try {
        // Faz o pedido à API de veículos
        const response = await fetch(`${CMET_API_BASE}${CMET_VEHICLES}`, { timeout: 10000 });
        if (response.ok) {
            const data = await response.json();
            // Transforma o array da API num objeto indexado por ID para busca rápida O(1)
            vehicleCache = data.reduce((acc, v) => {
                acc[v.id] = {
                    make: v.make || '-',                    // Marca do veículo
                    model: v.model || '-',                  // Modelo
                    capacity_total: v.capacity_total || '-' // Lotação total
                };
                return acc;
            }, {});
            console.log(`Cache de veículos atualizada: ${Object.keys(vehicleCache).length} entradas.`);
        }
    } catch (error) {
        console.error('Erro ao atualizar veículos:', error.message);
    }
}

/**
 * Carrega nomes e patterns de todas as paragens no arranque do servidor
 */
async function loadStopNames() {
    if (stopCacheLoaded) return; // Evita recarregar se já estiver na memória
    console.log('A carregar nomes de paragens da API...');

    try {
        const response = await fetch(`${CMET_API_BASE}${CMET_STOPS_API}`, { timeout: 10000 });
        if (response.ok) {
            const data = await response.json();
            // Itera sobre todas as paragens para popular as caches de nomes e patterns
            data.forEach(stop => {
                // Se o status for 'voided', marcamos como desativada
                stopNameCache[stop.id] = stop.operational_status === 'voided' ? 'Paragem Desativada' : stop.long_name;
                // Se a paragem tiver patterns associados, guarda-os para lógica de filtragem posterior
                if (stop.pattern_ids && stop.pattern_ids.length > 0) {
                    stopPatternCache[stop.id] = stop.pattern_ids.map(String);
                }
            });
            stopCacheLoaded = true; // Marca como carregado com sucesso
            console.log(`Cache de paragens carregada com ${Object.keys(stopNameCache).length} entradas.`);
        }
    } catch (error) {
        console.error('Erro de rede ao carregar a API de paragens:', error);
    }
}

/**
 * Obtém o ID da paragem final de um percurso para filtrar autocarros que já terminaram a viagem
 */
async function getFinalStopId(patternId) {
    if (!patternId) return null;
    if (patternStopFinalCache[patternId]) return patternStopFinalCache[patternId]; // Retorna da cache se existir

    try {
        const response = await fetch(`${CMET_API_BASE}${CMET_PATTERNS_API}${patternId}`, { timeout: 5000 });
        if (!response.ok) return null;

        const patternData = await response.json();
        const patternPath = patternData.path;

        if (Array.isArray(patternPath) && patternPath.length > 0) {
            const finalStopContainer = patternPath[patternPath.length - 1]; // Obtém a última paragem da lista
            const finalStopId = String(finalStopContainer.stop?.id || finalStopContainer.stop?.stop_id || null);
            if (finalStopId && finalStopId !== 'null') {
                patternStopFinalCache[patternId] = finalStopId; // Guarda na cache para uso futuro
                return finalStopId;
            }
        }
    } catch (err) {
        console.error(`Erro ao processar pattern ${patternId}:`, err);
    }
    return null;
}

/**
 * Função auxiliar para obter patterns da cache de forma síncrona
 */
async function getpatternIdsForStop(stopId) {
    return stopPatternCache[String(stopId)] || [];
}

/**
 * Função utilitária para pausar a execução (evitar spam na API externa)
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Processa os dados de uma única paragem (chegadas + filtragem de destino final)
 */
async function fetchSingleStopData(currentStopId) {
    try {
        const apiResponse = await fetch(`${CMET_API_BASE}${CMET_ARRIVALS_API}${currentStopId}`, { timeout: 8000 });
        
        if (apiResponse.status === 429) return { stopId: currentStopId, error: 'Limite de pedidos excedido.' };
        if (!apiResponse.ok) return { stopId: currentStopId, error: `Erro API: ${apiResponse.status}` };

        const data = await apiResponse.json(); // Chegadas em tempo real
        const allStopPatterns = await getpatternIdsForStop(currentStopId); // Patterns que passam nesta paragem
        
        // Resolve em paralelo os IDs das paragens finais de todos os patterns desta paragem
        const finalStopResults = await Promise.all(allStopPatterns.map(pid => getFinalStopId(pid)));

        const finalStopMap = {};
        allStopPatterns.forEach((pid, index) => {
            if (finalStopResults[index]) finalStopMap[pid] = finalStopResults[index];
        });

        // FILTRAGEM: Remove autocarros cujo destino final é a própria paragem atual (já chegaram ao fim)
        const filteredArrivals = data.filter(arrival => {
            const finalStopId = finalStopMap[arrival.pattern_id];
            return finalStopId ? String(finalStopId) !== currentStopId : true;
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
    if (!stopCacheLoaded) await loadStopNames(); // Segurança: garante cache carregada
    
    const { stopIds } = req.body; // IDs enviados pelo utilizador
    if (!Array.isArray(stopIds) || stopIds.length === 0) {
        return res.status(400).json({ error: 'IDs inválidos.' });
    }

    const CONCURRENCY_LIMIT = 5;        // Máximo de pedidos simultâneos
    const DELAY_BETWEEN_BATCHES = 200;  // Pausa entre lotes de 5 pedidos
    const results = [];

    try {
        // Loop que processa as paragens em lotes (batching) para respeitar a API da CM
        for (let i = 0; i < stopIds.length; i += CONCURRENCY_LIMIT) {
            const chunk = stopIds.slice(i, i + CONCURRENCY_LIMIT);
            const chunkResults = await Promise.all(chunk.map(id => fetchSingleStopData(String(id))));
            results.push(...chunkResults);
            if (i + CONCURRENCY_LIMIT < stopIds.length) await sleep(DELAY_BETWEEN_BATCHES);
        }

        // Mapeamento final: injeta nomes de paragens e detalhes técnicos dos veículos nos resultados
        const finalResults = results.map(result => {
            if (result.data) {
                result.stopName = stopNameCache[result.stopId] || `Paragem Inexistente`;
                result.data = result.data.map(arrival => ({
                    ...arrival,
                    vehicleDetails: vehicleCache[arrival.vehicle_id] || null // Busca detalhes na cache de veículos
                }));
            }
            return result;
        });

        res.json(finalResults); // Envia a resposta final para o frontend
    } catch (error) {
        res.status(500).json({ error: 'Erro interno do servidor.' });
    }
});

// Serve a página principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'www', 'mbst_cmet.html'));
});

// Inicialização do Servidor
app.listen(PORT, () => {
    console.log(`Servidor ativo em http://localhost:${PORT}`);
    
    // EXECUÇÃO NO ARRANQUE: Carrega as caches assim que o servidor liga
    loadStopNames()
        .then(() => updateVehicleCache()) // Depois das paragens, carrega os veículos
        .then(() => {
            // Define o ciclo de atualização da frota a cada 60 segundos
            setInterval(updateVehicleCache, 60000);
        })
        .catch(err => console.error("Erro na inicialização:", err));
});