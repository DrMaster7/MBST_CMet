// Programação do lado do cliente (frontend), incluindo a automatização e tratamento dos dados recebidos do server.js.
// Client-side programming (frontend), including automating and processing data received from server.js.

// --- Variáveis Globais ---
let refreshTimer = null;            // Timer do setInterval
let lastSearchStopIds = null;       // Últimos IDs pesquisados para atualizações automáticas
let lastSuccessfulData = null;      // Últimos dados da API guardados com sucesso
let currentViewMode = 'individual'; // Modo de exibição da tabela ('individual' ou 'master')
let showDetails = false;            // Estado de visibilidade das colunas com detalhes técnicos

// --- Constantes de Configuração (CONFIG) ---
const CONFIG = {
    REFRESH_INTERVAL: 10000,        // Tempo de atualização automática (10 segundos)
    COOKIE_NAME: 'cmet_search',     // Nome do cookie (cmet_search)
    COOKIE_DAYS: 365,               // Tempo de vida do cookie (1 ano)
    ENCRYPTION_KEY: 'cmet_key',     // Nome da chave de encriptação do cookie
    API_ENDPOINT: '/api/arrivals'   // Valores recebidos das chegadas da API
};    

document.addEventListener('DOMContentLoaded', () => {
    // Captura de elementos do DOM (Document Object Model)
    const form = document.getElementById('stops-form');                     // Formulário de pesquisa.
    const stopIdsTextarea = document.getElementById('stop-ids');            // Campo de texto das paragens.
    const resultsContainer = document.getElementById('results-container');  // Contentor dos resultados.
    const toggleViewButton = document.getElementById('toggle-view-button'); // Botão de exibição da tabela ('individual' ou 'master').
    const detailsButton = document.getElementById('details-button');        // Botão das colunas com detalhes técnicos.
    const mainElement = document.querySelector('main');                     // Elemento para as classes CSS.

    // Inicialização do texto dos botões na interface
    toggleViewButton.textContent = 'Ver Tabela Mestre';
    detailsButton.textContent = 'Mostrar Detalhes';

    // Gestão de Cookies e Carregamento Automático
    const encryptedCookie = getCookie(CONFIG.COOKIE_NAME); // Tenta ler o cookie guardado

    // Se o cookie estiver encriptado.
    if (encryptedCookie) {
        const decryptedValue = decryptData(encryptedCookie); // Desencripta o valor do cookie
        // Se o valor do cookie estiver desencriptado.
        if (decryptedValue) {
            stopIdsTextarea.value = decryptedValue; // Preenche o campo de texto com as paragens
            // Converte a string do cookie num array limpo de IDs
            const initialStopIds = decryptedValue.split(',').map(id => id.trim()).filter(id => id.length > 0);
            //Se a string do cookie não estiver vazia
            if (initialStopIds.length > 0) {
                setCookie(CONFIG.COOKIE_NAME, encryptData(decryptedValue), CONFIG.COOKIE_DAYS); // Renova a validade do cookie
                fetchAndRenderArrivals(initialStopIds, true); // Executa a primeira pesquisa automática
            }
        }
    }

    // EventListener para a mudança da tabela entre o modo 'individual' e 'master'
    toggleViewButton.addEventListener('click', () => {
        // Se existirem dados carregados, atua.
        if (!lastSuccessfulData) return;
        // Alterna o estado entre 'individual' e 'master'
        currentViewMode = (currentViewMode === 'individual') ? 'master' : 'individual';
        // Atualiza o texto do botão pelo próximo estado disponível
        toggleViewButton.textContent = (currentViewMode === 'individual') ? 'Ver Tabela Mestre' : 'Ver Tabela por Paragem';
        renderArrivals(lastSuccessfulData, resultsContainer, currentViewMode); // Re-renderiza a tabela
    });

    // EventListener para mostrar ou esconder colunas de detalhes (Veículo, Modelo, etc.)
    detailsButton.addEventListener('click', () => {
        showDetails = !showDetails; // Inverte o estado booleano
        mainElement.classList.toggle('hide-details', !showDetails); // Adapta as classes do CSS no main
        // Atualiza o texto do botão pelo próximo estado disponível
        detailsButton.textContent = showDetails ? 'Esconder Detalhes' : 'Mostrar Detalhes';
    });

    // Ouvinte de submissão do formulário de pesquisa
    form.addEventListener('submit', async (e) => {
        e.preventDefault(); // Impede o recarregamento da página
        const inputRaw = stopIdsTextarea.value.trim(); // Obtém o valor do input sem espaços extras
        if (!inputRaw) return alert("Por favor, introduza IDs de paragem."); // Validação básica

        // Cria array de IDs únicos, removendo espaços e IDs vazios
        let stopIds = [...new Set(inputRaw.split(',').map(id => id.trim()).filter(id => id.length > 0))];
        if (stopIds.length === 0) return alert("IDs inválidos.");

        setCookie(CONFIG.COOKIE_NAME, encryptData(stopIds.join(', ')), CONFIG.COOKIE_DAYS); // Guarda a pesquisa encriptada
        await fetchAndRenderArrivals(stopIds, true); // Chama a função de busca
    });
});

