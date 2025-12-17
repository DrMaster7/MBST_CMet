# Multiple Bus Stop Tracker (Carris Metropolitana)

### O que é esta aplicação? (🇵🇹)
Esta aplicação é um rastreador de múltiplas paragens de autocarro (do inglês **Multiple Bus Stop Tracker** (MBST)) para a rede da Carris Metropolitana. Recorrendo à API da Carris Metropolitana, esta aplicação retorna os dados recebidos pela API, que inclui as chegadas dos autocarros, as paragens e os patterns das linhas da Carris Metropolitana, podendo retornar apenas uma ou múltiplas paragens ao mesmo tempo, em poucos cliques.

---

### Porquê? (🇵🇹)
Apesar de a Carris Metropolitana já ter desenvolvido um sistema de paragens inteligente que permite ao utilizador verificar em quanto tempo o autocarro chega (seja em tempo real ou calendarizado), ele ainda assim tem alguns pontos fracos, o maior deles sendo o facto de apenas permitir ao utilizador ver apenas uma paragem de cada vez, o que, para alguns locais, como em terminais rodoviários que tenham várias paragens (como o Campo Grande ou a Interface de Transportes de Setúbal), se torna pouco prático.

---

### Tecnologias Usadas (🇵🇹)
- HTML  
- CSS  
- JavaScript (inc. Node.js and Express)

---

### Como? (🇵🇹)
Recorrendo às linguagens HTML, CSS e JavaScript, o sistema está dividido principalmente em 4 ficheiros:
1. **mbst_cmet.html**: A página estática da aplicação
2. **mbst_cmet.css**: Estilização da página HTML com cores e efeitos
3. **server.js**: Responsável pela programação da aplicação na parte do servidor, incluindo a receção e tratamento dos dados recebidos da API da Carris Metropolitana
4. **mbst_cmet.js**: Responsável pela programação da aplicação na parte do cliente, incluindo a automatização dos dados recebidos do server.js

---

