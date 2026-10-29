# Laboratório Bola de Ouro — contexto do projeto

Objetivo: recriar os algoritmos do vídeo "I know who wins the Ballon d'Or 2026" (Pogorabona), criar um algoritmo próprio, comparar tudo ano a ano num site, e passar a prever a PRÓXIMA Bola de Ouro com dados atualizados automaticamente.
Língua com o utilizador: português de Portugal.

## Estado atual
- data.js: candidatos 2010–2026 (5–11 por ano). Campos em comentário no topo. Confiança A/B/C por linha. `cont` (médios/defesas/GR) é estimativa subjetiva.
- models.js: Histórico (19 critérios, pesos de fit-result.json), Justo (só individual), Meu (individual + crédito de equipa proporcional). Corre em Node e no browser.
- lp3.py (+ dump.js → feats.json): ajuste por programa linear com hinge. Resultado: 13/15 vencedores 2010–2025 em amostra, 9/15 leave-one-year-out. Falha Messi 2010 e Messi 2023. 2026 previsto Yamal (real: Kane).
- build.js: junta site.src.html + data + models + pesos em index.html (página única, publicada como Artifact).
- Vídeo mostra para 2026 (modelo dele): Kane, Olise, Dembélé, Mbappé, Yamal, Rodri, Haaland, Kvaratskhelia, Díaz, Vitinha. Ajustar a esta ordem com os meus critérios fazia perder vencedores reais.

## Lacunas conhecidas
- Faltam taças nacionais, contagem de troféus, prémios individuais (Chuteira de Ouro, melhor marcador UCL, Bola de Ouro do Mundial), que o vídeo parece usar. Provavelmente é o que impede o 15/15.
- Quase tudo de 2010–2025 vem de memória (confiança B). 2026 fora do top 3 é estimado (C).
- Força das ligas constante no tempo.

## Passo 1 (em curso) — dados 1956–2025
Decisões do utilizador: top 10 oficial por ano + inelegíveis fortes (`elig:0`, lista "Todos"); alvo da lista "Todos" = vencedor retroativo da France Football (2016); janela = ano civil até 2021 (recurso `win:'S'` → conf C), época desde 2022; 2010–2021 refeitos em ano civil; assistências estimadas com `aConf`; força das ligas e peso das taças por década (eras.js); fontes em sources.json; reajuste reportando dentro da amostra e LOO (2010–2025 e período completo).
- Fluxo: data-src/*.json (formato em data-src/SPEC.md) + eras.js → `node gen-data.js` → data.js + sources.json → `node dump.js > feats.json && python3 lp3.py` → `node check.js` → `node build.js` (index.html).
- Feito: 1.ª passagem de todos os blocos 1956–2025 (794 linhas). Votações/pontos/retroativos confirmados por pesquisa; estatísticas quase todas de memória (A 14 / B 40 / C 740). data.js AINDA é o antigo: falta correr gen-data.js (o models.js novo precisa do data.js gerado).
- Teste provisório com a 1.ª passagem: ajuste 2010–2025 → 14/15 dentro, 9/15 LOO; ajuste 1956–2025 → 28/69 dentro, 26/69 LOO (8/15 em 2010–2025). Pesos fixos não explicam 70 anos de votos.
- Próximo: 2.ª passagem de verificação bloco a bloco seguindo "Método de verificação" do SPEC (Wikipédia via `action=raw`, RSSSF, eu-football.info; NÃO transfermarkt/fbref/worldfootball nem falsear user-agent). Faltam ainda 1984 (9.º–10.º) e 1985 (4.º–10.º). Depois: gen-data, reajuste, atualizar site e este ficheiro.

## Próximos passos pedidos pelo utilizador
1. Estender os dados o mais atrás possível (mínimo 1992; idealmente desde 1956), marcando confiança.
2. Acrescentar critérios de troféus/prémios individuais e tentar 15/15 sem sobreajustar (reportar sempre dentro da amostra vs leave-one-out).
3. Previsão para a próxima Bola de Ouro (época 2026/27) com atualização automática: pipeline de dados (API com chave em segredo, p.ex. API-Football/football-data.org; fbref bloqueia scraping), agendamento (GitHub Actions cron), publicação do site.
