# Changelog

## 1.1.0

- **Jogadores rolam o Teste de Viagem.** Nova opção *Quem rola o Teste de Viagem*:
  - **Automático:** como antes.
  - **O mestre.**
  - **Os jogadores:** a rolagem sai no chat com o nome do jogador, e o mestre confere e aplica.
  - **Botão Rolar:** com o mestre ou os jogadores rolando, o botão aparece na linha de status, e o grupo só segue viagem depois do teste do dia.
- **Integração opcional com o Lookfar:**
  - O botão **Rolar** abre o Teste de Viagem do Lookfar já com a ameaça do dia e os poderes de Andarilho.
  - A rolagem do Lookfar fecha o dia no mapa.
  - Funciona só com o Lookfar ativo; sem ele, o mapa usa o próprio teste.
- **Token do grupo novo e personalizável:**
  - **Token padrão:** o novo token Grupo.
  - **Tokens prontos:** Estandarte (o antigo), Caravana, Navio, Aeronave e Bússola.
  - **Imagem própria:** inclusive arrastando um ator.
  - **Aparência:** moldura em anel ou sem moldura, cor do anel, tamanho e nome sob o token.
- **Mana latente:**
  - O mestre marca cartas energizadas por ar, raio, trevas, terra, fogo, gelo, luz ou veneno, com um pincel na paleta ou pelo painel da carta.
  - Cada elemento tem um efeito animado.
  - Há a opção *Só o mestre vê a mana*.
  - A primeira chegada do grupo avisa no chat.
  - O gerador não cria mana.
- **Gerador de mapas: início do grupo.** O grupo pode começar numa aldeia sorteada, na cidade ou na carta clicada na prévia, que pode virar uma aldeia. No mapa em branco, o clique também escolhe o início.
- **Tudo em português:** o módulo carrega o próprio pt-BR mesmo com o Foundry em inglês. A configuração *Idioma do Atlas de Cartas* volta ao idioma do Foundry. Os botões Sim/Não dos diálogos do módulo também saem em português.
- Mapas da 1.0 continuam funcionando: *Rolar sozinho* desligado vira *O mestre*, e uma imagem do grupo já escolhida vira *Imagem própria*.

## 1.0.2

- **Corrigido:** criar um mapa novo falhava com o erro "Cannot set property state". A janela *Novo mapa* usava o nome `state`, que o Foundry reserva para o estado da janela.

## 1.0.1

- **Corrigido:** o botão *Novo mapa* não abria nada em alguns mundos. Agora ele abre uma janela própria, que não depende do diálogo padrão do Foundry.
- **Novo: gerador de mapas.** Cinco temas (Continente, Arquipélago, Deserto, Terras geladas, Floresta selvagem), quatro tamanhos ou tamanho personalizado, prévia ao vivo e um código que recria sempre o mesmo mapa. Cada mapa traz cidade, aldeias com nome, estradas, rios, refúgios, masmorras, ruínas e tesouros com texto de chegada; no arquipélago, rotas marítimas ligam as ilhas.
- Erros do módulo aparecem na tela como aviso vermelho, e não só no console do navegador.
- Os botões da janela do mapa são acionados pelo próprio módulo.
- Os diálogos da mão de opções passam o conteúdo como texto, formato aceito em todas as versões v13 e v14.
- A biblioteca de terrenos e as opções de viagem são gravadas como `{ list: [...] }`. O formato da 1.0.0 continua sendo lido.

## 1.0.0

- Primeira versão: mapa de cartas viradas para baixo, grupo único, cartas que giram ao revelar.
- Ferramentas do mestre: andar, selecionar/editar carta, pintar terreno, virar/ocultar, posicionar o grupo, ver como jogador.
- Teste de Viagem de Fabula Ultima (LB p. 106-109) por dia de viagem, com Viajante Experiente, Caçador de Tesouros e Prático.
- Mão de opções de viagem para os jogadores (descanso, inventário, PI, serviços, novo lugar com PF, regras opcionais).
- Biblioteca de terrenos e opções editáveis, exportação/importação de mapas em JSON, pt-BR e inglês.
- Compatível com Foundry v13 e v14 (visibilidade das mensagens tratada em `scripts/compat.mjs`).
