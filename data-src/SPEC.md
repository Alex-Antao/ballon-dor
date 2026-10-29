# Especificação dos dados-fonte (data-src/*.json)

Cada ficheiro `data-src/AAAA-BBBB.json` cobre um bloco de anos. `gen-data.js` junta todos em `data.js` (sem fontes) e `sources.json` (só fontes).

## Formato

```json
{
  "1998": {
    "label": "Ano civil 1998 (+ Mundial 1998)",
    "award": "Ballon d’Or (France Football; jornalistas europeus)",
    "real": "Zinedine Zidane",
    "realAll": null,
    "realAllNote": "",
    "window": "CY",
    "notes": "texto livre (pt-PT) sobre particularidades do ano",
    "rows": [
      { "name": "Zinedine Zidane", "club": "Juventus", "lg": "SA", "pos": "AM",
        "gp": 0, "g": 0, "a": 0, "uT": "UCL", "uG": 0, "uA": 0, "uS": 4,
        "ntGP": 0, "ntG": 0, "ntA": 0, "ntT": "WC", "ntS": 5,
        "title": 1, "cont": null, "rank": 1, "elig": 1,
        "win": "CY", "conf": "A", "aConf": "C",
        "sources": ["https://..."], "note": "" }
    ]
  }
}
```

## Ano / janela
- `window`: `CY` = ano civil (1 jan–31 dez do ano Y). Vale para TODOS os anos até 2021 (incl. 2010–2015, FIFA Ballon d’Or). `P` = época oficial (2022+: época que termina em Y; 2023 inclui o Mundial 2022).
- `real`: vencedor oficial da Bola de Ouro nesse ano (`null` se não atribuído, p.ex. 2020).
- `realAll`: só preencher quando a France Football (2016) atribuiu RETROATIVAMENTE o prémio a um jogador inelegível nesse ano (p.ex. Pelé, Maradona). Senão `null`. Confirmar na web.
- `label`, `award`, `notes` em português de Portugal.

## Linhas (candidatos)
- Top 10 da votação oficial (empates contam: incluir todos os empatados no 10.º lugar).
- Mais, quando relevante, 1–3 jogadores INELEGÍVEIS que teriam sido candidatos fortes (`elig: 0`, `rank: null`). O vencedor retroativo da FF, se existir, tem de estar.
- `elig`: 1956–1994 só jogadores europeus; 1995–2006 qualquer nacionalidade mas em clube europeu; 2007+ todos. 1 = podia ganhar segundo as regras desse ano.

## Âmbito das estatísticas (igual para todos)
Só LIGA nacional + COMPETIÇÃO CONTINENTAL DE CLUBES + FASE FINAL de torneio de seleções. Taças nacionais, supertaças, Intercontinental/Mundial de Clubes, qualificações e particulares NÃO entram.

Com `window: CY`, conta-se o que foi jogado entre 1 jan e 31 dez de Y (2.ª metade da época Y-1/Y + 1.ª metade de Y/Y+1; ligas de ano civil, como Brasil/URSS/Escandinávia, contam o ano). Se não for possível obter a divisão, usa-se a época que termina em Y (`win: "S"`, e `conf` passa a "C"). Com `window: P`, `win: "P"`.

