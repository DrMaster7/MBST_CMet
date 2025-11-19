# Multiple Bus Stop Tracker (Carris Metropolitana)

### O que é esta aplicação? (🇵🇹)
Esta aplicação é um rastreador de múltiplas paragens de autocarro (do inglês **Multiple Bus Stop Tracker** (MBST)) para a rede da Carris Metropolitana. Recorrendo à API da Carris Metropolitana, esta aplicação retorna os dados recebidos pela API que inclui as chegadas dos autocarros, as paragens e as patterns das linhas da Carris Metropolitana, podendo retornar apenas uma ou múltiplas paragens ao mesmo tempo, em poucos cliques.

### Porquê? (🇵🇹)
Apesar da Carris Metropolitana já ter desenvolvido um sistema de paragens inteligente que permita ao utilizador verificar em quanto tempo o autocarro chega (seja em tempo real ou calendarizado), ele ainda assim recorre de alguns pontos em falta, o maior deles sendo o facto de apenas permitir ao utilizador ver apenas uma paragem de cada vez, o que para alguns locais, como em terminais rodoviários que tenham várias paragens (como o Campo Grande ou a Interface de Transportes de Setúbal), tornar-se pouco prático.

### Tecnologias Usadas (🇵🇹)
- HTML  
- CSS  
- JavaScript  
- Node.js  
- Express

### Como? (🇵🇹)
Recorrendo às linguagens HTML, CSS e JavaScript, o sistema está divido principalmente em 4 ficheiros:
1. **mbst_cmet.html**: A página estática da aplicação
2. **mbst_cmet.css** Estilização da página HTML com cores e efeitos
3. **server.js**: Responsável pela programação da aplicação na parte do servidor, incluindo a receção e tratamente dos dados recebidos da API da Carris Metropolitana
4. **mbst_cmet.js**: Responsável pela programação da aplicação na parte do cliente, incluindo a automatização dos dados recebidos do server.js

