# Atlas de Cartas (Card Atlas)

Módulo para **Foundry VTT v13 e v14**: um mapa de exploração feito de cartas viradas para baixo. O grupo anda como um só, e as cartas giram revelando o terreno. O mestre vê tudo, monta o mapa como quiser e os jogadores têm na mão as **opções de viagem de Fabula Ultima**, que o mestre também pode editar.

- Cartas com animação de virar (3D), som, mesa inclinada, zoom e arrasto.
- Ficha do grupo andando de carta em carta, com rastro dos lugares visitados.
- **Teste de Viagem** de Fabula Ultima por dia de viagem (LB p. 106-109): dado pela maior ameaça do dia (d6 a d20), perigo com 6+, descoberta com 1, poderes do Andarilho (Viajante Experiente, Caçador de Tesouros, Prático).
- Mão de opções de viagem: Descansar, Usar item de inventário (PI), Reabastecer PI, Serviços de viagem, Novo lugar no mapa (1 PF) e, opcionais, Explorar os arredores (regra da casa), Cartografia e Atividades de acampamento (Atlas Natural Fantasy).
- **Gerador de mapas** com 5 temas, tamanhos, ponto de partida à escolha e um código que recria o mesmo mapa.
- **Teste de Viagem** automático, pelo mestre ou pelos **jogadores**, com integração opcional com o módulo **Lookfar**.
- **Token do grupo** personalizável: 6 tokens prontos, imagem própria ou o token de um ator.
- **Mana latente:** áreas energizadas por um elemento (ar, raio, trevas, terra, fogo, gelo, luz, veneno), com efeitos animados.
- Biblioteca de terrenos (19 prontos, com arte própria) e opções 100% editáveis. Mapas exportam e importam em JSON.
- Português (Brasil) e inglês.

## Instalar

**Pelo manifesto:** no Foundry, *Módulos → Instalar módulo*, cole no campo *URL do manifesto*:

```
https://github.com/rickpigeon/VoicesofcardsVisual/releases/latest/download/module.json
```

**À mão:** copie a pasta inteira para `Data/modules/card-atlas/` (o nome da pasta precisa ser `card-atlas`, o id do módulo), reinicie o Foundry e ative **Atlas de Cartas** em *Configurações → Gerenciar módulos*.

## Publicar uma versão (mantenedor)

