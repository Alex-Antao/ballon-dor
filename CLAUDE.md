# Laboratório Bola de Ouro — contexto do projeto

Objetivo: recriar os algoritmos do vídeo "I know who wins the Ballon d'Or 2026" (Pogorabona), criar um algoritmo próprio, comparar tudo ano a ano num site, e passar a prever a PRÓXIMA Bola de Ouro com dados atualizados automaticamente.
Língua com o utilizador: português de Portugal.

## Estado atual
- data.js: GERADO por gen-data.js a partir de data-src/ (1956–2026, 803 linhas). Campos em comentário no topo. Confiança A/B/C por linha. `cont` (médios/defesas/GR) é estimativa subjetiva.
- models.js: Histórico (19 critérios, pesos de fit-result.json), Justo (só individual), Meu (individual + crédito de equipa proporcional). Corre em Node e no browser.
- lp3.py (+ dump.js → feats.json): ajuste por programa linear com hinge. Resultado: 13/15 vencedores 2010–2025 em amostra, 9/15 leave-one-year-out. Falha Messi 2010 e Messi 2023. 2026 previsto Yamal (real: Kane).
- build.js: junta site.src.html + data + models + pesos em index.html (página única, publicada como Artifact).
- Vídeo mostra para 2026 (modelo dele): Kane, Olise, Dembélé, Mbappé, Yamal, Rodri, Haaland, Kvaratskhelia, Díaz, Vitinha. Ajustar a esta ordem com os meus critérios fazia perder vencedores reais.

## Lacunas conhecidas
- Faltam taças nacionais, contagem de troféus, prémios individuais (Chuteira de Ouro, melhor marcador UCL, Bola de Ouro do Mundial), que o vídeo parece usar. Provavelmente é o que impede o 15/15.
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
- `check.js` com o data.js novo e os pesos antigos: Histórico 29/69 (elegíveis). O reajuste (`lp3.py`) ainda não foi corrido com os dados novos: falta numpy/scipy no Python desta máquina.
- Próximo: reajuste (dentro da amostra e LOO, 2010–2025 e período completo); depois site (build.js) e passo 2. Para melhorar o C antigo: Wikipédia noutras línguas (de/it/hu/fr) para as tabelas de carreira, RSSSF para ligas antigas.

## Próximos passos pedidos pelo utilizador
1. Estender os dados o mais atrás possível (mínimo 1992; idealmente desde 1956), marcando confiança.
2. Acrescentar critérios de troféus/prémios individuais e tentar 15/15 sem sobreajustar (reportar sempre dentro da amostra vs leave-one-out).
3. Previsão para a próxima Bola de Ouro (época 2026/27) com atualização automática: pipeline de dados (API com chave em segredo, p.ex. API-Football/football-data.org; fbref bloqueia scraping), agendamento (GitHub Actions cron), publicação do site.
