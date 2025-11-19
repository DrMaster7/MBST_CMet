document.addEventListener('DOMContentLoaded', () => {
    // VARIÁVEIS DE ESCOPO LOCAL
    const form = document.getElementById('stops-form');
    const stopIdsTextarea = document.getElementById('stop-ids');
    const resultsContainer = document.getElementById('results-container');
    const searchButton = document.getElementById('search-button');
    const buttonText = document.getElementById('button-text');
    const loadingSpinner = document.getElementById('loading-spinner');
    const toggleViewButton = document.getElementById('toggle-view-button');

    const REFRESH_INTERVAL = 10000; 
    let refreshTimer = null; 
    let lastSearchStopIds = null; 
    let lastSuccessfulData = null; 

    let currentViewMode = 'individual'; 
    toggleViewButton.textContent = 'Ver Tabela Mestre';

    /**
     * Renderiza os dados de chegadas por paragem individualmente.
     * @param {Array<Object>} results - Array de resultados da API, um para cada paragem.
     * @param {HTMLElement} container - O contentor onde os resultados serão inseridos.
     */
    function renderIndividualResults(results, container) {
        container.innerHTML = ''; 
        toggleViewButton.style.display = (results.length > 0 && results.some(r => r.data && r.data.length > 0)) ? 'inline-block' : 'none'; 

        if (results.length === 0) {
            container.innerHTML = '<p>Nenhuma paragem consultada.</p>';
            return;
        }

        results.forEach(result => {
            const stopId = result.stopId;
            const stopName = result.stopName || `Paragem ${stopId} (Nome Desconhecido)`;
            const stopDiv = document.createElement('div');
            stopDiv.classList.add('stop-arrival');
            
            if (result.error) {
                stopDiv.innerHTML = `
                    <h3>${stopName} (${stopId}) <span class="error-label">ERRO</span></h3>
                    <p class="error-message">${result.error}</p>
                `;
            } else {
                const allArrivals = result.data || [];

                // Filtração e ordenação de todas as chegadas futuras (em tempo real ou calendarizado)
                let futureArrivals = allArrivals.filter(isFutureArrival);
                futureArrivals.sort(compareArrivals);
        
                // Limita o número de resultados às próximas 10 chegadas
                const arrivals = futureArrivals.slice(0, 10);
                
                let arrivalsHtml = '';
                
                if (arrivals.length === 0) {
                    arrivalsHtml = `<p class="no-arrivals">Nenhum autocarro calendarizado nos próximo 60 minutos.</p>`;
                } else {
                    // Estrutura da tabela
                    arrivalsHtml = `
                        <table class="master-arrivals-table individual-table">
                            <thead>
                                <tr>
                                    <th>Linha</th>
                                    <th>Destino</th>
                                    <th>Tempo de Espera</th>
                                    <th>Hora de Passagem</th>
                                    <th>Tipo de Horário</th>
                                </tr>
                            </thead>
                        <tbody>
                    `;

                    arrivals.forEach(arrival => {
                        let waitTime;
                        let arrivalTime;
                        let statusText = '';
                        let statusClass = ''; 
                        const lineNumber = arrival.line_id || '----';
                        const destination = arrival.headsign || arrival.destination || 'Desconhecido';

                        if (arrival.estimated_arrival_unix) { // Caso as chegadas sejam em tempo real
                            const secondsToArrival = Math.max(0, Math.floor((arrival.estimated_arrival_unix * 1000 - Date.now()) / 1000));
                            waitTime = formatWaitTime(secondsToArrival);
                            arrivalTime = formatArrivalTime(arrival.estimated_arrival);
                            
                            let isDelayed = false;
                            let isAhead = false;
                            if (arrival.scheduled_arrival) {
                                const scheduledDate = parseScheduledTime(arrival.scheduled_arrival, true);
                                const estimatedDateTimestamp = arrival.estimated_arrival_unix * 1000;
                                if (estimatedDateTimestamp > scheduledDate + 60000) { 
                                    isDelayed = true;
                                } else if (estimatedDateTimestamp < scheduledDate - 60000) { 
                                    isAhead = true;
                                }
                            }
                            if (isDelayed) {
                                statusText = 'Real (Atrasado)';
                                statusClass = 'status-delayed';
                            } else if (isAhead) {
                                statusText = 'Real (Adiantado)';
                                statusClass = 'status-ahead';
                            } else {
                                statusText = 'Real';
                                statusClass = 'status-realtime';
                            }
                        } else { // Caso as chegadas sejam calendarizadas (não sejam em tempo real)
                            const scheduledTimestamp = parseScheduledTime(arrival.scheduled_arrival, true);
                            const secondsToArrival = Math.max(0, Math.floor((scheduledTimestamp - Date.now()) / 1000));
                            
                            waitTime = formatWaitTime(secondsToArrival);
                            arrivalTime = formatArrivalTime(arrival.scheduled_arrival);
                            statusText = 'Calendarizado';
                            statusClass = 'status-scheduled';
                        }
        
                        arrivalsHtml += `
                            <tr class="${statusClass}">
                                <td>${lineNumber}</td>
                                <td>${destination}</td>
                                <td>${waitTime}</td>
                                <td>${arrivalTime}</td>
                                <td>${statusText}</td>
                            </tr>
                        `;
                    });
                    
                    arrivalsHtml += '</tbody></table>'; 
                }
    
                stopDiv.innerHTML = `
                    <h3>${stopName} (${stopId})</h3>
                    ${arrivalsHtml}
                `;
            }
            
            container.appendChild(stopDiv);
        });
    }

    /**
     * Renderiza os dados de chegadas numa única tabela.
     * @param {Array<Object>} results - Array de resultados da API.
     * @param {HTMLElement} container - O contentor onde os resultados serão inseridos.
     */
    function renderMasterTable(results, container) {
        container.innerHTML = ''; 

        toggleViewButton.style.display = (results.length > 0 && results.some(r => r.data && r.data.length > 0)) ? 'inline-block' : 'none'; 

        let allFutureArrivals = [];
        let hasError = false;

        results.forEach(result => {
            if (result.error) {
                hasError = true;
            } else {
                const stopId = result.stopId;
                const stopName = result.stopName || `Paragem ${stopId} (Nome Desconhecido)`;
                const allArrivals = result.data || [];
                let futureArrivals = allArrivals.filter(isFutureArrival);
                
                futureArrivals = futureArrivals.map(arrival => ({
                    ...arrival,
                    originStopId: stopId,
                    originStopName: stopName
                }));
                
                allFutureArrivals.push(...futureArrivals);
            }
        });

        const masterDiv = document.createElement('div');
        masterDiv.classList.add('stop-arrival');

        // Obtém a lista de IDs consultados
        const stopIdsList = results.map(r => r.stopId).join(', ');
        masterDiv.innerHTML = `<h3>Paragens Consultadas: ${stopIdsList}</h3>`;

        if (hasError) {
            masterDiv.innerHTML += '<p class="error-message">Algumas paragens retornaram erros. Apenas as chegadas válidas são mostradas.</p>';
        }

        if (allFutureArrivals.length === 0) {
            masterDiv.innerHTML += '<p class="no-arrivals">Nenhum autocarro calendarizado em nenhuma das paragens nos próximos 60 minutos.</p>';
            container.appendChild(masterDiv);
            return;
        }

        // Filtração e ordenação de todos os resultados de forma cronológica
        allFutureArrivals.sort(compareArrivals);
        
        // Limita o número de resultados às próximas 10 chegadas
        const arrivalsToShow = allFutureArrivals.slice(0, 10);

        // Estrutura da tabela
        let tableHtml = `
            <table class="master-arrivals-table">
                <thead>
                    <tr>
                        <th>Linha</th>
                        <th>Destino</th>
                        <th>Paragem</th>
                        <th>Tempo de Espera</th>
                        <th>Hora de Passagem</th>
                        <th>Tipo de Horário</th>
                    </tr>
                </thead>
            <tbody>
        `;

        arrivalsToShow.forEach(arrival => {
            let waitTime;
            let arrivalTime;
            let statusText = '';
            let statusClass = ''; 
            const lineNumber = arrival.line_id || '----';
            const destination = arrival.headsign || arrival.destination || 'Desconhecido';

            if (arrival.estimated_arrival_unix) { // Caso as chegadas sejam em tempo real
                const secondsToArrival = Math.max(0, Math.floor((arrival.estimated_arrival_unix * 1000 - Date.now()) / 1000));
                waitTime = formatWaitTime(secondsToArrival);
                arrivalTime = formatArrivalTime(arrival.estimated_arrival);
                
                let isDelayed = false;
                let isAhead = false;
                if (arrival.scheduled_arrival) {
                    const scheduledDate = parseScheduledTime(arrival.scheduled_arrival, true);
                    const estimatedDateTimestamp = arrival.estimated_arrival_unix * 1000;
                    if (estimatedDateTimestamp > scheduledDate + 60000) { 
                        isDelayed = true;
                    } else if (estimatedDateTimestamp < scheduledDate - 60000) { 
                        isAhead = true;
                    }
                }
                if (isDelayed) {
                    statusText = 'Real (Atrasado)';
                    statusClass = 'status-delayed';
                } else if (isAhead) {
                    statusText = 'Real (Adiantado)';
                    statusClass = 'status-ahead';
                } else {
                    statusText = 'Real';
                    statusClass = 'status-realtime';
                }
            } else { // Caso as chegadas sejam calendarizadas (não sejam em tempo real)
                const scheduledTimestamp = parseScheduledTime(arrival.scheduled_arrival, true);
                const secondsToArrival = Math.max(0, Math.floor((scheduledTimestamp - Date.now()) / 1000));
                
                waitTime = formatWaitTime(secondsToArrival);
                arrivalTime = formatArrivalTime(arrival.scheduled_arrival);
                statusText = 'Calendarizado';
                statusClass = 'status-scheduled';
            }
            
            tableHtml += `
                <tr class="${statusClass}">
                    <td>${lineNumber}</td>
                    <td>${destination}</td>
                    <td>${arrival.originStopId}</td>
                    <td>${waitTime}</td>
                    <td>${arrivalTime}</td>
                    <td>${statusText}</td>
                </tr>
            `;
        });

        tableHtml += `
                </tbody>
            </table>
        `;
        
        masterDiv.innerHTML += tableHtml;
        container.appendChild(masterDiv);
    }

    function clearRefreshTimer() {
        if (refreshTimer) {
            clearInterval(refreshTimer);
            refreshTimer = null;
        }
    }

    async function fetchAndRenderArrivals(stopIds, isManualSearch = false) {
        clearRefreshTimer(); 
        lastSearchStopIds = stopIds; 

        if (isManualSearch) {
            searchButton.disabled = true;
            buttonText.style.display = 'none';
            loadingSpinner.style.display = 'inline';
            resultsContainer.innerHTML = '<p>A carregar dados...</p>';
        }

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
                lastSuccessfulData = data; 
                if (currentViewMode === 'master') {
                    renderMasterTable(lastSuccessfulData, resultsContainer);
                } else {
                    renderIndividualResults(lastSuccessfulData, resultsContainer); 
                }
            } else {
                if (isManualSearch) {
                    resultsContainer.innerHTML = `<p class="error-message">Erro na consulta: ${data.error || 'Erro desconhecido no servidor.'}</p>`;
                } else {
                    console.error('Erro no refresh automático:', data.error || 'Erro desconhecido.');
                }
            }
        } catch (error) {
            console.error('Erro ao comunicar com o servidor:', error);
            if (isManualSearch) {
                resultsContainer.innerHTML = '<p class="error-message">Ocorreu um erro ao ligar-se ao servidor (verifique se o Node.js está a correr).</p>';
            }
        } finally {
            if (isManualSearch) {
                searchButton.disabled = false;
                buttonText.style.display = 'inline';
                loadingSpinner.style.display = 'none';
            }
            
            // Recria o timer apenas se tiver IDs válidos para pesquisar.
            if (lastSearchStopIds && lastSearchStopIds.length > 0) {
                refreshTimer = setInterval(() => {
                    console.log('Refresh automático...');
                    // Chama a função novamente, marcando como um refresh automático.
                    fetchAndRenderArrivals(lastSearchStopIds, false); 
                }, REFRESH_INTERVAL);
            }
        }
    }

    function toggleViewMode() {
        if (!lastSuccessfulData) return; 

        if (currentViewMode === 'individual') {
            currentViewMode = 'master';
            toggleViewButton.textContent = 'Ver Tabela por Paragem';
            renderMasterTable(lastSuccessfulData, resultsContainer);
        } else {
            currentViewMode = 'individual';
            toggleViewButton.textContent = 'Ver Tabela Mestra';
            renderIndividualResults(lastSuccessfulData, resultsContainer);
        }
    }
    
    toggleViewButton.addEventListener('click', toggleViewMode);

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const inputRaw = stopIdsTextarea.value.trim();
        if (inputRaw === "") {
            alert("Por favor, introduza pelo menos um ID de paragem.");
            return;
        }

        let stopIds = inputRaw
            .split(',')
            .map(id => id.trim())
            .filter(id => id.length > 0);
        
        stopIds = [...new Set(stopIds)];

        if (stopIds.length === 0) {
            alert("IDs de paragem inválidos. Por favor, verifique o formato.");
            return;
        }

        await fetchAndRenderArrivals(stopIds, true);
    });
});