// Procura os dados na API e gere o estado da interface (loading, botões, erros, etc.)
async function fetchAndRenderArrivals(stopIds, isManualSearch = false) {
    const resultsContainer = document.getElementById('results-container');
    const searchButton = document.getElementById('search-button');
    const toggleViewButton = document.getElementById('toggle-view-button');
    const detailsButton = document.getElementById('details-button');
    const loadingSpinner = document.getElementById('loading-spinner');
    const buttonText = document.getElementById('button-text');

    if (refreshTimer) clearInterval(refreshTimer); // Para o timer atual antes de começar um novo
    lastSearchStopIds = stopIds; // Atualiza a referência da última pesquisa

    // Se for pesquisa manual, mostra o estado de carregamento (spinner)
    if (isManualSearch) {
        searchButton.disabled = true; // Desativa os 3 botões para evitar múltiplos cliques
        toggleViewButton.disabled = true;
        detailsButton.disabled = true;
        buttonText.style.display = 'none'; // Esconde o texto do botão
        loadingSpinner.style.display = 'inline'; // Mostra o círculo de loading
        resultsContainer.innerHTML = '<p>A carregar dados...</p>';
    }

    try {
        // Faz o pedido POST à API local do servidor
        const response = await fetch(CONFIG.API_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ stopIds })
        });

        const data = await response.json(); // Converte a resposta para JSON

        if (response.ok) {
            lastSuccessfulData = data; // Armazena os dados para uso futuro (ex: trocar vista)
            data.forEach(r => {
                if (r.data) r.data.forEach(a => {
                    a._ts = a.estimated_arrival_unix ? a.estimated_arrival_unix * 1000 : parseScheduledTime(a.scheduled_arrival, true);
                });
            });
            lastSuccessfulData = data; 
            renderArrivals(data, resultsContainer, currentViewMode); // Desenha a tabela com os resultados dos últimos dados recebidos
        } else if (isManualSearch) {
            resultsContainer.innerHTML = `<p class="error-message">Erro: ${data.error}</p>`; // Retorna a mensagem de erro dos dados
        }
    } catch (error) {
        if (isManualSearch) resultsContainer.innerHTML = `<p class="error-message">Erro de ligação à API.</p>`;
    } finally {
        // Restaura a interface após o carregamento (sucesso ou erro)
        if (isManualSearch) {
            searchButton.disabled = false; // Ativa os 3 botões novamente
            toggleViewButton.disabled = false;
            detailsButton.disabled = false;
            buttonText.style.display = 'inline'; // Mostra o texto do botão
            loadingSpinner.style.display = 'none'; // Esconde o círculos de loading
        }
        // Define o intervalo para a próxima atualização automática
        refreshTimer = setInterval(() => fetchAndRenderArrivals(lastSearchStopIds, false), CONFIG.REFRESH_INTERVAL);
    }
}

