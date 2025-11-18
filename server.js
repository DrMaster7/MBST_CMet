const express = require('express');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
const CMET_API_BASE = 'https://api.carrismetropolitana.pt/'; // API base
const CMET_ARRIVALS_API = 'v2/arrivals/by_stop/' // API que retorna as chegadas por paragem
const CMET_STOPS_API = 'v2/stops'; // API que retorna as paragens
const CMET_PATTERNS_API = 'patterns/'; // API para retornar as patterns de linha

// Middleware para servir ficheiros estáticos da pasta 'www'
app.use(express.static(path.join(__dirname, 'www')));
app.use(express.json());

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
app.listen(8081, () => {
    console.log('Para iniciar, visite http://localhost:8081');
});