### Perguntas (🇵🇹):
**"Por que usar os IDs das paragens para pesquisar as paragens em vez de usar os nomes destas?"**
- **1. Os IDs são valores mais estáveis do que os nomes**

    Um utilizador que está mais atento aos detalhes das paragens à sua volta (seja no terreno, seja no [website](https://carrismetropolitana.pt)) conseguirá perceber que algumas paragens mudaram os seus nomes desde o início da operação da Carris Metropolitana (como [esta](https://carrismetropolitana.pt/stops/100234) (poderá ver isso no tutorial de utilização)). Caso a aplicação utilizasse os nomes para buscar os valores das paragens, algumas destas não iriam funcionar corretamente, enquanto os IDs, apesar de não serem tão importantes para os utilizadores, são mais estáveis para retornar os valores das paragens corretamente.

- **2. Praticidade**
    
    Algumas paragens (como [esta](https://carrismetropolitana.pt/stops/020322)) têm nomes mais complexos e pouco amigáveis para os utilizadores, e recorrendo aos nomes das paragens, o utilizador teria de decorar o nome exato da paragem, algo impraticável para paragens com nomes como **LAZARIM (R S MACÁRIO772)QTA S FRANCISCO"** do que apenas o ID da paragem (neste caso, **020322**). Mesmo que os nomes fossem fáceis de memorizar (como acontece nas redes da Carris ou da MobiCascais), ainda assim seria uma melhor solução usar os IDs das paragens do que os nomes pelo ponto abordado anteriormente.

**"Porque os destinos de duas linhas que terminam no mesmo lugar não tem os nomes iguais (exemplo na imagem abaixo)"**
![alt text](www/images/destinos.png)
- **Carris Metropolitana**
    
    Todos os dados recebidos vem da API da Carris Metropolitana, incluindo os nomes que a mesma dá para os destinos de cada linha. No caso mostrado, onde as linhas 2772 e 2750 tem nomes diferentes para o mesmo destino (Campo Grande), o resultado mostrado vem diretamente dos dados retornados pela API da Carris Metropolitana como mencionado, não sendo portanto algo diretamente da responsabilidade do website.

**"Haverá futuras atualizações?"**
- **Possivelmente**
    
    Apesar de a aplicação atual já cumprir com a ideia principal do projeto em si, ela estará disponível para ter futuras atualizações e evoluções, as quais poderão ser sugeridas [aqui](https://github.com/DrMaster7/MBST_CMet/issues). Pull requests são bem-vindas, entretanto, para alterações significativas, abra primeiro uma issue para discutir o que gostaria que fosse alterado e, no caso de fazer uma pull request, certifique-se de atualizar os testes conforme apropriado, garantindo que a aplicação funcione corretamente sem problemas.

---

### Como Instalar? (🇵🇹)
**NOTA IMPORTANTE:** Antes de instalar a aplicação, é importante que o Git e o Node.js estejam instalados no seu dispositivo, garantindo que a aplicação funcione corretamente sem problemas.

1. Abra o seu terminal (cmd, PowerShell ou Terminal do Visual Studio Code)

2. Baixe os arquivos: ```git clone https://github.com/DrMaster7/MBST_CMet``` (é aqui que o git será necessário)

3. Entre na pasta da aplicação: ```cd MBST_CMet```

4. Instale as dependências: ```npm install``` (é aqui que o Node.js será necessário)

5. Inicie o servidor: ```npm start``` (é aqui que o Node.js será necessário)

6. Aceda ao website: ```http://localhost:(PORTA INDICADA NO TERMINAL)```

Pronto, a aplicação estará pronta a ser usada.

---

### Como Utilizar? (🇵🇹)
**NOTA:** Para exemplificar, as seguintes paragens serão usadas no decorrer de toda a aplicação:
- Av Dr José Pontes Fte 5 (030461), na Reboleira (Amadora)
- Av 25 Abril 87 (Jardim Radial) (110319), no Jardim da Radial (Odivelas)
- CORROIOS(R CID ALMADA) FARMACIA MERCADO (140690), em Corroios (Seixal)
- SETÚBAL (AV BENTO GONÇ)CENTRO COMERCIAL
(160066), em Setúbal

---

1. Entrando no website, irá deparar-se com este menu:
    
    ![alt text](www/images/menu.png)
    
    **Figura 1:** Menu do website

    No menu irá deparar-se com uma caixa de texto, onde o utilizador irá introduzir os IDs das paragens que desejar. De notar que, quantas mais paragens serem pedidas, mais tempo o pedido poderá retornar resultados. Como já referido, os IDs das paragens serão os valores bases para utilizar no website. Caso o utilizador esteja em dúvida o que seria o ID de uma paragem:
    
    - No terreno estão localizados no canto inferior do semi-círculo amarelo dos postaletes, com uma nomenclatura normalmente de "COD. (ID da paragem)". **Esse é o valor que o utilizador precisa para o website**, como já explicado.
    
        ![alt text](www/images/id_terreno.png)

        **Figura 2:** Postalete em Corroios, com identificação do ID (foto tirada a 22 de Novembro de 2025)

    - No site da Carris Metropolitana, ele é mais fácil de localizar. Bastará ir a https://carrismetropolitana.pt/stops, localizar a sua paragem e verificar a localização do ID (como na figura abaixo), clicando nele que o valor é copiado automaticamente.

        ![alt text](www/images/id_website.png)

        **Figura 3:** Página da paragem da Figura 2 no site da Carris Metropolitana.

    Caso o utilizador já tenho feita uma pesquisa anteriormente, os dados serão guardados automaticamente numa cookie que guarda os IDs das paragens, garantindo assim que o utilizador não tenha de voltar a escrever os IDs sempre que tenha de reentrar no website.

---

2. Após pesquisar as paragens, irão aparecer as paragens mais abaixo na página com este formato:

    ![alt text](www/images/tabela_individual.png)
    **Figura 4.1:** Exemplo de uma tabela individual

    ![alt text](www/images/tabela_individual_detalhes.png)
    **Figura 4.2:** Exemplo de uma tabela individual com os detalhes adicionais

    A tabela em si é fácil de entender: Mostra a paragem pesquisada, a linha que o autocarro servirá essa paragem com o seu destino, o tempo de espera que o utilizador irá ter até o autocarro chegar na hora prevista de passagem e o veículo a fazer esse horário.

    A única coisa não tão direta é o tipo de horário, mas será também simples de entender. Pela Carris Metropolitana utilizar o tempo real nos seus autocarros, fica mais preciso detetar quando um autocarro chega a uma paragem, podendo o utilizador se antecipar previamente se um autocarro está adiantado, a horas ou atrasado.

    Para facilitar a visualização desses tipos de horários, foram utilizadas cores, havendo 4 cores possíveis (todas para cada tipo de horário):

    - **Ciano:** Horário em tempo real, com o autocarro estando adiantado pelo menos 1 minuto relativamente ao horário calendarizado.
    
    - **Verde:** Horário em tempo real, com o autocarro estando no tempo certo relativamente ao horário calendarizado.

    - **Vermelho:** Horário em tempo real, com o autocarro estando atrasado pelo menos 1 relativamente minuto ao horário calendarizado.

    - **Branco:** Horário em tempo calendarizado, tempo real inexistente (normalmente aplicável em terminais de linha, como em Cacilhas ou no Campo Grande).

    No exemplo que vemos, a linha 4426 está adiantada relativamente ao horário calendarizado, a linha 4412 está atrasada relativamente ao horário calendarizado, enquanto as linhas 4406 e 4437 estão no tempo certo relativamente ao horário calendarizado.
    
    Todas as restantes linhas (a branco), ou ainda não começaram os seus serviços, tem o tempo real desativado/com erro ou começam nessa paragem (neste caso, nenhuma das três paragens é ponto terminal para uma linha, excluindo a última possibilidade).

    De notar que as tabelas irão apenas mostrar os próximos 10 horários que estejam nos próximos 60 minutos. Caso nenhum resultado seja detetado, não irá retornar horários.

    Outra opção importante é o botão "Mostrar/Esconder Detalhes". Ela permite que o utilizador mostre/oculte alguns detalhes (tipo de horário e veículo). Esta inclusão é principalmente feita para os telemóveis, de forma a que a aplicação funcione sem que o utilizador tenha de deslocar-se horizontalmente no telemóvel para ver a aplicação, e também para aqueles utilizadores que queiram uma utilização mais simples e apenas saber os próximos horários a chegar.

---

3. Também irá reparar que após pesquisar as paragens, irá aparecer um botão ao lado com a legenda "Tabela Mestre". É aqui que o website irá permitir que você possa juntar as várias paragens pesquisadas numa única tabela, como mostrado abaixo:

    ![alt text](www/images/tabela_mestre.png)
    **Figura 5.1:** Exemplo de uma tabela mestre

    ![alt text](www/images/tabela_mestre_detalhes.png)
    **Figura 5.2:** Exemplo de uma tabela mestre com detalhes

    O sistema deste tipo de tabela é igual ao das tabelas individuais, excetuando o facto dos nomes não serem incluídos e a coluna "paragem", que apenas indica o ID da paragem a que esse horário está associado.

---

### What is this application? (🇬🇧)
This application is a multiple bus stop tracker (MBST) for the Carris Metropolitana network. Using the Carris Metropolitana API, this application returns the data received by the API, which includes bus arrivals, stops, and patterns for Carris Metropolitana lines. It can return just one or multiple stops at the same time, in just a few clicks.

---

### Why? (🇬🇧)
Although Carris Metropolitana has already developed a smart stop system that allows users to check how long it will take for the bus to arrive (either in real time or scheduled), it still has some shortcomings, the biggest of which is that it only allows users to view one stop at a time, which for some locations, such as bus terminals with multiple stops (such as Campo Grande or the Setúbal Transport Interface), is impractical.

---

### Technologies Used (🇬🇧)
- HTML  
- CSS  
- JavaScript (inc. Node.js and Express)

---

### How? (🇬🇧)
Using HTML, CSS, and JavaScript, the system is mainly divided into four files:
1. **mbst_cmet.html**: The application's static page
2. **mbst_cmet.css**: Styling of the HTML page with colors and effects
3. **server.js**: Responsible for programming the application on the server side, including receiving and processing data from the Carris Metropolitana API
4. **mbst_cmet.js**: Responsible for programming the application on the client side, including automating the data received from server.js

---

### Questions (🇬🇧):
**“Why use stop IDs to search for stops instead of using their names?”**
- **1. IDs are more stable values than names**

    A user who pays closer attention to the details of the stops around them (whether on the ground or on the [website](https://carrismetropolitana.pt)) will notice that some stops have changed their names since Carris Metropolitana began operating (such as [this one](https://carrismetropolitana.pt/stops/162007)). If the application used names to search for stop values, some of these would not work correctly, while IDs, although not as important to users, are more stable for returning stop values correctly.

- **2. Practicality**
    
    Some stops (such as [this one](https://carrismetropolitana.pt/stops/020322)) have more complex names that are not very user-friendly, and when using stop names, the user would have to memorize the exact name of the stop, which is impractical for stops with names such as **LAZARIM (R S MACÁRIO772)QTA S FRANCISCO"** than just the stop ID (in this case, **020322**). Even if the names were easy to remember (as is the case with the Carris or MobiCascais networks), it would still be a better solution to use stop IDs than names for the reason discussed before.

**“Why do two lines that end at the same place not have the same names (example in the image below)?”**
![alt text](www/images/destinos.png)
- **Carris Metropolitana**
    
    All data received comes from the Carris Metropolitana API, including the names it gives to the destinations of each line. In the case shown, where lines 2772 and 2750 have different names for the same destination (Campo Grande), the result shown comes directly from the data returned by the Carris Metropolitana API as mentioned, and is therefore not the direct responsibility of the website.

**“Will there be future updates?”**
- **Possibly**
    
    Although the current application already fulfills the main idea of the project itself, it will be available for future updates and developments, which can be suggested [here](https://github.com/DrMaster7/MBST_CMet/issues). Pull requests are welcome, however, for significant changes, first open an issue to discuss what you would like to change, and if you make a pull request, be sure to update the tests as appropriate, ensuring that the application works correctly without problems.

---

### How to Install? (🇬🇧)
**IMPORTANT NOTE:** Before installing the application, it is important that Git and Node.js are installed on your device, ensuring that the application works correctly without problems.

1. Open your terminal (cmd, PowerShell, or Visual Studio Code Terminal).

2. Download the files: ```git clone https://github.com/DrMaster7/MBST_CMet``` (this is where git will be needed).

3. Enter the application folder: ```cd MBST_CMet```

4. Install the dependencies: ```npm install``` (this is where Node.js will be needed)

5. Run the server: ```npm start``` (this is where Node.js will be needed)

6. Access the website: ```http://localhost:(PORT INDICATED IN THE TERMINAL)```

That's it, the application is ready to use.

---

### How to use it? (🇬🇧)
**NOTE:** For illustrative purposes, the following stops will be used throughout the application:
- Av Dr José Pontes Fte 5 (030461), in Reboleira (Amadora)
- Av 25 Abril 87 (Jardim Radial) (110319), in Jardim da Radial (Odivelas)
- CORROIOS(R CID ALMADA) FARMACIA MERCADO (140690), in Corroios (Seixal)
- SETÚBAL (AV BENTO GONÇ)CENTRO COMERCIAL
(160066), in Setúbal

---

1. When you enter the website, you will see this menu:
    
    ![alt text](www/images/menu.png)
    
    **Figure 1:** Website menu

    In the menu, you will see a text box where you can enter the IDs of the stops you want. Please note that the more stops you request, the longer it will take for the request to return results. As mentioned above, the stop IDs will be the base values to use on the website. If you are unsure what a stop ID is:
    
    - On the ground, they are located at the bottom corner of the yellow semi-circle of the bus stops, usually labelled "COD. (Stop ID)". **This is the value that the user needs for the website**, as already explained.
    
        ![alt text](www/images/id_terreno.png)

        **Figure 2:** Stop in Corroios, with ID identification (photo taken at 22 November 2025)

    - On the Carris Metropolitana website, it is easier to find. Simply go to https://carrismetropolitana.pt/stops, locate your stop and check the location of the ID (as in the figure below), clicking on it to automatically copy the value.

        ![alt text](www/images/id_website.png)

        **Figure 3:** Page for the stop in Figure 2 on the Carris Metropolitana website.

    If the user has already performed a search previously, the data will be automatically stored in a cookie that saves the stop IDs, thus ensuring that the user does not have to re-enter the IDs each time they return to the website.

---

2. After searching for stops, the stops will appear further down the page in this format:

    ![alt text](www/images/tabela_individual.png)
    **Figure 4.1:** Example of an individual table

    ![alt text](www/images/tabela_individual_detalhes.png)
    **Figure 4.2:** Example of an individual table with the additional details

    The table itself is easy to understand: it shows the stop searched, the line that the bus will serve that stop with its destination, the waiting time that the user will have until the bus arrives at the scheduled time and the vehicle doing that schedule.

    The only thing that is not so straightforward is the type of timetable, but it is also simple to understand. Because Carris Metropolitana uses real time on its buses, it is more accurate to detect when a bus arrives at a stop, allowing the user to anticipate in advance if a bus is early, on time or late.

    To make it easier to view these types of timetables, colours were used, with four possible colours (all for each type of timetable):

    - **Cyan:** Real-time timetable, with the bus running at least one minute ahead of schedule.
    
    - **Green:** Real-time schedule, with the bus running on time relative to the scheduled timetable.

    - **Red:** Real-time schedule, with the bus at least 1 minute behind the scheduled timetable.

    - **White:** Scheduled timetable, no real-time data available (usually applicable at terminal stops, such as Cacilhas or Campo Grande).

    In the example we see, line 4426 is ahead of schedule, line 4412 is behind schedule, while lines 4406 and 4437 are on time.

    All other lines (in white) have either not yet started their services, have real time disabled/with an error, or start at that stop (in this case, none of the three stops are the terminal point for a line, excluding the last possibility).

    Please note that the tables will only show the next 10 schedules that are within the next 60 minutes. If no results are found, no schedules will be returned.

    Another important option is the "Show/Hide Details" button. It allows the user to show/hide certain details (such as timetable and vehicle type). This feature is mainly intended for mobile phones, so that the application works without the user having to scroll horizontally on their phone to view the application, and also for those users who want a simpler experience and just want to know the next arrival times.


---

3. You will also notice that after searching for stops, a button will appear next to them with the label "Master Table". This is where the website will allow you to combine the various stops searched into a single table, as shown below:

    ![alt text](www/images/tabela_mestre.png)
    **Figure 5.1:** Example of a master table

    ![alt text](www/images/tabela_mestre_detalhes.png)
    **Figure 5.2:** Example of a master table with details

    The system for this type of table is the same as for individual tables, except that names are not included and the ‘stop’ column only indicates the ID of the stop to which that timetable is associated.
