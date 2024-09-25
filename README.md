# ftfspy
um pequeno bot que detecta atualizações e atividades em um ou mais jogos do roblox (configurado para o [Flee The Facility](https://www.roblox.com/games/893973440/Flee-the-Facility) e sua versão de testes, [INDEV](https://www.roblox.com/games/455327877/FTF-In-Dev)) e envia detecções por uma webhook do discord
## como funciona
o bot executa detecções a cada 2 minutos, verificando atualizações e atividades em jogos usando diversas APIs do roblox, qualquer mudança ou atividade detectada é enviada por uma webhook do discord (localizada no arquivo `.env`)

o bot também inclui uma interface feita em HTML, podendo ser acessada por um navegador usando `localhost:3000`, ou o endereço IP do seu dispositivo seguido pela porta `3000`, lá você pode ver detalhes mais profundos do bot (tempo de execução, quantidade de detecções executadas, etc.)
> por essa interface, é possível executar uma detecção independente simplesmente clicando no `run check` ou fazendo um GET request na path `/check`, que retorna as informações atualizadas após a execução
## como usar
- insira sua webhook e token nas strings `webhook` e `token` no arquivo `.env`
- baixe as dependências com `npm i`
- inicie com `node .` ou `npm start`
## como modificar
> [!WARNING]
> recomendado para aqueles que saibam o que estão fazendo e que gostariam de fazer modificações, ou para aqueles que buscam informações mais profundas sobre como o bot funciona
1. `index.js`:

o principal script responsável pelo funcionamento do bot, executa as detecções e retorna informações, ele segue essa estrutura:
```
função principal/main
├── primeiro GET para https://games.roblox.com/v1/games, verifica o primeiro jogo, atualmente configurado para o INDEV
|   ├── verifica atualizações
|   |   └── caso detectado, atualiza e envia informações à webhook 
|   └── verifica atividade
|       └── caso detectado atividade elevada ou já existente, verifica por mudanças
|           └── caso detectado mudanças, atualiza e envia informações à webhook 
└── segundo GET para https://games.roblox.com/v1/games, verifica o segundo jogo, atualmente configurado para o Flee The Facility
|   └── verifica atualizações
|       └── caso detectado, atualiza e envia informações à webhook
└── POST para https://presence.roblox.com/v1/presence/users, verifica o status do desenvolvedor do jogo, atualmente configurado para o MrWindy
|   └── caso alguma mudança seja detectada, atualiza e envia informações à webhook
└── define 2 minutos para repetir detecção (caso não seja execução independente)
```
2. `public/testers.json`:

informações sobre aqueles que possuem acesso ao INDEV e que podem ser detectados em atividades, segue esse formato:
```json
{
    "data": [
        {
            "id": "ID DO USUÁRIO",
            "img": "URL DE IMAGEM DO USUÁRIO",
            "name": "NOME DO USUÁRIO"
        }
    ]
}
```
3. `public/index.html`:

a interface do bot, aqui estão alguns detalhes sobre:
- home, logs, last updated, testers: arquivos do bot
  - home: a interface principal do bot
  - logs: arquivo txt de erros e informações do bot
  - last updated: arquivo json que indica as datas das ultimas atualizações detectadas
  - testers: arquivo json que indica os usuários que tem acesso ao INDEV
- checks: quantidade de execução de detecções
- TSII `(Testers Seen In INDEV)`: lista de última atividade detectada, inclui IDs de jogadores caso presente
- last status: último status do desenvolvedor do jogo
- updates: quantidade de atualizações detectadas
- read errors: quantidade erros de leitura, normalmente associados com erros de leitura de informações ou requests mal-feitas
- fetch errors: quantidade de erros de conexão
- message errors: quantidade de erros ao tentar enviar uma mensagem a webhook, normalmente associados com problemas de internet ou muitos requests em pouco tempo
- runtime: tempo em que o bot está no ar
- next check: tempo até a próxima detecção automática
- run check: executa uma detecção independente

<p align="center">
    <img src="https://github.com/user-attachments/assets/a702ab31-2d03-4b0e-8787-75d8d38c368f">
</p>