// Organiza os dados recebidos em grupos e renderiza-os na tabela.
function renderArrivals(results, container, mode) {
    container.innerHTML = ''; // Limpa o contentor de resultados

    // Verifica se existem dados válidos em qualquer uma das paragens consultadas
    const hasData = results.length > 0 && results.some(r => r.data?.length > 0);
    
    // Mostra ou esconde botões de controlo baseando-se na existência de dados
    document.getElementById('toggle-view-button').style.display = hasData ? 'inline-block' : 'none';
    document.getElementById('details-button').style.display = hasData ? 'inline-block' : 'none';

    // Se nenhuma paragem for consultada.
    if (results.length === 0) {
        container.innerHTML = '<p>Nenhuma paragem consultada.</p>';
        return;
    }

    let groups = []; // Array que conterá os blocos de informação a desenhar

    if (mode === 'master') { // Se o modo da tabela no modo 'master'
        let allArrivals = []; // Acumulador para todas as chegadas de todas as paragens
        let hasError = false;
        results.forEach(r => {
            if (r.error) hasError = true;
            // Filtra chegadas futuras e injeta o ID da paragem de origem em cada objeto de chegada
            else allArrivals.push(...(r.data || []).filter(isFutureArrival).map(a => ({...a, originStopId: r.stopId})));
        });
        // No modo 'master', cria um grupo com todos os dados das paragens pesquisadas
        groups.push({ title: `Paragens Consultadas: ${results.map(r => r.stopId).join(', ')}`, arrivals: allArrivals, error: hasError });
    } else { // Se o modo da tabela no modo 'individual'
        // No modo individual, cria um grupo por cada paragem pesquisada
        results.forEach(r => groups.push({ 
            title: `${r.stopId} | ${r.stopName || 'Paragem Inexistente'}`, 
            arrivals: (r.data || []).filter(isFutureArrival), 
            error: r.error 
        }));
    }

    // Iteração sobre os grupos criados para criar o HTML
    groups.forEach(group => {
        const div = document.createElement('div');
        div.className = 'stop-arrival';

        // Gera o cabeçalho do grupo (título e label de erro se necessário)
        let html = `<h3>${group.title}${group.error && mode === 'individual' ? ' <span class="error-label">ERRO</span>' : ''}</h3>`;
        
        // Se houver erro no modo individual, mostra a mensagem de erro
        if (group.error && mode === 'individual') html += `<p class="error-message">${group.error}</p>`;
        
        // Ordena, remove resultados duplicados e limita os mesmos a 10 resultados (para utilizarem-se na função processArrivals)
        const processed = processArrivals(group.arrivals);

        // Se após o processamento não houver dados, mostra aviso de não haver chegadas (caso contrário cria a tabela)
        html += (processed.length === 0) ? `<p class="no-arrivals">Nenhum autocarro calendarizado nos próximos 60 minutos.</p>` 
        : generateTableHtml(processed, mode);

        div.innerHTML = html;
        container.appendChild(div); // Adiciona o bloco ao DOM
    });
}

// Cria a estrutura de tabela HTML para um conjunto de chegadas (o campo "Paragem" apenas existe no modo 'master' da tabela)
function generateTableHtml(arrivals, mode) {
    let html = `
    <table class="master-arrivals-table ${mode === 'individual' ? 'individual-table' : ''}">
        <thead>
            <tr>
                <th>Linha</th>
                <th>Destino</th>
                ${mode === 'master' ? '<th>Paragem</th>' : ''}
                <th>Faltam</th>
                <th>Partida</th>
                <th class="col-details">Veículo</th>
                <th class="col-details">Modelo</th>
                <th class="col-details">Capacidade</th>
                <th class="col-details">Estado</th>
            </tr>
        </thead>
        <tbody>`;

    arrivals.forEach(a => {
        const status = getArrivalStatus(a); // Obtém os cálculos de tempo e estados visuais
        const arrivingClass = status.secondsLeft <= 120 ? 'is-arriving' : ''; // Constante para indicar se falta <= 2 minutos (para CSS)
        
        // Formata a string do modelo garantindo que todos os resultados "undefined" ou parecido retornem '-'.
        let modelDisplay = '-';
        if (a.vehicleDetails && (a.vehicleDetails.make || a.vehicleDetails.model)) {
            modelDisplay = `${a.vehicleDetails.make || ''} ${a.vehicleDetails.model || ''}`.trim();
        }

        // Constrói a linha (row) da tabela com os dados
        html += `
            <tr class="${status.statusClass} ${arrivingClass}">
                <td>${a.line_id || '----'}</td>
                <td>${a.headsign || '-'}</td>
                ${mode === 'master' ? `<td>${a.originStopId}</td>` : ''} 
                <td>${status.waitTime}</td>
                <td>${status.arrivalTime}</td>
                <td class="col-details">${a.vehicle_id?.split('|').at(1) ?? '-'}</td>
                <td class="col-details">${modelDisplay}</td>
                <td class="col-details">${a.vehicleDetails?.capacity_total || '-'}</td>
                <td class="col-details">${status.statusText}</td>
            </tr>`;
    });
    return html + '</tbody></table>';
}

