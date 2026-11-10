# Changelog

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
