# Laboratório Bola de Ouro — contexto do projeto

Objetivo: recriar os algoritmos do vídeo "I know who wins the Ballon d'Or 2026" (Pogorabona), criar um algoritmo próprio, comparar tudo ano a ano num site, e passar a prever a PRÓXIMA Bola de Ouro com dados atualizados automaticamente.
Língua com o utilizador: português de Portugal.

## Estado atual
- data.js: GERADO por gen-data.js a partir de data-src/ (1956–2026, 803 linhas). Campos em comentário no topo. Confiança A/B/C por linha. `cont` (médios/defesas/GR) é estimativa subjetiva.
- models.js: Previsão (no código `hist`; chamava-se "Histórico" até 30/10/2026 — 19 critérios; pesos por ano em selecao-result.json, ajuste único em fit-result.json), Justo (só individual), Meu (individual + crédito de equipa proporcional). Corre em Node e no browser.
- lp3.py (+ dump.js → feats.json): ajuste por programa linear com hinge. No Windows correr com `PYTHONUTF8=1 python lp3.py` (senão lê feats.json em cp1252). Resultados com os dados da 2.ª passagem no Passo 1.
- build.js: junta site.src.html + data + models + pesos em index.html (página única, publicada como Artifact).
- Vídeo mostra para 2026 (modelo dele): Kane, Olise, Dembélé, Mbappé, Yamal, Rodri, Haaland, Kvaratskhelia, Díaz, Vitinha. Ajustar a esta ordem com os meus critérios fazia perder vencedores reais.

## Lacunas conhecidas
- Faltam taças nacionais, contagem de troféus, prémios individuais (Chuteira de Ouro, Bola de Ouro do Mundial), que o vídeo parece usar. Os substitutos calculáveis (reputação, melhores marcadores entre candidatos) já dão 16/16 dentro da amostra mas não melhoram a previsão honesta — ver "Estilo vídeo".
- Ver confiança por período no Passo 1 (2.ª passagem feita; o C restante está quase todo antes de 1990).
- Força das ligas constante no tempo.

