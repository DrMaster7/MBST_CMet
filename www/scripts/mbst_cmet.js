// Programação do lado do cliente (frontend), incluindo a automatização e tratamento dos dados recebidos do server.js.
// Client-side programming (frontend), including automating and processing data received from server.js.

document.addEventListener('DOMContentLoaded', () => {
    // VARIÁVEIS DE ESCOPO LOCAL
    const form = document.getElementById('stops-form');
    const stopIdsTextarea = document.getElementById('stop-ids');
    const resultsContainer = document.getElementById('results-container');
    const searchButton = document.getElementById('search-button');
    const buttonText = document.getElementById('button-text');
    const loadingSpinner = document.getElementById('loading-spinner');
    const toggleViewButton = document.getElementById('toggle-view-button');
    const detailsButton = document.getElementById('details-button');
    const mainElement = document.querySelector('main');

    const REFRESH_INTERVAL = 10000; // Intervalo até atualizar (10 segundos)
    const COOKIE_NAME = 'cmet_search'; // Nome do cookie
    const COOKIE_DAYS = 365; // Duração do cookie (1 ano)

    let refreshTimer = null;
    let lastSearchStopIds = null;
    let lastSuccessfulData = null;

    let currentViewMode = 'individual'; 
    toggleViewButton.textContent = 'Ver Tabela Mestre';

    let showDetails = false;
    detailsButton.textContent = 'Mostrar Detalhes';

    /**
     * Lê o cookie encriptado e tenta desencriptar o mesmo. Se for válido, executa e renova.
     */
    const encryptedCookie = getCookie(COOKIE_NAME);
    
    if (encryptedCookie) {
        // Tenta desencriptar o valor do cookie
        const decryptedValue = decryptData(encryptedCookie);

        if (decryptedValue) {
            // Preenche a textarea com os dados legíveis
            stopIdsTextarea.value = decryptedValue;
            
            // Converte a string num array
            const initialStopIds = decryptedValue.split(',').map(id => id.trim()).filter(id => id.length > 0);
            
            if (initialStopIds.length > 0) {
                console.log('Cookie válido encontrado. A renovar validade...');
                
                // Guarda novamente o valor encriptado para estender a data, garantindo o uso da chave atual.
                const newEncryptedValue = encryptData(decryptedValue);
                
                // Renova automaticamente o cookie, de maneira a evitar expiração futura se o utilizador não fizer nenhuma pesquisa nos próximos 365 dias.
                setCookie(COOKIE_NAME, newEncryptedValue, COOKIE_DAYS);

                fetchAndRenderArrivals(initialStopIds, true);
            }
        } else {
            console.warn('Cookie encontrado mas não foi possível desencriptar (pode ser formato antigo ou inválido).');
        }
    }

    /**
     * Renderiza os dados de chegadas por paragem individualmente.
     * @param {Array<Object>} results - Array de resultados da API, um para cada paragem.
     * @param {HTMLElement} container - O contentor onde os resultados serão inseridos.
     */
    function renderIndividualResults(results, container) {
        container.innerHTML = ''; 
        toggleViewButton.style.display = (results.length > 0 && results.some(r => r.data && r.data.length > 0)) ? 'inline-block' : 'none';
        detailsButton.style.display = (results.length > 0 && results.some(r => r.data && r.data.length > 0)) ? 'inline-block' : 'none';

        if (results.length === 0) {
            container.innerHTML = '<p>Nenhuma paragem consultada.</p>';
            return;
        }

        results.forEach(result => {
            const stopId = result.stopId;
            const stopName = result.stopName || `Paragem Inexistente`;
            const stopDiv = document.createElement('div');
            stopDiv.classList.add('stop-arrival');
            
            if (result.error) {
                stopDiv.innerHTML = `
                    <h3>${stopId} | ${stopName}<span class="error-label">ERRO</span></h3>
                    <p class="error-message">${result.error}</p>
                `;
            } else {
                const allArrivals = result.data || [];

                // Filtração e ordenação de todas as chegadas futuras (em tempo real ou calendarizado)
                let futureArrivals = allArrivals.filter(isFutureArrival);
                futureArrivals.sort(compareArrivals);

                
                // Filtração de registos "duplicados" (onde o ID do autocarro e o número da linha forem iguais, indicando ser o mesmo autocarro em locais diferentes)
                const seenVehicles = new Set();
                const uniqueArrivals = [];

                for (const arrival of  futureArrivals) {
                    // Criação de duas chaves de filtro. Se line_id e vehicle_id ou headsign forem iguais entre si, passa a uma das chaves.
                    const vehicleKey1 = arrival.line_id && arrival.vehicle_id ? `v-l:${arrival.line_id}-${arrival.vehicle_id}` : null;
                    const vehicleKey2 = arrival.line_id && arrival.headsign ? `l-h${arrival.line_id}-${arrival.headsign}` : null;

                    // Verifica se alguma das chaves já existe no Set.
                    const isDuplicate = (vehicleKey1 && seenVehicles.has(vehicleKey1)) || (vehicleKey2 && seenVehicles.has(vehicleKey2));

                    if (!isDuplicate) { // Se não for duplicado, adiciona as chaves ao Set para bloquear os próximos
                        if (vehicleKey1) seenVehicles.add(vehicleKey1);
                        if (vehicleKey2) seenVehicles.add(vehicleKey2);
                        uniqueArrivals.push(arrival);
                    }
                }
        
                // Limita o número de resultados às próximas 10 chegadas
                const arrivals = uniqueArrivals.slice(0, 10);
                
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
                                    <th class="col-details">Veículo</th>
                                    <th class="col-details">Modelo</th>
                                    <th class="col-details">Capacidade</th>
                                    <th class="col-details">Tipo de Horário</th>
                                </tr>
                            </thead>
                        <tbody>
                    `;

                    arrivals.forEach(arrival => {
                        let waitTime;
                        let arrivalTime;
                        let secondsLeft;
                        let statusText = '';
                        let statusClass = ''; 
                        const lineNumber = arrival.line_id || '----';
                        const destination = arrival.headsign || '-';
                        const vehicleId = arrival.vehicle_id?.split('|').at(1) ?? '-';
                        const vehicleModel = arrival.vehicleDetails ? arrival.vehicleDetails.make.concat(' ',arrival.vehicleDetails.model) : '-';
                        const vehicleCapacity = arrival.vehicleDetails ? arrival.vehicleDetails.capacity_total : '-';

                        if (arrival.estimated_arrival_unix) { // Caso as chegadas sejam em tempo real
                            const secondsToArrival = Math.max(0, Math.floor((arrival.estimated_arrival_unix * 1000 - Date.now()) / 1000));
                            secondsLeft = Math.max(0, Math.floor((arrival.estimated_arrival_unix * 1000 - Date.now()) / 1000));
                            waitTime = formatWaitTime(secondsToArrival);
                            arrivalTime = formatArrivalTime(arrival.estimated_arrival);
                            
                            let isDelayed = false;
                            let isSemiDelayed = false;
                            let isSemiAhead = false;
                            let isAhead = false;
                            if (arrival.scheduled_arrival) {
                                const scheduledDate = parseScheduledTime(arrival.scheduled_arrival, true);
                                const estimatedDateTimestamp = arrival.estimated_arrival_unix * 1000;
                                const diff = (estimatedDateTimestamp - scheduledDate) / 60000;
                                if (diff > 5) {  // Se estiver mais de 5 minutos atrasados.
                                    isDelayed = true;
                                } else if (diff < -5) {  // Se estiver mais de 5 minutos adiantado.
                                    isAhead = true;
                                } else if (diff >= -5 && diff < -1) { // Se estiver adiantado 1 a 5 minutos.
                                    isSemiAhead = true;
                                } else if (diff > 1 && diff <= 5) { // Se estiver atrasado 1 a 5 minutos.
                                    isSemiDelayed = true;
                                }
                            }
                            if (isDelayed) {
                                statusText = 'Real (Atrasado)';
                                statusClass = 'status-delayed';
                            } else if (isAhead) {
                                statusText = 'Real (Adiantado)';
                                statusClass = 'status-ahead';
                            } else if (isSemiAhead) {
                                statusText = 'Real (Ligeiramente Adiantado)';
                                statusClass = 'status-semi-ahead';
                            } else if (isSemiDelayed) {
                                statusText = 'Real (Ligeiramente Atrasado)';
                                statusClass = 'status-semi-delayed';
                            } else {
                                statusText = 'Real';
                                statusClass = 'status-realtime';
                            }
                        } else { // Caso as chegadas sejam calendarizadas (não sejam em tempo real)
                            const scheduledTimestamp = parseScheduledTime(arrival.scheduled_arrival, true);
                            const secondsToArrival = Math.max(0, Math.floor((scheduledTimestamp - Date.now()) / 1000));

                            secondsLeft = Math.max(0, Math.floor((scheduledTimestamp - Date.now()) / 1000));
                            waitTime = formatWaitTime(secondsToArrival);
                            arrivalTime = formatArrivalTime(arrival.scheduled_arrival);
                            statusText = 'Calendarizado';
                            statusClass = 'status-scheduled';
                        }

                        const arrivingClass = (secondsLeft <= 120) ? 'is-arriving' : '';
            
                        arrivalsHtml += `
                            <tr class="${statusClass} ${arrivingClass}">
                                <td>${lineNumber}</td>
                                <td>${destination}</td>
                                <td>${waitTime}</td>
                                <td>${arrivalTime}</td>
                                <td class="col-details">${vehicleId}</td>
                                <td class="col-details">${vehicleModel}</td>
                                <td class="col-details">${vehicleCapacity}</td>
                                <td class="col-details">${statusText}</td>
                            </tr>
                        `;
                    });
                    
                    arrivalsHtml += '</tbody></table>'; 
                }
    
                stopDiv.innerHTML = `
                    <h3>${stopId} | ${stopName}</h3>
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
        detailsButton.style.display = (results.length > 0 && results.some(r => r.data && r.data.length > 0)) ? 'inline-block' : 'none';

        let allFutureArrivals = [];
        let hasError = false;

        results.forEach(result => {
            if (result.error) {
                hasError = true;
            } else {
                const stopId = result.stopId;
                const stopName = result.stopName || `Paragem Inexistente`;
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

        // Filtração de registos "duplicados" (onde o ID do autocarro e o número da linha forem iguais, indicando ser o mesmo autocarro em locais diferentes)
        const seenVehicles = new Set();
        const uniqueArrivals = [];

        for (const arrival of allFutureArrivals) {
            // Criação de três chaves de filtro. Se vehicle_id, line_id ou headsign forem iguais entre si, passa a uma das chaves.
            const vehicleKey1 = arrival.line_id && arrival.vehicle_id ? `v-l:${arrival.line_id}-${arrival.vehicle_id}` : null;
            const vehicleKey2 = arrival.line_id && arrival.headsign ? `l-h${arrival.line_id}-${arrival.headsign}` : null;

            // Verifica se alguma das chaves já existe no Set.
            const isDuplicate = (vehicleKey1 && seenVehicles.has(vehicleKey1)) || (vehicleKey2 && seenVehicles.has(vehicleKey2));

            if (!isDuplicate) { // Se não for duplicado, adiciona as chaves ao Set para bloquear os próximos
                if (vehicleKey1) seenVehicles.add(vehicleKey1);
                if (vehicleKey2) seenVehicles.add(vehicleKey2);
                uniqueArrivals.push(arrival);
            }
        }

        // Limita o número de resultados às próximas 10 chegadas
        const arrivalsToShow = uniqueArrivals.slice(0, 10);

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
                        <th class="col-details">Veículo</th>
                        <th class="col-details">Modelo</th>
                        <th class="col-details">Capacidade</th>
                        <th class="col-details">Tipo de Horário</th>
                    </tr>
                </thead>
            <tbody>
        `;

        arrivalsToShow.forEach(arrival => {
            let waitTime;
            let secondsLeft = 0;
            let arrivalTime;
            let statusText = '';
            let statusClass = ''; 
            const lineNumber = arrival.line_id || '----';
            const destination = arrival.headsign || '-';
            const vehicleId = arrival.vehicle_id?.split('|').at(1) ?? '-';
            const vehicleModel = arrival.vehicleDetails ? arrival.vehicleDetails.make.concat(' ',arrival.vehicleDetails.model) : '-';
            const vehicleCapacity = arrival.vehicleDetails ? arrival.vehicleDetails.capacity_total : '-';

            if (arrival.estimated_arrival_unix) { // Caso as chegadas sejam em tempo real
                const secondsToArrival = Math.max(0, Math.floor((arrival.estimated_arrival_unix * 1000 - Date.now()) / 1000));
                waitTime = formatWaitTime(secondsToArrival);
                arrivalTime = formatArrivalTime(arrival.estimated_arrival);
                secondsLeft = Math.max(0, Math.floor((arrival.estimated_arrival_unix * 1000 - Date.now()) / 1000));
                
                let isDelayed = false;
                let isSemiDelayed = false;
                let isSemiAhead = false;
                let isAhead = false;
                if (arrival.scheduled_arrival) {
                    const scheduledDate = parseScheduledTime(arrival.scheduled_arrival, true);
                    const estimatedDateTimestamp = arrival.estimated_arrival_unix * 1000;
                    const diff = (estimatedDateTimestamp - scheduledDate) / 60000;
                    if (diff > 5) {  // Se estiver mais de 5 minutos atrasados.
                        isDelayed = true;
                    } else if (diff < -5) {  // Se estiver mais de 5 minutos adiantado.
                        isAhead = true;
                    } else if (diff >= -5 && diff < -1) { // Se estiver adiantado 1 a 5 minutos.
                        isSemiAhead = true;
                    } else if (diff > 1 && diff <= 5) { // Se estiver atrasado 1 a 5 minutos.
                        isSemiDelayed = true;
                    }
                }
                if (isDelayed) {
                    statusText = 'Real (Atrasado)';
                    statusClass = 'status-delayed';
                } else if (isAhead) {
                    statusText = 'Real (Adiantado)';
                    statusClass = 'status-ahead';
                } else if (isSemiAhead) {
                    statusText = 'Real (Ligeiramente Adiantado)';
                    statusClass = 'status-semi-ahead';
                } else if (isSemiDelayed) {
                    statusText = 'Real (Ligeiramente Atrasado)';
                    statusClass = 'status-semi-delayed';
                }  else {
                    statusText = 'Real';
                    statusClass = 'status-realtime';
                }
            } else { // Caso as chegadas sejam calendarizadas
                const scheduledTimestamp = parseScheduledTime(arrival.scheduled_arrival, true);
                const secondsToArrival = Math.max(0, Math.floor((scheduledTimestamp - Date.now()) / 1000));

                secondsLeft = Math.max(0, Math.floor((scheduledTimestamp - Date.now()) / 1000));
                waitTime = formatWaitTime(secondsToArrival);
                arrivalTime = formatArrivalTime(arrival.scheduled_arrival);
                statusText = 'Calendarizado';
                statusClass = 'status-scheduled';
            }

            const arrivingClass = (secondsLeft <= 120) ? 'is-arriving' : '';
            
            tableHtml += `
                <tr class="${statusClass} ${arrivingClass}">
                    <td>${lineNumber}</td>
                    <td>${destination}</td>
                    <td>${arrival.originStopId}</td>
                    <td>${waitTime}</td>
                    <td>${arrivalTime}</td>
                    <td class="col-details">${vehicleId}</td>
                    <td class="col-details">${vehicleModel}</td>
                    <td class="col-details">${vehicleCapacity}</td>
                    <td class="col-details">${statusText}</td>
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
            toggleViewButton.disabled = true;
            detailsButton.disabled = true;
            buttonText.style.display = 'none';
            loadingSpinner.style.display = 'inline';
            resultsContainer.innerHTML = '<p>A carregar dados...</p>';
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        try {
            // Pedido ao servidor proxy (Node.js)
            const response = await fetch('/api/arrivals', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ stopIds: stopIds }),
                signal: controller.signal // Liga o sinal de abortar ao fetch
            });
        
            clearTimeout(timeoutId); // Limpa o timer se a resposta chegar a tempo

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
            if (error.name === 'AbortError') {
                console.error('Tempo limite excedido.');
                if (isManualSearch) {
                    resultsContainer.innerHTML = '<p class="error-message">O servidor demorou muito a responder. Espere uns segundos e tente novamente.</p>';
                }
            } else {
                console.error('Erro ao comunicar com o servidor:', error);
                if (isManualSearch) {
                    resultsContainer.innerHTML = '<p class="error-message">Ocorreu um erro ao ligar-se ao servidor (verifique se o Node.JS está a correr).</p>';
                }
            }
        } finally {
            if (isManualSearch) {
                searchButton.disabled = false;
                toggleViewButton.disabled = false;
                detailsButton.disabled = false;
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
            toggleViewButton.textContent = 'Ver Tabela Mestre';
            renderIndividualResults(lastSuccessfulData, resultsContainer);
        }
    }

    function toggleDetails() {
        showDetails = !showDetails;

        if (showDetails) {
            mainElement.classList.remove('hide-details');
            detailsButton.textContent = 'Esconder Detalhes';
        } else {
            mainElement.classList.add('hide-details');
            detailsButton.textContent = 'Mostrar Detalhes';
        }
    }
    
    toggleViewButton.addEventListener('click', toggleViewMode);
    detailsButton.addEventListener('click', toggleDetails);

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

        // Junta os IDs numa string (ex: "020001, 020003"), encripta e salva
        const idValues = stopIds.join(', ');
        const encryptedValue = encryptData(idValues);
        
        setCookie(COOKIE_NAME, encryptedValue, COOKIE_DAYS);

        await fetchAndRenderArrivals(stopIds, true);
    });
});

/**
 * Alerta simples para indicar o que é o ID
 */
function showID() {
    alert('ID é a identidade de uma paragem (ex: 020001). No site da Carris Metropolitana, está localizada na parte superior da página da paragem, acima do nome. No terreno, está localizada na parte inferior do semi-círculo amarelo dos postaletes. Para mais informações consulte o README, localizado na pasta e no GitHub da aplicação.');
}

/**
 * Define um cookie.
 */
function setCookie(name, value, days) {
    let expires = "";
    if (days) {
        const date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        expires = "; expires=" + date.toUTCString();
    }
    document.cookie = name + "=" + (value || "") + expires + "; path=/; SameSite=Lax";
}

/**
 * Obtém o valor de um cookie.
 */
function getCookie(name) {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for(let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) === ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
}

// Chave definida no topo do ficheiro (ENCRYPTION_KEY)

/**
 * Encripta uma string usando XOR Cipher e Base64.
 * @param {string} data - Texto plano.
 * @returns {string} - Texto cifrado em Base64.
 */
function encryptData(data) {
    const key = 'cmet_key'; // Repetir aqui ou usar a global
    let result = '';
    for (let i = 0; i < data.length; i++) {
        // XOR entre o charCode do dado e o charCode da chave
        result += String.fromCharCode(data.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    // Converte para Base64 para ser seguro guardar no cookie
    return btoa(result);
}

/**
 * Desencripta uma string vinda de Base64 e XOR.
 * @param {string} encryptedData - Texto cifrado em Base64.
 * @returns {string|null} - Texto plano ou null se falhar.
 */
function decryptData(encryptedData) {
    const key = 'cmet_key';
    try {
        // Converte de Base64 de volta para string cifrada
        const stringData = atob(encryptedData);
        let result = '';
        for (let i = 0; i < stringData.length; i++) {
            // XOR reverso (que é igual ao normal)
            result += String.fromCharCode(stringData.charCodeAt(i) ^ key.charCodeAt(i % key.length));
        }
        return result;
    } catch (e) {
        console.error('Falha ao desencriptar dados:', e);
        return null;
    }
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
    
    // Se o horário calculado (após o tratamento das 24h) já tiver passado no dia de hoje, assume-se que é uma partida de amanhã.
    // Usa um buffer de 60 minutos para manter o registo do autocarro no ecrã no dia de hoje no caso de acontecerem atrasos.
    if (arrivalTimestamp < now.getTime() - (60 * 60 * 1000) ) {
        arrivalTimestamp += (24 * 60 * 60 * 1000);
    }

    if (returnTimestamp) return arrivalTimestamp;
    
    return(arrivalTimestamp);
}