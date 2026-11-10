# Atlas de Cartas (Card Atlas)

Módulo para **Foundry VTT v13 e v14**: um mapa de exploração feito de cartas viradas para baixo. O grupo anda como um só, e as cartas giram revelando o terreno. O mestre vê tudo, monta o mapa como quiser e os jogadores têm na mão as **opções de viagem de Fabula Ultima**, que o mestre também pode editar.

- Cartas com animação de virar (3D), som, mesa inclinada, zoom e arrasto.
- Ficha do grupo andando de carta em carta, com rastro dos lugares visitados.
- **Teste de Viagem** de Fabula Ultima por dia de viagem (LB p. 106-109): dado pela maior ameaça do dia (d6 a d20), perigo com 6+, descoberta com 1, poderes do Andarilho (Viajante Experiente, Caçador de Tesouros, Prático).
- Mão de opções de viagem: Descansar, Usar item de inventário (PI), Reabastecer PI, Serviços de viagem, Novo lugar no mapa (1 PF) e, opcionais, Explorar os arredores (regra da casa), Cartografia e Atividades de acampamento (Atlas Natural Fantasy).
- **Gerador de mapas** com 5 temas, tamanhos e um código que recria o mesmo mapa.
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
| Pintar | Escolha um terreno na paleta e arraste sobre as cartas. "Sem carta" deixa o espaço vazio. |
| Virar/ocultar | Clique ou arraste para virar cartas para cima ou para baixo. |
| Posicionar o grupo | Coloca o grupo em qualquer carta, sem gastar viagem. |
| Olho | Alterna entre ver as cartas ocultas (com véu listrado) e ver como os jogadores veem. |

Também na barra: virar todas, ocultar todas, **rolar Teste de Viagem** (encerra o dia), parar/liberar o grupo, zerar a viagem, biblioteca de terrenos, opções de viagem, configurar, exportar, importar e excluir mapa.

**Configurar mapa:** tamanho, inclinação da mesa, imagem do grupo, verso das cartas, quantas cartas viram ao redor do grupo, diagonais, cartas por dia de viagem, rolagem automática, perigo parando o grupo, quem vê o teste, tabelas de perigos e descobertas (arraste uma tabela) e os poderes de Andarilho do grupo.

### Jogadores

- Clique numa carta **vizinha** ao grupo (ou use as setas / WASD) para andar. As cartas próximas giram.
- Shift + clique aponta uma carta para todos.
- A **mão de opções** fica embaixo: clique numa carta para usá-la. O resultado vai para o chat.
- Espaço centraliza no grupo; + e − dão zoom; a rodinha do mouse também.

Por padrão qualquer jogador move o grupo. Em *Configurações do módulo* dá para deixar só o mestre mover.

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
- **O que vem no mapa:** cidade, aldeias com nome, estradas, rios, refúgios, masmorras, ruínas e tesouros. Masmorras, ruínas e tesouros já têm uma mensagem de chegada. O grupo começa numa aldeia, e todas as aldeias, masmorras e tesouros são alcançáveis a partir dela.
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
```

Há também um atalho de teclado configurável em *Configurar controles → Atlas de Cartas*.

## Limitações conhecidas

- Os mapas ficam nas configurações do mundo. Jogadores não conseguem alterá-los, mas um jogador que abrir o console do navegador consegue ler o conteúdo das cartas ocultas.
- Mover o grupo e usar opções que mexem no mapa exige um mestre conectado.
- Se algo falhar, o módulo mostra um aviso vermelho começando com "Atlas de Cartas". Ao relatar um problema, mande um print desse aviso.
- Funciona no Foundry v13 e v14. A única diferença entre as duas está em `scripts/compat.mjs`: quem vê as mensagens (`rollMode` na v13, `messageMode` na v14). A v12 ou anterior não funciona, porque o módulo usa a API de consultas (`CONFIG.queries`) que surgiu na v13.

## Licença

Código e arte sob a licença MIT (veja `LICENSE`). Fabula Ultima é marca da Need Games; este é um módulo de fã, não oficial.