### Perguntas (🇵🇹):
**"Porque usar os IDs das paragens para pesquisar as paragens em vez de usar os nomes destas?"**
- **1. Praticidade**
    
    Algumas paragens (como [esta](https://carrismetropolitana.pt/stops/020322)) tem nomes mais complexos e poucos amigáveis para os utilizadores, e recorrendo aos nomes das paragens, o utilizador teria de decorar o nome exato da paragem, algo impraticável para paragens com nome como **LAZARIM (R S MACÁRIO772)QTA S FRANCISCO"** do que apenas o ID da paragem (neste caso, **020322**). Mesmo que os nomes fossem fáceis de memorizar (como acontece nas redes da Carris ou da MobiCascais), ainda assim seria uma melhor solução usar os IDs das paragens do que os nomes pelo ponto abordado a seguir.

- **2. Os IDs são valores mais estáveis do que os nomes**

    Um utilizador que está mais atento aos detalhes das paragens à sua volta (seja no terreno, seja no [website](https://carrismetropolitana.pt)) conseguirá perceber que algumas paragens mudaram os seus nomes desde o início da operação da Carris Metropolitana (como [esta](https://carrismetropolitana.pt/stops/162007)). Caso a aplicação utilizasse os nomes para buscar os valores das paragens, algumas destas não iriam funcionar corretamente, enquanto os IDs, apesar de não serem tão importantes para os utilizadores, são mais estáveis para retornar os valores das paragens corretamente.

**"Haverá futuras atualizações?"**
- **Possivelmente**
    
    Apesar da aplicação atual já cumprir com a ideia principal do projeto em si, ela estará disponível para ter futuras atualizações e evoluções, das quais poderão ser sugeridas [aqui](https://github.com/DrMaster7/MBST_CMet/issues). Pull requests são bem-vindas, entretanto, para alterações significativas, abra primeiro uma issue para discutir o que gostaria que fosse alterado, e caso de fazer uma pull request, certifique-se de atualizar os testes conforme apropriado, garantindo que a aplicação funcione corretamente sem problemas.

### Como Instalar? (🇵🇹)
**NOTA IMPORTANTE:** Antes de instalar a aplicação, é importante que o Git e o Node.js estejam instalados no seu dispositivo, garantindo que a aplicação funcione corretamente sem problemas.

1. Abra o seu terminal (cmd, PowerShell ou Terminal do Visual Studio Code)

2. Baixe os arquivos: ```git clone https://github.com/DrMaster7/MBST_CMet``` (é aqui que o git será necessário)

3. Entre na pasta da aplicação: ```cd MBST_CMet```

4. Instale as dependências: ```npm install``` (é aqui que o Node.js será necessário)

5. Rode o servidor: ```npm start``` (é aqui que o Node.js será necessário)

6. Acesse o servidor: ```http://localhost:(PORTA INDICADA NO TERMINAL)```

Pronto, a aplicação estará pronta a ser usada.

---

### What is this application? (🇬🇧)
This application is a multiple bus stop tracker (MBST) for the Carris Metropolitana network. Using the Carris Metropolitana API, this application returns the data received by the API, which includes bus arrivals, stops, and patterns for Carris Metropolitana lines. It can return just one or multiple stops at the same time, in just a few clicks.

### Why? (🇬🇧)
Although Carris Metropolitana has already developed a smart stop system that allows users to check how long it will take for the bus to arrive (either in real time or scheduled), it still has some shortcomings, the biggest of which is that it only allows users to view one stop at a time, which for some locations, such as bus terminals with multiple stops (such as Campo Grande or the Setúbal Transport Interface), is impractical.

### Technologies Used (🇬🇧)
- HTML  
- CSS  
- JavaScript  
- Node.js  
- Express

### How? (🇬🇧)
Using HTML, CSS, and JavaScript, the system is mainly divided into four files:
1. **mbst_cmet.html**: The application's static page
2. **mbst_cmet.css**: Styling of the HTML page with colors and effects
3. **server.js**: Responsible for programming the application on the server side, including receiving and processing data from the Carris Metropolitana API
4. **mbst_cmet.js**: Responsible for programming the application on the client side, including automating the data received from server.js

### Questions (🇬🇧):
**“Why use stop IDs to search for stops instead of using their names?”**
- **1. Practicality**
    
    Some stops (such as [this one](https://carrismetropolitana.pt/stops/020322)) have more complex names that are not very user-friendly, and when using stop names, the user would have to memorize the exact name of the stop, which is impractical for stops with names such as **LAZARIM (R S MACÁRIO772)QTA S FRANCISCO"** than just the stop ID (in this case, **020322**). Even if the names were easy to remember (as is the case with the Carris or MobiCascais networks), it would still be a better solution to use stop IDs than names for the reason discussed below.

- **2. IDs are more stable values than names**

    A user who pays closer attention to the details of the stops around them (whether on the ground or on the [website](https://carrismetropolitana.pt)) will notice that some stops have changed their names since Carris Metropolitana began operating (such as [this one](https://carrismetropolitana.pt/stops/162007)). If the application used names to search for stop values, some of these would not work correctly, while IDs, although not as important to users, are more stable for returning stop values correctly.

**“Will there be future updates?”**
- **Possibly**
    
    Although the current application already fulfills the main idea of the project itself, it will be available for future updates and developments, which can be suggested [here](https://github.com/DrMaster7/MBST_CMet/issues). Pull requests are welcome, however, for significant changes, first open an issue to discuss what you would like to change, and if you make a pull request, be sure to update the tests as appropriate, ensuring that the application works correctly without problems.

### How to Install? (🇬🇧)
**IMPORTANT NOTE:** Before installing the application, it is important that Git and Node.js are installed on your device, ensuring that the application works correctly without problems.

1. Open your terminal (cmd, PowerShell, or Visual Studio Code Terminal).

2. Download the files: ```git clone https://github.com/DrMaster7/MBST_CMet``` (this is where git will be needed).

3. Enter the application folder: ```cd MBST_CMet```

4. Install the dependencies: ```npm install``` (this is where Node.js will be needed)

5. Run the server: ```npm start``` (this is where Node.js will be needed)

6. Access the server: ```http://localhost:(PORT INDICATED IN THE TERMINAL)```

That's it, the application is ready to use.