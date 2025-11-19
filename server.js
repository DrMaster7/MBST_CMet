// Carrega as variáveis do arquivo .env para o process.env
require('dotenv').config();

const express = require('express');
const fetch = require('node-fetch');
const path = require('path');
const app = express();

// Usa a variável de ambiente OU a string hardcoded como fallback (caso o .env falhe)
const CMET_API_BASE = process.env.CMET_API_BASE || 'https://api.carrismetropolitana.pt/'; // Link base da API
const CMET_ARRIVALS_API = 'v2/arrivals/by_stop/' // API que retorna as chegadas por paragem
const CMET_STOPS_API = 'v2/stops'; // API que retorna as paragens
const CMET_PATTERNS_API = 'patterns/'; // API para retornar as patterns de linha
const PORT = process.env.PORT || 8081;

// Middleware para servir ficheiros estáticos da pasta 'www'
app.use(express.static(path.join(__dirname, 'www')));
app.use(express.json());

let stopNameCache = {}; // Caching para os nomes das paragens { "stopId": "Nome da Paragem" }
let patternStopFinalCache = {}; // Caching para o ID da última paragem de um pattern { "patternId": "stopIdFinal" }
let stopPatternCache = {}; // Caching para os pattern IDs de uma paragem { "stopId": ["patternId1", "patternId2"] }
let cacheLoaded = false;

/**
 * Função para buscar e popular a cache de nomes de paragens
 */
async function loadStopNames() {
    if (cacheLoaded) return;
    console.log('A carregar nomes de paragens da API...');
    try {
        const response = await fetch(`${CMET_API_BASE}${CMET_STOPS_API}`);
        if (response.ok) {
            const data = await response.json();
            stopNameCache = data.reduce((acc, stop) => {
                acc[stop.id] = stop.long_name;
                if (stop.pattern_ids && stop.pattern_ids.length > 0) {
                    stopPatternCache[stop.id] = stop.pattern_ids.map(String);
                }
                return acc;
            }, {});
            cacheLoaded = true;
            console.log(`Cache de paragens carregada com ${Object.keys(stopNameCache).length} entradas.`);
        } else {
            console.error('Erro ao carregar a API de paragens:', response.status);
        }
    } catch (error) {
        console.error('Erro de rede ao carregar a API de paragens:', error);
    }
}

/**
 * Busca o ID da paragem final para um determinado Pattern ID.
 * @param {string} patternId - O ID do pattern de rota (ex: 2708_0_1).
 * @returns {Promise<string|null>} - O stop_id da última paragem ou null em caso de erro/invalidez.
 */
async function getFinalStopId(patternId) {
    if (!patternId) return null;
    if (patternStopFinalCache[patternId]) return patternStopFinalCache[patternId];

    try {
        const response = await fetch(`${CMET_API_BASE}${CMET_PATTERNS_API}${patternId}`);
        if (!response.ok) {
            console.warn(`Pattern API falhou para ${patternId}: Status ${response.status} - ${response.statusText}`);
            return null; // Retorna null para sinalizar falha na API
        }
        const patternData = await response.json();
        const patternPath = patternData.path;

        if (Array.isArray(patternPath) && patternPath.length > 0) {
            const finalStopContainer = patternPath[patternPath.length - 1];
            // Tenta obter o ID, priorizando 'id' ou 'stop_id' do objeto da paragem
            const finalStopId = String(finalStopContainer.stop?.id || finalStopContainer.stop?.stop_id || null);
            if (finalStopId && finalStopId !== 'null') {
                patternStopFinalCache[patternId] = finalStopId;
                return finalStopId;
            } else {
                console.warn(`Não foi possível extrair o finalStopId para o pattern ${patternId}. Último objeto de paragem:`, finalStopContainer.stop);
            }
        } else {
             // Retornou o objeto de metadados, mas sem a lista de paragens ('path' está vazio ou não existe).
            console.warn(`Pattern API para ${patternId} retornou dados vazios ou inválidos (sem 'path' ou 'path' vazio):`, patternData);
        }
    } catch (err) {
        console.error(`Erro ao processar pattern ${patternId}:`, err);
    }
    return null;
}

/**
 * Obtém os patternIds para uma paragem, recorrendo à cache ou à API. Prioriza a cache populada em 'loadStopNames' ou tenta o endpoint específico /stops/{id}.
 * @param {string} stopId - O ID da paragem.
 * @returns {Promise<Array<string>>} - Lista de pattern IDs.
 */