/**
 * Alerta simples para indicar o que é o ID?
 */
function showID() {
    alert('O ID de uma paragem é a sua identificação da paragem (ex: 020001). No website, está localizada na parte superior da página de x paragem, acima do nome da mesma. No terreno, está localizada na parte inferior direita dos postaletes com a lista de linhas.');
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
    return `${String(minutes).padStart(2, '0')}m ${remainingSeconds > 0 ? String(remainingSeconds).padStart(2, '0') + 's' : ''}`.trim();
}

/**
 * Formata uma string de hora (HH:MM:SS) para HH:MM.
 * @param {string} timeString - Horário de chegada (ex: "05:57:16").
 * @returns {string} - Horário formatado (ex: "05:57").
 */
function formatArrivalTime(timeString) {
    if (typeof timeString === 'string' && timeString.length >= 5) {
        let [hours, minutes] = timeString.substring(0, 5).split(':');
        hours = parseInt(hours);
        if (hours >= 24) {
            hours = hours % 24; // Reduz o valor das horas (24 para 0, 25 para 1, etc.)
        }
        return `${String(hours).padStart(2, '0')}:${minutes}`;
    }
    return '----'; 
}

function isFutureArrival(arrival) {
    let arrivalTimestamp;
    const now = Date.now(); 
    const limitTime = 60 * 60 * 1000; // 60 minutos
    const futureLimit = now + limitTime;

    if (arrival.estimated_arrival_unix) {
        arrivalTimestamp = arrival.estimated_arrival_unix * 1000; 
    } else if (arrival.scheduled_arrival) {
        arrivalTimestamp = parseScheduledTime(arrival.scheduled_arrival, true); 
    } else {
        return false;
    }

    // A chegada tem de ser: Não mais do que 5 segundos no passado (para evitar que seja filtrada no momento da passagem) 
    // e dentro do limite de 60 minutos no futuro (chegadas acima disso não são importantes no momento).
    return arrivalTimestamp > (now - 5000) && arrivalTimestamp <= futureLimit;
}

