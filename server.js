const express = require('express');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
const CMET_API_BASE = 'https://api.carrismetropolitana.pt/v2/arrivals/by_stop/';

// Middleware para servir ficheiros estáticos da pasta 'www'
app.use(express.static(path.join(__dirname, 'www')));
app.use(express.json());

// Rota de proxy para a API da Carris Metropolitana
app.post('/api/arrivals', async (req, res) => {
    const { stopIds } = req.body; // Espera um array de IDs de paragem

    // Se nenhum ID for fornecido
    if (!Array.isArray(stopIds) || stopIds.length === 0) {
        return res.status(400).json({ error: 'Nenhum ID de paragem fornecido.' });
    }

    try {
        const results = [];
        
        // Faz um pedido para cada ID de paragem
        for (const id of stopIds) {
            const apiResponse = await fetch(`${CMET_API_BASE}${id}`);
            
            // Verifica se a resposta da API é OK
            if (apiResponse.ok) {
                const data = await apiResponse.json();
                results.push({ stopId: id, data: data });
            } else {
                // Se a API retornar um erro para um ID específico
                results.push({ 
                    stopId: id, 
                    error: `Erro ao obter dados para o ID ${id}. Código: ${apiResponse.status}` 
                });
            }
        }

        // Devolve todos os resultados
        res.json(results);

    } catch (error) {
        console.error('Erro no proxy da API da Carris Metropolitana:', error);
        res.status(500).json({ error: 'Erro interno do servidor ao comunicar com a API externa.' });
    }
});

// Início do servidor
app.listen(8081, () => {
    console.log('Para iniciar, visite http://localhost:8081');
});