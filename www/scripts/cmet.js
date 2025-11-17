document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('stops-form');
    const stopIdsTextarea = document.getElementById('stop-ids');
    const resultsContainer = document.getElementById('results-container');
    const searchButton = document.getElementById('search-button');
    const buttonText = document.getElementById('button-text');
    const loadingSpinner = document.getElementById('loading-spinner');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Processamento dos IDs das paragens
        const inputRaw = stopIdsTextarea.value.trim();
        if (inputRaw === "") {
            alert("Por favor, introduza pelo menos um ID de paragem.");
            return;
        }

        // Separação por vírgulas, remoção de espaços e filtração de IDs vazios
        const stopIds = inputRaw
            .split(',')
            .map(id => id.trim())
            .filter(id => id.length > 0);
        
        if (stopIds.length === 0) {
            alert("IDs de paragem inválidos. Por favor, verifique o formato.");
            return;
        }

        // Mostrar estado de carregamento
        searchButton.disabled = true;
        buttonText.style.display = 'none';
        loadingSpinner.style.display = 'inline';
        resultsContainer.innerHTML = ''; // Limpa resultados anteriores
        resultsContainer.innerHTML = '<p>A carregar dados...</p>';

        try {
            // Pedido ao servidor proxy (Node.js)
            const response = await fetch('/api/arrivals', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ stopIds: stopIds })
            });

            const data = await response.json();

            if (response.ok) {
                // Renderização dos resultados
                renderResults(data, resultsContainer);
            } else {
                // Erro retornado pelo servidor
                resultsContainer.innerHTML = `<p class="error-message">Erro na consulta: ${data.error || 'Erro desconhecido no servidor.'}</p>`;
            }
        } catch (error) {
            console.error('Erro ao comunicar com o servidor:', error);
            resultsContainer.innerHTML = '<p class="error-message">Ocorreu um erro ao ligar-se ao servidor (verifique se o Node.js está a correr).</p>';
        } finally {
            // Restabelecer botão
            searchButton.disabled = false;
            buttonText.style.display = 'inline';
            loadingSpinner.style.display = 'none';
        }
    });
});

/**
 * Alerta para indicar o que é o ID?
 */
function showID() {
    alert('O ID da paragem é a identificação da paragem (ex: 020001). Ela está localizada na parte superior da página que inclui a paragem, acima do nome da mesma.');
}

/**
 * Conversão de segundos para minutos e segundos.
 * @param {number} seconds - Tempo em segundos (ex: "180s" ou "60s").
 * @returns {string} - Tempo formatado (ex: "5m 30s" ou "1m").
 */
function formatWaitTime(seconds) {
    if (seconds <= 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds > 0 ? remainingSeconds + 's' : ''}`.trim();
}

/**
 * Formata uma string de hora (HH:MM:SS) para HH:MM.
 * @param {string} timeString - Horário de chegada (ex: "05:57:16").
 * @returns {string} - Horário formatado (ex: "05:57").
 */
function formatArrivalTime(timeString) {
    if (typeof timeString === 'string' && timeString.length >= 5) {
        return timeString.substring(0, 5); 
    }
    return '---'; 
}

/**
 * Renderiza os dados de chegadas na interface.
 * @param {Array<Object>} results - Array de resultados da API, um para cada paragem.
 * @param {HTMLElement} container - O contentor onde os resultados serão inseridos.
 */
function renderResults(results, container) {
    container.innerHTML = ''; // Limpa o placeholder
    
    if (results.length === 0) {
        container.innerHTML = '<p>Nenhuma paragem consultada.</p>';
        return;
    }

    results.forEach(result => {
        const stopId = result.stopId;
        const stopDiv = document.createElement('div');
        stopDiv.classList.add('stop-arrival');
        
        if (result.error) {
            // Se houver erro para esta paragem
            stopDiv.innerHTML = `
                <h3>Paragem ID ${stopId} <span class="error-label">ERRO</span></h3>
                <p class="error-message">${result.error}</p>
            `;
        } else {
            // Processo de dados de sucesso
            const stopName = result.data.stopName || `(Nome Indisponível)`; // Nome da paragem
            const arrivals = result.data.arrivals || []; // Chegadas
            
            let arrivalsHtml = '';
            // Se não houver nenhum chegada nos próximos minutos
            if (arrivals.length === 0) {
                arrivalsHtml = `<p class="no-arrivals">Nenhum autocarro a chegar nos próximos minutos.</p>`;
            } else {
                arrivalsHtml = '<ul>';
                arrivals.forEach(arrival => {
                // 'headsign' ou 'destination' para indicar o destino do autocarro (ex: Fonte da Telha)
                const destination = arrival.headsign || arrival.destination || 'Desconhecido';

                // Tempo de espera (Mm SSs), dando prioridade ao realtimeSeconds (tempo real)
                const waitTime = formatWaitTime(arrival.realtimeSeconds || arrival.scheduledSeconds);

                // Hora de chegada (HH:MM) - prioridade ao estimated_arrival (tempo real)
                const arrivalTime = formatArrivalTime(arrival.estimated_arrival || arrival.scheduled_arrival);
                
                // Display: [Tempo de Espera] ([Hora de Chegada])
                const timeDisplay = `| ${waitTime} <span class="scheduled-time">(${arrivalTime})</span>`;

                arrivalsHtml += `
                    <li>
                        <span class="line-number">${arrival.lineId}</span>
                        &rarr; <span class="destination">${destination}</span> 
                        <span class="wait-time">${timeDisplay}</span>
                    </li>
                `;
                });
                arrivalsHtml += '</ul>'; // Exemplo: 3030 -> Fonte da Telha | 5m 30s (05:57)

                arrivals.forEach(arrival => {
                let waitTime;
                let arrivalTime;
    
                // 'headsign' ou 'destination' para indicar o destino do autocarro (ex: Fonte da Telha)
                const destination = arrival.headsign || arrival.destination || 'Desconhecido';
                const timeDisplay = '';

                // Tentativa de usar os dados em tempo real (estimated_arrival ou realtimeSeconds)
                if (arrival.estimated_arrival || arrival.realtimeSeconds) {
                    // Tempo de espera (em segundos) dos dados em tempo real
                    waitTime = formatWaitTime(arrival.realtimeSeconds || (arrival.estimated_arrival_unix - Date.now() / 1000));
                    // Hora de chegada (HH:MM)
                    arrivalTime = formatArrivalTime(arrival.estimated_arrival);
                    // Display: [Tempo de Espera] ([Hora de Chegada])
                    timeDisplay = `| ${waitTime} <span class="scheduled-time">(${arrivalTime})</span>`;
                } else {
                    // Tempo de espera (em segundos) dos dados calendarizados
                    waitTime = 'Tempo Real Indisponível';
                    // Hora de chegada (HH:MM)
                    arrivalTime = formatArrivalTime(arrival.scheduled_arrival);
                    // Display: [Tempo de Espera] ([Hora de Chegada])
                    timeDisplay = `| ${arrivalTime} (Tempo Real Indisponível)`;
                }
    
                arrivalsHtml += `
                    <li>
                        <span class="line-number">${arrival.lineId}</span>
                        &rarr; <span class="destination">${destination}</span> 
                        <span class="wait-time">${timeDisplay}</span>
                    </li>
                `;
                });
                arrivalsHtml += '</ul>'; // Exemplo: 3030 -> Fonte da Telha | 5m 30s (05:57) [TR] ou | 05:57 [TC]
            }

            stopDiv.innerHTML = `
                <h3>${stopName} (${stopId})</h3>
                ${arrivalsHtml}
            `;
        }
        
        container.appendChild(stopDiv);
    });
}