- `name`: como no data.js atual quando o jogador já existe (p.ex. "Lionel Messi", "Cristiano Ronaldo", "Andrés Iniesta").
- `club`: clube principal na janela (se mudou, "Clube A / Clube B"). `lg` = liga do clube onde fez mais jogos.
- `lg` (códigos): EPL (Inglaterra 1.º escalão, incl. First Division), LL, BL (RFA Bundesliga; antes de 1963 Oberliga = GER), SA, L1, ERE, POR, SCO, BEL, AUT, SUI, SWE, DEN, NOR, TUR, GRE, URS, RUS, UKR, YUG, TCH, HUN, POL, ROU, BUL, DDR, BRA, ARG, URU, MEX, MLS, KSA. Outro → código de 3 letras e explicar em `note`.
- `pos`: FW (ponta de lança), W (extremo/avançado de ala), AM (médio ofensivo/10), CM, DM, DF, GK.
- `gp/g/a`: jogos/golos/assistências na liga + competição continental.
- `uT`: competição continental cuja fase a eliminar decorreu na janela (para CY, a edição que termina em Y; se o jogador estava em duas, a mais importante). Códigos: UCL (Taça dos Campeões Europeus / Liga dos Campeões), CWC (Taça das Taças), UEL (Taça UEFA / Liga Europa / Taça das Cidades com Feiras), ECL (Liga Conferência), LIB (Libertadores), SUD (Sul-Americana), "" nenhuma.
- `uG/uA`: golos/assistências continentais na janela (subconjunto de g/a).
- `uS`: fase atingida nessa edição, contada pela distância à final: 0 = eliminado antes dos oitavos ou não jogou, 1 = oitavos (ou ronda equivalente: 16 equipas), 2 = quartos, 3 = meias, 4 = final perdida, 5 = vencedor. Formatos com grupos (UCL 1992/93, 1993/94; Libertadores antiga) → equivalente pela distância à final. NÃO aplicar descontos por prova: o peso de cada prova é tratado no models.js.
- `ntT`: WC, EURO, COPA, AFCON, ASIAN, GOLD ou "" (Taça das Confederações e Jogos Olímpicos NÃO contam). `ntGP/ntG/ntA` jogos/golos/assistências só na fase final. `ntS` fase final pela mesma escala 0–5 (fase de grupos = 0; formatos com 2.ª fase de grupos/liga → equivalente pela distância à final; Copa América em liga: 1.º = 5, 2.º = 4, 3.º/4.º = 3, resto = 1). Euro 1960–1976 (4 equipas): meias = 3.
- `title`: 1 se foi campeão nacional numa liga cuja época terminou na janela, com papel relevante (≥1/3 dos jogos).
- `cont`: só para CM/DM/DF/GK (null em FW/W/AM). Contributo não ofensivo 0–10, ESTIMATIVA SUBJETIVA. Calibração dos dados atuais: Neuer 2014 = 10, Rodri 2024 = 10, Buffon 2017 = 9,5, Van Dijk 2019 = 9,5, Modrić 2018 = 9,5, Kanté 2021 = 9,5, Xavi = 9, Thiago Silva 2013 = 9, Carvajal 2024 = 9, Iniesta = 8,5, Jorginho 2021 = 8,5, Vitinha 2025 = 8,5, Hakimi 2025 = 8,5. Um candidato de elite fica tipicamente entre 7 e 10.
- `rank`: posição na votação oficial (empates = mesma posição). `null` se não votado/inelegível.
- `conf` (números sem ser assistências): A = verificado em ≥1 fonte fiável para essa janela; B = parcialmente verificado (p.ex. totais por época verificados, divisão do ano civil estimada a partir de jogos conhecidos); C = estimativa, ou `win: "S"` em ano CY.
- `aConf`: confiança de a/uA/ntA (antes de ~2005 normalmente C = estimado).
- `sources`: URLs efetivamente consultados para essa linha. `note`: dúvidas, divergências entre fontes, etc.

## Regras decididas depois da primeira passagem
- **Europa sem edição a terminar em Y:** `uT` = prova jogada no outono de Y, `uS` = 0. Em `g`/`uG` (e `gp`) entram TODOS os jogos continentais do ano civil (das duas edições); `uT`/`uS` referem-se à edição que termina em Y quando existe.
- **Títulos retirados:** conta o que se sabia na altura da votação (dezembro de Y). Juventus 2004/05 conta em 2005 (retirado só em 2006); Juventus 2005/06 não conta em 2006; Marselha 1992/93 não conta em 1993.
- **Dois torneios de seleções no mesmo ano** (p.ex. CAN + Mundial): fica o de maior `ntS` × NTMULT (empate → maior produção); o outro vai para `note`.
- **Brasil antes de 1971:** campeonato estadual + torneio nacional como `lg: "BRA"`.
- Ligas extra aceites: EN2 (2.º escalão inglês), ITB (Serie B), CZE, PER, CHN.

## Método de verificação (2.ª passagem)
- Ler a Wikipédia por wikitext: `curl -s "https://en.wikipedia.org/w/index.php?title=TÍTULO&action=raw"` (outras línguas: trocar `en`). Encontrar títulos com `https://en.wikipedia.org/w/api.php?action=opensearch&search=...&format=json`.
- Fontes úteis: páginas de época dos clubes (`2012–13 FC Barcelona season`, com marcadores jogo a jogo → permitem contar o ano civil), páginas dos torneios de seleções e de cada edição europeia, estatísticas de carreira do jogador, RSSSF (`www.rsssf.org`), eu-football.info (jogos de seleção).
- NÃO usar transfermarkt, fbref nem worldfootball (protecção anti-bots) e nunca falsear o user-agent. Evitar WebSearch (quota partilhada).
- Confiança por linha = componente mais fraca de (gp/g, uG/uS, nt*, title):
  - A: números do ano civil (ou da época, se window P) contados a partir de dados jogo a jogo ou de totais oficiais para essa janela exata.
  - B: totais por época verificados e divisão do ano civil estimada com dados parciais.
  - C: estimativa.
- `aConf`: A/B só quando há registo de assistências numa fonte; senão C.