## Passo 1 (em curso) — dados 1956–2025
Decisões do utilizador: top 10 oficial por ano + inelegíveis fortes (`elig:0`, lista "Todos"); alvo da lista "Todos" = vencedor retroativo da France Football (2016); janela = ano civil até 2021 (recurso `win:'S'` → conf C), época desde 2022; 2010–2021 refeitos em ano civil; assistências estimadas com `aConf`; força das ligas e peso das taças por década (eras.js); fontes em sources.json; reajuste reportando dentro da amostra e LOO (2010–2025 e período completo).
- Fluxo: data-src/*.json (formato em data-src/SPEC.md) + eras.js → `node gen-data.js` → data.js + sources.json → `node dump.js > feats.json && python3 lp3.py` → `node check.js` → `node build.js` (index.html).
- Feito: 1.ª passagem de todos os blocos 1956–2025 (votações/pontos/retroativos confirmados). 1984 (9.º Giresse, 10.º B. Robson) e 1985 (4.º–10.º) completados pela Wikipédia → 803 linhas.
- Feita a 2.ª passagem automática (ferramentas em `verify/`, descritas no SPEC): tabela de carreira + caixas de jogo das páginas de época (ano civil contado jogo a jogo), página da liga (título, ≥ 1/3 dos jogos), página da edição europeia (prova/fase pela distância à final), onzes dos torneios de seleções. Correções manuais com motivo em `verify/overrides.json`. data.js regenerado.
- Confiança depois da 2.ª passagem: total A 52 / B 438 / C 313 (antes A 14 / B 40 / C 740). 2010–2026: A 52 / B 116 / C 3; 1990–2009: B 166 / C 59; 1956–1989: B 156 / C 251. CY fica no máximo B (jogos estimados pela proporção de jogos do clube no ano); época (2022+) chega a A. 178 linhas em `win: "S"` (sem páginas de época com todos os jogos).
- Erros da 1.ª passagem apanhados, entre outros: títulos de Eto'o 2011 e Donnarumma 2021 (não eram campeões), fase europeia de Bale 2013, Häßler 1992 (Taça das Taças), muitos `ntGP`/`ntG`, valores de 2026 fora do top 3.
- O que fica em C: sobretudo jogadores sem tabela "Career statistics" na Wikipédia inglesa (≈124 linhas, quase todas antes de 1990: Bozsik, Kopa/Fontaine em parte, Garrincha, soviéticos e húngaros…), torneios sem onzes (CAN/Copa antigas), títulos belgas (páginas sem campeão na caixa), Argentina 1991–2014 (Apertura/Clausura, título manual), RFA antes de 1963 (Oberligen; título manual), Messi 2026 (MLS). Assistências continuam estimadas (aConf C).
- Reajuste com os dados da 2.ª passagem (fit-result.json; 1.ª passagem entre parênteses):
  - treino 2010–2025 (elegíveis): dentro 14/15 (14/15), LOO 9/15 (9/15); só falha Modrić 2018 (→ Griezmann); 2026 → Mbappé.
  - treino 1956–2025 (elegíveis, pesos usados no site): dentro 30/69 (28/69), LOO 27/69 (26/69); em 2010–2025 dentro 8/15, LOO 8/15; 2026 → Kane (certo).
  - treino 1956–2025 (lista "Todos"): dentro 28/69, LOO 27/69; 2026 → Yamal.
  - check.js (ajuste único): Previsão 30/69, Justo 20/69, Meu 24/69 (elegíveis). Pesos fixos continuam a não explicar 70 anos de votos; os dados melhores não mudaram isso.
- Seleção do modelo (`selecao.py` → selecao-result.json; ver o topo do script). Avaliação TEMPORAL: para prever o ano Y treina-se só com anos < Y (é assim que se prevê 2027; o LOO usa anos futuros). Em 2010–2026 (16 anos):
  - referência (19 critérios, treino desde 1956): 8/16.
  - janela: desde 1990/2000/2005 → 10/16; desde 1956/1970/1980 → 8/16; janelas deslizantes (últimos 10–25 anos) e pesos de recência não ajudam.
  - escolher critérios (eliminação para trás → 10 critérios) parecia 12/16, mas com a escolha feita só com o passado de cada ano dá 8/16 com rank médio 2,63 (pior que só escolher a janela): sobreajuste. Ficam os 19 critérios.
  - PROCEDIMENTO OFICIAL: 19 critérios; para cada ano escolhe-se a janela/recência/reg que melhor teria previsto os 12 anos anteriores → 9/16 sem nunca ver o ano (rank médio do vencedor 1,88); 1961–2009 com a mesma regra 14/49. Desde 2013 escolhe sempre "treino desde 2000". Modelo para 2027: treino 2000–2026, reg 0.005, sem recência.
- "Estilo vídeo" (o vídeo diz acertar 2010–2026 ajustando a esses anos). Critérios extra em `criterios.py` (reputação: Bolas de Ouro anteriores, ganhou a anterior, pódios nos 3 anos anteriores; melhor marcador entre os candidatos — total, Europa, seleção; títulos de não atacantes; dobradinhas). Com os 19 critérios, ajuste a 2010–2026 = 14/16 dentro da amostra (falham Modrić 2018 e Messi 2023); juntando UM só critério de reputação (Bolas de Ouro antes, ganhou a anterior, pódios) ou "finalista do Mundial sem ser atacante" → 16/16. Mas a prever sem ver o ano nenhum melhora: 7–9/16 contra 9/16 sem eles; os 11 juntos com seleção de janela → 5/16. Conclusão: o 16/16 é decorar; a Previsão fica com os 19. Tabela no Método do site (`videoStyle` em selecao-result.json). `selecao.py --extra` corre a seleção com os 30 critérios (→ selecao-extra-result.json).
- Site: nos elegíveis, a Previsão de cada ano usa os pesos temporais desse ano (`temporal` em selecao-result.json, injetado por build.js) — previsão que se teria feito na altura; 1956–1960 e a lista "Todos" continuam com o ajuste único (dentro da amostra, fit-result.json). Fluxo: … → `PYTHONUTF8=1 python lp3.py` → `PYTHONUTF8=1 python selecao.py [--aninhado]` → `node build.js`.
- index.html regenerado (não versionado); o Artifact publicado ainda não foi atualizado.
- Próximo: passo 2 (troféus/prémios individuais), avaliado da mesma forma temporal; previsão 2027 precisa dos candidatos da época 2026/27 (passo 3). Para melhorar o C antigo: Wikipédia noutras línguas (de/it/hu/fr) para as tabelas de carreira, RSSSF para ligas antigas.

## Próximos passos pedidos pelo utilizador
1. Estender os dados o mais atrás possível (mínimo 1992; idealmente desde 1956), marcando confiança.
2. Acrescentar critérios de troféus/prémios individuais e tentar 15/15 sem sobreajustar (reportar sempre dentro da amostra vs leave-one-out).
3. Previsão para a próxima Bola de Ouro (época 2026/27) com atualização automática: pipeline de dados (API com chave em segredo, p.ex. API-Football/football-data.org; fbref bloqueia scraping), agendamento (GitHub Actions cron), publicação do site.