// Filtra os valores duplicados (veículos ou destinos na mesma linha), ordena cronologicamente e limita os resultados para no máximo 10
function processArrivals(arrivals) {
    arrivals.sort(compareArrivals); // Ordena os resultados cronologicamente
    const seen = new Set(), unique = []; // Auxiliares para remoção de duplicados
    for (const a of arrivals) {
        // Cria chaves únicas baseadas no ID do veículo ou no destino da linha
        const vk1 = a.line_id && a.vehicle_id ? `lv:${a.line_id}-${a.vehicle_id}` : null;
        const vk2 = a.line_id && a.headsign ? `lh:${a.line_id}-${a.headsign}` : null;
        // Se nunca vimos este veículo ou esta linha/destino nesta paragem, adicionamos
        if (!((vk1 && seen.has(vk1)) || (vk2 && seen.has(vk2)))) {
            if (vk1) seen.add(vk1); if (vk2) seen.add(vk2);
            unique.push(a);
        }
    }
    return unique.slice(0, 10); // Retorna apenas os primeiros 10 resultados
}

// Calcula os tempos de espera, horas de chegada e define as classes CSS por tipo de horário
function getArrivalStatus(a) {
    let waitTime, arrivalTime, secondsLeft, statusText, statusClass;
    const now = Date.now();

    // Lógica para os horários em tempo real
    if (a.estimated_arrival_unix) {
        const arrivalMs = a._ts; // Converte segundos unix para milissegundos
        secondsLeft = Math.max(0, Math.floor((arrivalMs - now) / 1000)); // Calcula segundos restantes
        arrivalTime = formatArrivalTime(a.estimated_arrival); // Formata hora HH:MM
        
        const scheduled = parseScheduledTime(a.scheduled_arrival, true); // Obtém timestamp do horário calendarizado
        const diff = (arrivalMs - scheduled) / 60000; // Diferença em minutos entre o tempo real e o tempo calendarizado

        // Define categorias visuais baseadas no desvio do horário (+5 minutos atrasado / adiantado | 1-5 minutos atrasado / adiantado)
        if (diff > 5) { statusText = 'Real (Atrasado)'; statusClass = 'status-delayed'; }
        else if (diff < -5) { statusText = 'Real (Adiantado)'; statusClass = 'status-ahead'; }
        else if (diff > 1 && diff <= 5) { statusText = 'Real (Ligeiramente Atrasado)'; statusClass = 'status-semi-delayed'; }
        else if (diff >= -5 && diff < -1) { statusText = 'Real (Ligeiramente Adiantado)'; statusClass = 'status-semi-ahead'; }
        else { statusText = 'Real'; statusClass = 'status-realtime'; }
        
    } else {
        // Lógica para os horários em tempo calendarizado quando não há dados em tempo real
        const scheduled = a._ts;
        secondsLeft = Math.max(0, Math.floor((scheduled - now) / 1000));
        arrivalTime = formatArrivalTime(a.scheduled_arrival);
        statusClass = 'status-scheduled';
        statusText = 'Calendarizado';
    }

    waitTime = formatWaitTime(secondsLeft); // Formata os segundos para string
    return { waitTime, arrivalTime, secondsLeft, statusText, statusClass };
}