Repositório: [rickpigeon/VoicesofcardsVisual](https://github.com/rickpigeon/VoicesofcardsVisual). O workflow `.github/workflows/release.yml` monta o pacote sozinho.

1. Primeiro envio, na pasta do módulo:
   ```bash
   git init
   git add .
   git commit -m "Atlas de Cartas 1.0.0"
   git branch -M main
   git remote add origin https://github.com/rickpigeon/VoicesofcardsVisual.git
   git push -u origin main
   ```
2. No GitHub, crie um **Release** com a tag `v1.0.0` e publique. O workflow grava a versão da tag no `module.json` e anexa `module.json` e `module.zip` ao release.
3. Nas versões seguintes, suba `version` no `module.json`, anote no `CHANGELOG.md` e publique um release com a tag nova (`v1.0.1`, `v1.1.0`...).

O envio de arquivos pelo site do GitHub ignora pastas que começam com ponto, como `.github`. Sem essa pasta não há workflow, e então os arquivos `module.json` e `module.zip` precisam ser anexados ao release à mão. O release também não pode estar marcado como *pre-release*, porque o link `releases/latest` ignora pré-lançamentos.

## Como usar

### Mestre

1. Abra pelo botão de **mapa** nos controles de token (barra da esquerda).
2. **Novo mapa** abre uma janela com três opções:
   - **Gerar mapa:** escolha tema e tamanho; a prévia mostra o mapa antes de criar (veja *Gerar mapas* abaixo).
   - **Mapa de exemplo:** um mapa 16 × 10 pronto, com aldeia, estrada, floresta, rio, mar, masmorra e tesouro.
   - **Em branco:** colunas, linhas e um terreno para preencher tudo.
3. **Mostrar aos jogadores** torna esse mapa o mapa ativo e abre a janela para eles.

Ferramentas da barra:

| Ferramenta | O que faz |
|---|---|
| Andar | Move o grupo como os jogadores (conta a viagem). |
| Selecionar | Clique numa carta para editar no painel lateral: terreno, virada ou não, nome, imagem própria, ameaça, se dá para atravessar, mensagem ao chegar, documento ligado (arraste um diário, cena ou ator) e nota do mestre. |
| Pintar | Escolha um terreno na paleta e arraste sobre as cartas. "Sem carta" deixa o espaço vazio. A segunda linha da paleta pinta **mana latente** (veja abaixo). |
| Virar/ocultar | Clique ou arraste para virar cartas para cima ou para baixo. |
| Posicionar o grupo | Coloca o grupo em qualquer carta, sem gastar viagem. |
| Olho | Alterna entre ver as cartas ocultas (com véu listrado) e ver como os jogadores veem. |

Também na barra: virar todas, ocultar todas, **rolar Teste de Viagem** (encerra o dia), parar/liberar o grupo, zerar a viagem, biblioteca de terrenos, opções de viagem, configurar, exportar, importar e excluir mapa.

**Configurar mapa:** tamanho, inclinação da mesa, verso das cartas, **token do grupo**, quantas cartas viram ao redor do grupo, diagonais, cartas por dia de viagem, **quem rola o Teste de Viagem**, rolar pelo Lookfar, perigo parando o grupo, quem vê o teste, tabelas de perigos e descobertas (arraste uma tabela) e os poderes de Andarilho do grupo.

### Jogadores

- Clique numa carta **vizinha** ao grupo (ou use as setas / WASD) para andar. As cartas próximas giram.
- Shift + clique aponta uma carta para todos.
- A **mão de opções** fica embaixo: clique numa carta para usá-la. O resultado vai para o chat.
- Quando o mapa deixa os jogadores rolarem, o botão **Rolar o Teste de Viagem** aparece na linha de status ao fim de cada dia.
- Espaço centraliza no grupo; + e − dão zoom; a rodinha do mouse também.

Por padrão qualquer jogador move o grupo. Em *Configurações do módulo* dá para deixar só o mestre mover.

## Teste de Viagem: quem rola

Em **Configurar mapa → Quem rola o Teste de Viagem**:

| Opção | Como funciona |
|---|---|
| Automático | Ao fim de cada dia o módulo rola sozinho (como antes). |
| O mestre | Ao fim do dia aparece o botão **Rolar** para o mestre; os jogadores veem "o mestre vai rolar". |
| Os jogadores | Ao fim do dia o chat avisa o dado, e qualquer jogador aperta **Rolar** na linha de status. A rolagem sai no chat com o nome do jogador (com Dice So Nice, se houver), e o mestre confere e aplica o resultado. |

Com o mestre ou os jogadores rolando, o grupo só segue viagem depois do teste do dia. O mestre pode rolar sempre, pelo mesmo botão ou pela barra.

## Integração com o Lookfar

O [Lookfar GM Toolkit](https://github.com/slave2midna/lookfar) tem o próprio Teste de Viagem, que gera perigos e descobertas. Com o Lookfar ativo no mundo, marque **Configurar mapa → Rolar pelo Lookfar** e escolha *O mestre* ou *Os jogadores* em *Quem rola*:

1. Ao apertar **Rolar**, abre o Teste de Viagem do Lookfar já com a ameaça do dia marcada e com Viajante Experiente e Caçador de Tesouros copiados do mapa.
2. A rolagem feita no Lookfar vale para o mapa: o dia fecha, o perigo para o grupo, e o resultado aparece na linha de status.
3. O Lookfar gera o perigo ou a descoberta; as tabelas do Atlas não são sorteadas nesse caso.

O Lookfar não tem uma API pública. A integração usa o que ele deixa visível: o hook que abre o diálogo, os campos do diálogo e a mensagem de rolagem no chat. Se uma versão futura do Lookfar mudar isso, desmarque a opção e o mapa volta a usar o próprio teste. A integração foi testada com uma réplica dessas partes do Lookfar (versão de maio de 2026), não com o Lookfar instalado.

## Token do grupo

Em **Configurar mapa → Token do grupo**:

- Seis tokens prontos: Grupo (padrão), Estandarte, Caravana, Navio, Aeronave e Bússola.
- **Imagem própria:** escolha um arquivo, ou **arraste um ator** para a área indicada para usar o token dele (o nome do ator vira o nome sob o token).
- **Moldura:** anel redondo (com a cor que quiser) ou sem moldura, para tokens recortados com fundo transparente.
- **Tamanho** de 50% a 200% e um **nome sob o token** opcional.

## Mana latente

Uma área de mana latente fica energizada por um elemento de Fabula Ultima: **ar, raio, trevas, terra, fogo, gelo, luz ou veneno**. Cada elemento tem um efeito animado próprio sobre a carta: brasas, neve, faíscas, rajadas, pedras, raios de luz, fumaça ou bolhas (cor-de-rosa, no veneno).

- **Pintar:** na ferramenta Pintar, escolha um elemento na linha *Mana latente* e arraste sobre as cartas; o terreno não muda. *Tirar mana* remove.
- **Uma carta:** com Selecionar, escolha a mana no painel lateral. *Só o mestre vê a mana* esconde o efeito dos jogadores (o mestre vê com borda tracejada).
- Os jogadores só veem a mana de cartas viradas para cima. Na primeira vez que o grupo chega a uma carta com mana visível, o chat mostra a mensagem da mana, por padrão "Mana latente de Fogo energiza este lugar."
- O gerador de mapas não cria mana: ela é sempre colocada pelo mestre.

### Mensagem da mana

A mensagem é escolhida do mais específico para o mais geral:

1. **A da carta:** no painel lateral, campo *Mensagem desta mana*. O campo mostra, apagado, o que o chat vai dizer se você deixar em branco.
2. **A do elemento:** em *Configurar mapa → Mana latente → Mensagem por elemento*, uma frase para cada elemento.
3. **A do mapa:** em *Configurar mapa → Mana latente → Mensagem da mana*, uma frase para todos os elementos.
4. **A frase padrão.**

Em qualquer uma delas, `{elemento}` vira o nome do elemento (Fogo, Gelo…) e `{lugar}` vira o nome da carta. Também valem `{element}` e `{place}`. A mensagem pode ter mais de uma linha.

*Avisar a mana no chat*, desmarcado, faz o mapa parar de anunciar a mana. A mensagem ao chegar e o documento ligado da carta continuam saindo. Tirar a mana de uma carta apaga também a mensagem própria dela.

## Idioma

O módulo aparece em **português mesmo com o Foundry em inglês**. Em *Configurações do módulo → Idioma do Atlas de Cartas*, cada usuário pode trocar para *Idioma do Foundry* (recarregue a página depois). Os botões e textos do próprio Foundry, como o seletor de arquivos, seguem o idioma do Foundry.

## Gerar mapas

Em **Novo mapa → Gerar mapa**:

| Tema | Como é |
|---|---|
| Continente | Terra cercada de mar, montanhas, florestas, rios e estradas ligando as aldeias a uma cidade. |
| Arquipélago | Ilhas no mar. Rotas marítimas ligam os portos; essas cartas de mar podem ser atravessadas. |
| Deserto | Areia, oásis, serras rochosas e mais ruínas. |
| Terras geladas | Ermos gelados, florestas de pinheiros e mar frio ao norte. Poucas aldeias. |
| Floresta selvagem | Mata fechada, selva ao sul, pântanos e muitos rios. Poucas aldeias. |

- **Tamanho:** Pequeno (12 × 8), Médio (16 × 10), Grande (22 × 14), Enorme (30 × 18) ou Personalizado (6 a 40 cartas por lado).
- **Código do mapa:** o mesmo código, tema e tamanho geram sempre o mesmo mapa. *Sortear outro* troca o código. Anote o código de um mapa de que gostou para recriá-lo em outro mundo.
- **O que vem no mapa:** cidade, aldeias com nome, estradas, rios, refúgios, masmorras, ruínas e tesouros. Masmorras, ruínas e tesouros já têm uma mensagem de chegada. Todas as aldeias, masmorras e tesouros são alcançáveis a partir do ponto de partida.
- **Início do grupo:** numa aldeia sorteada, na cidade, ou **na carta escolhida**: clique numa carta da prévia. A carta escolhida vira uma aldeia (desmarque *Fundar uma aldeia* para manter o terreno). Se ela cair no mar ou numa ilhota isolada, o início vai para a terra firme mais próxima. No mapa em branco, o clique na prévia também escolhe o início.
- Depois de criado, o mapa é um mapa comum: dá para pintar, renomear, trocar imagens e mover o grupo.

## Regras de Fabula Ultima usadas

| Regra | Onde |
|---|---|
| Dia de Viagem, nível de ameaça (maior do dia), dados d6/d8/d10/d12/d20, perigo com 6+, descoberta com 1 | Livro Básico p. 106-107 |
| Perigos (teste em grupo, série de testes, raramente conflito) e tabela de dano | LB p. 108 |
| Descobertas são sempre boas | LB p. 109 |
| Descanso, barraca mágica, hospitalidade, local seguro, Laços ao fim da cena | LB p. 90-91 |
| Itens de inventário e custos em PI; reabastecer a 10 z por PI | LB p. 104-105 |
| Estalagem 5/10/20 z, serviços de viagem 10/20/40 z | LB p. 124-125 |
| Novo elemento no mapa com Ponto de Fabula | LB p. 98, 108 |
| Andarilho: Caçador de Tesouros, Prático, Viajante Experiente | LB p. 176-177 |
| Cartografia e Atividades de acampamento (opcionais) | Atlas Natural Fantasy p. 130-133 |

Os textos do módulo são resumos com a página citada. Eles não substituem os livros.

## Opções de viagem personalizadas

Em **Opções de viagem** cada carta da mão tem:

- **Ação:** *Anunciar no chat* (só publica), *Teste de Viagem*, *Rolar de novo o último teste*, *Virar cartas ao redor* (valor = raio) ou *Executar macro* (valor = UUID da macro; arraste a macro para o campo).
- **Gasta carta do dia:** conta como uma carta andada no dia de viagem.
- **Escolhas:** uma por linha, no formato `Nome | custo | efeito`. O jogador escolhe uma ao usar a carta.
- **Pergunta ao jogador:** abre um campo de texto (por exemplo, para descrever o lugar novo).
- **Só mestre**, **Confirmar antes** e **Na mão** (ativa ou desativa a carta).

Macros recebem as variáveis `board`, `option`, `choice` e `text`.

## API

```js
game.modules.get("card-atlas").api.open();          // abre a janela
game.modules.get("card-atlas").api.open(boardId);   // mestre: abre num mapa específico
game.modules.get("card-atlas").api.rollTravel(boardId); // o mesmo que o botão Rolar
```

Há também um atalho de teclado configurável em *Configurar controles → Atlas de Cartas*.

## Limitações conhecidas

- Os mapas ficam nas configurações do mundo. Jogadores não conseguem alterá-los, mas um jogador que abrir o console do navegador consegue ler o conteúdo das cartas ocultas.
- Mover o grupo e usar opções que mexem no mapa exige um mestre conectado.
- Se algo falhar, o módulo mostra um aviso vermelho começando com "Atlas de Cartas". Ao relatar um problema, mande um print desse aviso.
- Funciona no Foundry v13 e v14. A única diferença entre as duas está em `scripts/compat.mjs`: quem vê as mensagens (`rollMode` na v13, `messageMode` na v14). A v12 ou anterior não funciona, porque o módulo usa a API de consultas (`CONFIG.queries`) que surgiu na v13.

## Licença

Código e arte sob a licença MIT (veja `LICENSE`). Fabula Ultima é marca da Need Games; este é um módulo de fã, não oficial.