function compareArrivals(a, b) {
    let timeA = (a.estimated_arrival_unix || 0) * 1000;
    if (timeA === 0 && a.scheduled_arrival) {
        timeA = parseScheduledTime(a.scheduled_arrival, true); 
    }
    
    let timeB = (b.estimated_arrival_unix || 0) * 1000;
    if (timeB === 0 && b.scheduled_arrival) {
        timeB = parseScheduledTime(b.scheduled_arrival, true); 
    }
    
    return timeA - timeB;
}

function parseScheduledTime(timeString, returnTimestamp = false) {
    const now = new Date();

    // Cria uma data de referência para HOJE (meia-noite local)
    const todayReference = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    let [hoursStr, minutesStr, secondsStr] = timeString.split(':');
    
    const originalHours = parseInt(hoursStr, 10);
    const minutes = parseInt(minutesStr, 10);
    const seconds = parseInt(secondsStr || '0', 10);

    // Ajusta as horas para a representação normal de 0-23
    let hours = originalHours % 24; 

    let scheduledDate = new Date(
        todayReference.getFullYear(),
        todayReference.getMonth(),
        todayReference.getDate(),
        hours,
        minutes,
        seconds
    );

    let arrivalTimestamp = scheduledDate.getTime();
    
    // Trata os horários do dia (ex: 10:00:00 às 09:55:00). 
    // Se o horário calculado (após o tratamento das 24h) já tiver passado no dia de hoje, assume-se que é uma partida de amanhã.
    // Usa-se um buffer de 5 minutos (5 * 60 * 1000) para manter o autocarro no ecrã um pouco depois de passar.
    if (arrivalTimestamp < now.getTime() - (5 * 60 * 1000) ) {
        arrivalTimestamp += (24 * 60 * 60 * 1000);
    }

    if (returnTimestamp) return arrivalTimestamp;
    
    return(arrivalTimestamp);
}