// Formata segundos em "MMm SSs" com padding de zeros
function formatWaitTime(seconds) {
    const minutes = Math.floor(seconds / 60); // Minutos
    const remainingSeconds = seconds % 60; // Segundos restantes

    // Adiciona um zero à esquerda por defeito se o valor de uma das duas constantes for menor que 10 (ex: 09m 03s)
    const mDisplay = String(minutes).padStart(2, '0');
    const sDisplay = String(remainingSeconds).padStart(2, '0');

    // Se tiver menos de 1 minuto, não leva zero à esquerda (ex: 8s)
    if (seconds < 60) {
        return `${seconds}s`;
    }

    return `${mDisplay}m ${sDisplay}s`;
}

// Limpa e formata a string de hora para o padrão HH:MM
function formatArrivalTime(t) {
    if (!t) return '--:--';
    const parts = t.split(':');
    let h = parseInt(parts[0]) % 24; // Garante que as horas retornadas como "24:05" viram "00:05"
    return `${String(h).padStart(2, '0')}:${parts[1]}`;
}

// Verifica se uma chegada é válida (não passou há mais de 5 segundos e está dentro de 1 hora, na eventualidade de atrasos)
function isFutureArrival(a) {
    // Escolhe o timestamp real se existir, caso contrário o planeado
    const t = a._ts;
    return t > (Date.now() - 5000) && t <= (Date.now() + 3600000);
}

// Função de comparação para o método .sort() do JavaScript
function compareArrivals(a, b) {
    return a._ts - b._ts; // Retorna a diferença para ordenar do menor para o maior
}

// Alerta simples para indicar o que é o ID
function showID() {
    alert('ID é a identidade de uma paragem (ex: 020001). No site da Carris Metropolitana, está localizada na parte superior da página da paragem, acima do nome. No terreno, está localizada na parte inferior do semi-círculo amarelo dos postaletes. Para mais informações consulte o README, localizado na pasta e no GitHub da aplicação.');
}

// Converte strings de tempo "HH:MM:SS" em milissegundos Unix, tratando viradas do dia à meia-noite
function parseScheduledTime(ts, retStamp = false) {
    const now = new Date();
    const [h, m, s] = ts.split(':').map(Number);

    // Cria objeto Date para hoje com as horas da paragem
    let date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h % 24, m, s || 0);
    let stamp = date.getTime();

    // Se a hora já passou há muito (ex: autocarro da 01:00, listado às 23:00), assume-se que o horário é de amanhã
    if (stamp < now.getTime() - 3600000) stamp += 86400000;
    return retStamp ? stamp : stamp;
}

// Define um cookie no navegador
function setCookie(n, v, d) {
    const date = new Date();
    date.setTime(date.getTime() + (d * 24 * 60 * 60 * 1000)); // Calcula a data de expiração do cookie
    document.cookie = `${n}=${v}; expires=${date.toUTCString()}; path=/; SameSite=Lax`;
}

// Obtém o valor de um cookie específico pelo nome
function getCookie(n) {
    const name = n + "=";
    const ca = document.cookie.split(';'); // Divide a string de cookies
    for(let c of ca) {
        c = c.trim();
        if (c.indexOf(name) === 0) return c.substring(name.length, c.length);
    }
    return null;
}

// Encripta os dados usando XOR Cipher simples e converte para Base64 (para segurança básica no cookie)
function encryptData(d) {
    return btoa(d.split('').map((c, i) => 
        String.fromCharCode(c.charCodeAt(0) ^ CONFIG.ENCRYPTION_KEY.charCodeAt(i % CONFIG.ENCRYPTION_KEY.length))).join(''));
}

// Desencripta os dados de Base64 e reverte o XOR Cipher
function decryptData(d) {
    try {
        const s = atob(d);
        return s.split('').map((c, i) => 
            String.fromCharCode(c.charCodeAt(0) ^ CONFIG.ENCRYPTION_KEY.charCodeAt(i % CONFIG.ENCRYPTION_KEY.length))).join('');
    } catch { return null; }
}