let allStopsDetailsCache = null;
async function getpatternIdsForStop(stopId) {
    if (!stopId) return [];
    const key = String(stopId);

    // Prioriza a cache específica da paragem (populada anteriormente)
    if (stopPatternCache[key]) return stopPatternCache[key];

    // Se não estiver na cache específica, verifica se a cache geral foi populada
    if (allStopsDetailsCache === null) {
        try {
            const response = await fetch(`${CMET_API_BASE}${CMET_STOPS_API}`); // Chamada da API
            if (response.ok) {
                // Assume-se que a API devolve um array ou objeto que contém todos os detalhes
                allStopsDetailsCache = await response.json();
            } else {
                // Em caso de falha na chamada, preenche cache geral como vazia para evitar novas chamadas.
                allStopsDetailsCache = {}; 
            }
        } catch (err) {
            // Em caso de erro de rede, preenche cache geral como vazia
            allStopsDetailsCache = {};
        }
    }

    // Procura os detalhes da paragem no resultado da API (allStopsDetailsCache)
    // Assume-se que a cache é um Array de objetos ou um Objeto onde a chave é o Stop ID.

    let stopDetails = null;

    if (Array.isArray(allStopsDetailsCache)) {
        // Exemplo: A API devolve um Array. Procuramos pelo stopId.
        stopDetails = allStopsDetailsCache.find(stop => String(stop.id) === key || String(stop.stopId) === key);
    } else if (typeof allStopsDetailsCache === 'object' && allStopsDetailsCache !== null) {
        // Exemplo: A API devolve um Objeto (Map/Dictionary) onde a chave é o ID.
        stopDetails = allStopsDetailsCache[key]; 
        
        // Se a API tiver uma chave específica (ex: 'stops') que contém o Map/Array.
        // if (allStopsDetailsCache.stops && allStopsDetailsCache.stops[key]) {
        //     stopDetails = allStopsDetailsCache.stops[key];
        // }
    }
    // Extrai os pattern IDs e preenche a cache específica.
    if (stopDetails) {
        const patterns = stopDetails.pattern_ids || stopDetails.patterns || [];
        if (Array.isArray(patterns) && patterns.length > 0) {
            const patternsString = patterns.map(String);
            stopPatternCache[key] = patternsString;
            return patternsString;
        }
    }
    // Se não for encontrado na cache específica ou na cache geral, marca como vazio na cache específica para evitar repetição (Fail-fast).
    if (!stopPatternCache[key]) {
        stopPatternCache[key] = []; 
    }
    return stopPatternCache[key];
}


// Rota de proxy para a API da Carris Metropolitana
app.post('/api/arrivals', async (req, res) => {
    if (!cacheLoaded) await loadStopNames();
    
    const { stopIds } = req.body;

    // Se nenhum ID for fornecido
    if (!Array.isArray(stopIds) || stopIds.length === 0) {
        return res.status(400).json({ error: 'Nenhum ID de paragem fornecido.' });
    }

    try {
        const results = [];
        
        for (const id of stopIds) {
            const currentStopId = String(id);
            const apiResponse = await fetch(`${CMET_API_BASE}${CMET_ARRIVALS_API}${currentStopId}`);
            
            if (!apiResponse.ok) {
                results.push({ stopId: currentStopId, error: `Erro ao obter dados para o ID ${currentStopId}. Código: ${apiResponse.status}` });
                continue;
            }

            const data = await apiResponse.json();
            const allStopPatterns = await getpatternIdsForStop(currentStopId); // patterns da paragem
            
            // Pré-resolve finalStopId para todos os patterns da paragem (paralelamente para eficiência)
            const finalStopPromises = allStopPatterns.map(pid => getFinalStopId(pid));
            const finalStopResults = await Promise.all(finalStopPromises);

            const finalStopMap = {};
            allStopPatterns.forEach((pid, index) => {
                const finalId = finalStopResults[index];
                if (finalId) {
                    finalStopMap[pid] = finalId;
                }
            });
            const filteredArrivals = data.filter(arrival => {
                const patternId = arrival.pattern_id;
                const finalStopId = finalStopMap[patternId]; // Stop ID da última paragem do pattern
        
                if (finalStopId) {
                    const isFinalStop = String(finalStopId) === currentStopId;
                    // Se for a paragem final, filtramos (return false).
                    if (isFinalStop) {
                        return false; 
                    }
                    return true; // true se NÃO for a paragem final (mantém a chegada)
                }
                return true; // Fallback: Mantém se o destino final não for conhecido por segurança
            });
            results.push({ stopId: currentStopId, data: filteredArrivals });
        }

        const finalResults = results.map(result => {
            if (result.data) {
                result.stopName = stopNameCache[result.stopId] || `Nome Desconhecido / Paragem ${result.stopId}`;
            }
            return result;
        });
        
        res.json(finalResults);

    } catch (error) {
        console.error('Erro no proxy da API da Carris Metropolitana:', error);
        res.status(500).json({ error: 'Erro interno do servidor ao comunicar com a API externa.' });
    }
});

// Início do servidor
app.listen(PORT, () => {
    console.log(`Servidor a correr na porta ${PORT}. Para iniciar, visite http://localhost:${PORT}`);
});