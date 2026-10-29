// Dataset: candidatos à Bola de Ouro 2010–2026.
// Âmbito único para todos os jogadores: LIGA + COMPETIÇÃO EUROPEIA (UCL/UEL/UECL) + FASE FINAL de torneio de seleções.
// Taças domésticas e qualificação NÃO entram (para tratar todos de forma igual).
// Janela: época que termina no ano Y (+ torneio de seleções desse verão). 2022+: época oficial (2023 inclui o Mundial 2022).
//
// Campos: name, club, lg, pos, gp, g, a, uG, uA, uS, ntGP, ntG, ntA, ntT, ntS, title, cont, rank, conf
//  gp/g/a   = jogos/golos/assistências (liga + Europa)
//  uG/uA    = subconjunto europeu (golos/assistências)
//  uS       = fase europeia atingida: 0 grupos/fora, 1 oitavos, 2 quartos, 3 meias, 4 final perdida, 5 vencedor (UEL/UECL vencida = 3/2)
//  nt*      = fase final do torneio de seleções (Mundial/Euro/Copa América/CAN) jogos, golos, assistências, nome, fase (0..5)
//  title    = campeão da liga nacional (0/1)
//  cont     = contributo não ofensivo estimado 0–10 (só médios/defesas/GR; ESTIMATIVA SUBJETIVA, null nos avançados)
//  rank     = posição real na votação oficial (null = fora do top divulgado)
//  conf     = A verificado em fontes, B conhecimento próprio aproximado, C estimativa/parcial
const R = (name, club, lg, pos, gp, g, a, uG, uA, uS, ntGP, ntG, ntA, ntT, ntS, title, cont, rank, conf) =>
  ({ name, club, lg, pos, gp, g, a, uG, uA, uS, ntGP, ntG, ntA, ntT, ntS, title, cont, rank, conf });

const YEARS = {
  2010: { label: '2009/10 + Mundial 2010', award: 'FIFA Ballon d’Or (jornalistas + treinadores + capitães)', real: 'Lionel Messi', rows: [
    R('Lionel Messi','Barcelona','LL','FW',46,42,12,8,3,3,5,0,0,'WC',2,1,null,1,'B'),
    R('Andrés Iniesta','Barcelona','LL','CM',35,3,7,1,2,3,7,1,1,'WC',5,1,8.5,2,'B'),
    R('Xavi','Barcelona','LL','CM',45,5,11,1,2,3,7,0,2,'WC',5,1,9,3,'B'),
    R('Wesley Sneijder','Inter','SA','AM',47,9,12,3,4,5,7,5,1,'WC',4,1,null,null,'B'),
    R('Diego Forlán','Atlético Madrid','LL','FW',48,27,9,9,3,3,7,5,2,'WC',3,0,null,null,'B'),
    R('Thomas Müller','Bayern','BL','W',45,18,15,5,3,4,7,5,3,'WC',3,1,null,null,'B'),
    R('Arjen Robben','Bayern','BL','W',32,19,11,3,3,4,7,2,1,'WC',4,1,null,null,'B'),
    R('Diego Milito','Inter','SA','FW',47,28,7,6,2,5,0,0,0,'',0,1,null,null,'B'),
  ]},
  2011: { label: '2010/11 (+ Copa América 2011)', award: 'FIFA Ballon d’Or', real: 'Lionel Messi', rows: [
    R('Lionel Messi','Barcelona','LL','FW',46,43,21,12,3,5,4,0,1,'COPA',2,1,null,1,'B'),
    R('Cristiano Ronaldo','Real Madrid','LL','W',46,46,13,6,3,3,0,0,0,'',0,0,null,2,'B'),
    R('Xavi','Barcelona','LL','CM',45,5,14,1,3,5,0,0,0,'',0,1,9,3,'B'),
    R('Andrés Iniesta','Barcelona','LL','CM',46,5,12,1,2,5,0,0,0,'',0,1,8.5,null,'B'),
    R('Wayne Rooney','Man United','EPL','FW',37,15,9,4,1,4,0,0,0,'',0,1,null,null,'B'),
  ]},
  2012: { label: '2011/12 + Euro 2012', award: 'FIFA Ballon d’Or', real: 'Lionel Messi', rows: [
    R('Lionel Messi','Barcelona','LL','FW',48,64,21,14,5,3,0,0,0,'',0,0,null,1,'B'),
    R('Cristiano Ronaldo','Real Madrid','LL','W',49,56,15,10,3,3,5,3,1,'EURO',3,1,null,2,'B'),
    R('Andrés Iniesta','Barcelona','LL','CM',43,3,10,1,3,3,6,0,2,'EURO',5,0,8.5,3,'B'),
    R('Xavi','Barcelona','LL','CM',48,4,13,1,2,3,6,0,2,'EURO',5,0,9,null,'B'),
    R('Andrea Pirlo','Juventus','SA','CM',37,6,14,0,0,0,6,0,2,'EURO',4,1,8.5,null,'B'),
    R('Radamel Falcao','Atlético Madrid','LL','FW',48,36,6,12,2,3,0,0,0,'',0,0,null,null,'B'),
    R('Didier Drogba','Chelsea','EPL','FW',38,10,6,5,1,5,6,2,0,'AFCON',4,0,null,null,'B'),
  ]},
  2013: { label: '2012/13', award: 'FIFA Ballon d’Or', real: 'Cristiano Ronaldo', rows: [
    R('Cristiano Ronaldo','Real Madrid','LL','W',46,46,14,12,2,3,0,0,0,'',0,0,null,1,'B'),
    R('Lionel Messi','Barcelona','LL','FW',42,54,14,8,2,3,0,0,0,'',0,1,null,2,'B'),
    R('Franck Ribéry','Bayern','BL','W',39,9,16,3,5,5,0,0,0,'',0,1,null,3,'B'),
    R('Arjen Robben','Bayern','BL','W',41,16,13,4,2,5,0,0,0,'',0,1,null,null,'B'),
    R('Zlatan Ibrahimović','PSG','L1','FW',43,34,6,4,1,2,0,0,0,'',0,1,null,null,'B'),
    R('Robert Lewandowski','Dortmund','BL','FW',40,34,9,10,3,4,0,0,0,'',0,0,null,null,'B'),
    R('Thiago Silva','PSG','L1','DF',38,3,1,0,0,2,0,0,0,'',0,1,9,null,'B'),
  ]},
  2014: { label: '2013/14 + Mundial 2014', award: 'FIFA Ballon d’Or', real: 'Cristiano Ronaldo', rows: [
    R('Cristiano Ronaldo','Real Madrid','LL','W',41,48,13,17,5,5,3,1,0,'WC',0,0,null,1,'B'),
    R('Lionel Messi','Barcelona','LL','FW',39,36,13,8,2,2,7,4,1,'WC',4,0,null,2,'B'),
    R('Manuel Neuer','Bayern','BL','GK',44,0,0,0,0,3,7,0,0,'WC',5,1,10,3,'B'),
    R('Thomas Müller','Bayern','BL','W',41,14,12,4,3,3,7,5,3,'WC',5,1,null,null,'B'),
    R('James Rodríguez','Monaco','L1','AM',34,9,12,0,0,0,5,6,2,'WC',2,0,null,null,'B'),
    R('Diego Costa','Atlético Madrid','LL','FW',47,35,6,8,1,4,2,0,0,'WC',0,1,null,null,'B'),
    R('Arjen Robben','Bayern','BL','W',39,11,11,3,2,3,7,3,2,'WC',3,1,null,null,'B'),
  ]},
  2015: { label: '2014/15 (+ Copa América 2015)', award: 'FIFA Ballon d’Or', real: 'Lionel Messi', rows: [
    R('Lionel Messi','Barcelona','LL','FW',51,53,24,10,6,5,6,1,1,'COPA',4,1,null,1,'B'),
    R('Cristiano Ronaldo','Real Madrid','LL','W',47,58,18,10,2,3,0,0,0,'',0,0,null,2,'B'),
    R('Neymar','Barcelona','LL','W',45,32,14,10,4,5,2,2,1,'COPA',2,1,null,3,'B'),
    R('Luis Suárez','Barcelona','LL','FW',46,23,20,7,3,5,4,0,1,'COPA',2,1,null,null,'B'),
    R('Robert Lewandowski','Bayern','BL','FW',42,27,6,10,2,3,0,0,0,'',0,1,null,null,'B'),
    R('Manuel Neuer','Bayern','BL','GK',42,0,0,0,0,3,0,0,0,'',0,1,9.5,null,'B'),
  ]},
  2016: { label: '2015/16 + Euro 2016 + Copa Centenário', award: 'Ballon d’Or (France Football)', real: 'Cristiano Ronaldo', rows: [
    R('Cristiano Ronaldo','Real Madrid','LL','W',47,51,14,16,3,5,7,3,3,'EURO',5,0,null,1,'B'),
    R('Lionel Messi','Barcelona','LL','FW',41,32,20,6,4,2,6,5,4,'COPA',4,1,null,2,'B'),
    R('Antoine Griezmann','Atlético Madrid','LL','FW',50,29,8,7,1,4,7,6,2,'EURO',4,0,null,3,'B'),
    R('Luis Suárez','Barcelona','LL','FW',43,45,25,5,3,2,3,0,0,'COPA',0,1,null,4,'B'),
    R('Neymar','Barcelona','LL','W',39,30,15,6,2,2,0,0,0,'',0,1,null,5,'B'),
    R('Gareth Bale','Real Madrid','LL','W',37,26,15,7,3,5,6,3,1,'EURO',3,0,null,null,'B'),
  ]},
  2017: { label: '2016/17', award: 'Ballon d’Or (France Football)', real: 'Cristiano Ronaldo', rows: [
    R('Cristiano Ronaldo','Real Madrid','LL','W',42,37,10,12,4,5,0,0,0,'',0,1,null,1,'B'),
    R('Lionel Messi','Barcelona','LL','FW',43,48,12,11,3,2,0,0,0,'',0,0,null,2,'B'),
    R('Neymar','Barcelona','LL','W',39,19,15,6,4,2,0,0,0,'',0,0,null,3,'B'),
    R('Gianluigi Buffon','Juventus','SA','GK',46,0,0,0,0,4,0,0,0,'',0,1,9.5,4,'B'),
    R('Luka Modrić','Real Madrid','LL','CM',41,3,7,0,2,5,0,0,0,'',0,1,9,5,'B'),
    R('Kylian Mbappé','Monaco','L1','FW',39,21,8,6,2,3,0,0,0,'',0,1,null,null,'B'),
    R('Robert Lewandowski','Bayern','BL','FW',41,35,7,5,1,2,0,0,0,'',0,1,null,null,'B'),
  ]},
  2018: { label: '2017/18 + Mundial 2018', award: 'Ballon d’Or (France Football)', real: 'Luka Modrić', rows: [
    R('Luka Modrić','Real Madrid','LL','CM',44,3,6,1,1,5,7,2,1,'WC',4,0,9.5,1,'B'),
    R('Cristiano Ronaldo','Real Madrid','LL','W',40,41,8,15,3,5,4,4,0,'WC',1,0,null,2,'B'),
    R('Antoine Griezmann','Atlético Madrid','LL','FW',50,25,12,6,2,3,7,4,2,'WC',5,0,null,3,'B'),
    R('Kylian Mbappé','PSG','L1','FW',34,17,12,4,1,1,7,4,1,'WC',5,1,null,4,'B'),
    R('Lionel Messi','Barcelona','LL','FW',46,40,17,6,5,2,4,1,2,'WC',1,1,null,5,'B'),
    R('Mohamed Salah','Liverpool','EPL','W',51,42,12,10,2,4,2,1,0,'WC',0,0,null,null,'B'),
    R('Harry Kane','Tottenham','EPL','FW',45,34,3,4,1,1,7,6,0,'WC',3,0,null,null,'B'),
  ]},
  2019: { label: '2018/19 (+ Copa América / CAN 2019)', award: 'Ballon d’Or (France Football)', real: 'Lionel Messi', rows: [
    R('Lionel Messi','Barcelona','LL','FW',44,48,16,12,3,3,6,1,1,'COPA',3,1,null,1,'B'),
    R('Virgil van Dijk','Liverpool','EPL','DF',51,5,3,1,0,5,0,0,0,'',0,0,9.5,2,'B'),
    R('Cristiano Ronaldo','Juventus','SA','W',40,27,11,6,3,2,0,0,0,'',0,1,null,3,'B'),
    R('Sadio Mané','Liverpool','EPL','W',48,26,5,4,1,5,7,1,2,'AFCON',4,0,null,4,'B'),
    R('Mohamed Salah','Liverpool','EPL','W',51,23,11,5,1,5,4,2,0,'AFCON',1,0,null,5,'B'),
    R('Kylian Mbappé','PSG','L1','FW',37,39,8,6,1,1,0,0,0,'',0,1,null,null,'B'),
  ]},
  2020: { label: '2019/20 (Bola de Ouro NÃO atribuída – COVID)', award: 'Não atribuída', real: null, rows: [
    R('Robert Lewandowski','Bayern','BL','FW',41,49,11,15,6,5,0,0,0,'',0,1,null,null,'B'),
    R('Lionel Messi','Barcelona','LL','FW',37,28,22,3,1,1,0,0,0,'',0,0,null,null,'B'),
    R('Cristiano Ronaldo','Juventus','SA','W',37,35,5,4,0,1,0,0,0,'',0,1,null,null,'B'),
    R('Kevin De Bruyne','Man City','EPL','AM',43,15,23,2,3,2,0,0,0,'',0,0,null,null,'B'),
    R('Neymar','PSG','L1','W',25,19,10,6,4,4,0,0,0,'',0,1,null,null,'B'),
    R('Mohamed Salah','Liverpool','EPL','W',46,22,11,3,1,1,0,0,0,'',0,1,null,null,'B'),
    R('Kylian Mbappé','PSG','L1','FW',30,22,8,4,3,4,0,0,0,'',0,1,null,null,'B'),
  ]},
  2021: { label: '2020/21 + Euro 2020 + Copa América 2021', award: 'Ballon d’Or (France Football)', real: 'Lionel Messi', rows: [
    R('Lionel Messi','Barcelona','LL','FW',40,33,10,3,1,1,7,4,5,'COPA',5,0,null,1,'B'),
    R('Robert Lewandowski','Bayern','BL','FW',34,45,8,4,1,2,3,3,0,'EURO',0,1,null,2,'B'),
    R('Jorginho','Chelsea','EPL','CM',49,6,4,1,0,5,6,0,1,'EURO',5,0,8.5,3,'B'),
    R('Karim Benzema','Real Madrid','LL','FW',45,27,12,4,3,3,4,4,1,'EURO',1,0,null,4,'B'),
    R('N’Golo Kanté','Chelsea','EPL','DM',47,1,2,0,0,5,4,0,0,'EURO',1,0,9.5,5,'B'),
    R('Mohamed Salah','Liverpool','EPL','W',45,24,6,2,1,2,0,0,0,'',0,0,null,null,'B'),
    R('Kevin De Bruyne','Man City','EPL','AM',36,8,14,2,2,4,4,1,1,'EURO',2,1,null,null,'B'),
  ]},
  2022: { label: '2021/22 (+ CAN 2022)', award: 'Ballon d’Or (época; 100 jornalistas)', real: 'Karim Benzema', rows: [
    R('Karim Benzema','Real Madrid','LL','FW',44,42,13,15,2,5,0,0,0,'',0,1,null,1,'B'),
    R('Sadio Mané','Liverpool','EPL','W',47,21,3,5,1,4,7,3,1,'AFCON',5,0,null,2,'B'),
    R('Kevin De Bruyne','Man City','EPL','AM',43,19,15,4,1,3,0,0,0,'',0,1,null,3,'B'),
    R('Robert Lewandowski','Bayern','BL','FW',42,48,6,13,2,2,0,0,0,'',0,1,null,4,'B'),
    R('Mohamed Salah','Liverpool','EPL','W',48,31,15,8,2,4,7,1,1,'AFCON',4,0,null,5,'B'),
    R('Kylian Mbappé','PSG','L1','FW',43,34,18,6,1,1,0,0,0,'',0,1,null,null,'B'),
    R('Thibaut Courtois','Real Madrid','LL','GK',50,0,0,0,0,5,0,0,0,'',0,1,10,null,'B'),
  ]},
  2023: { label: '2022/23 (inclui Mundial 2022)', award: 'Ballon d’Or (época; 100 jornalistas)', real: 'Lionel Messi', rows: [
    R('Lionel Messi','PSG','L1','FW',40,20,17,4,1,1,7,7,3,'WC',5,1,null,1,'B'),
    R('Erling Haaland','Man City','EPL','FW',47,48,9,12,1,5,0,0,0,'',0,1,null,2,'B'),
    R('Kylian Mbappé','PSG','L1','FW',42,36,9,7,1,1,7,8,2,'WC',4,1,null,3,'B'),
    R('Kevin De Bruyne','Man City','EPL','AM',43,9,18,2,1,5,3,0,0,'WC',0,1,null,4,'B'),
    R('Rodri','Man City','EPL','DM',47,2,6,0,1,5,4,0,0,'WC',1,1,9.5,5,'B'),
    R('Victor Osimhen','Napoli','SA','FW',41,31,5,5,0,2,0,0,0,'',0,1,null,null,'B'),
  ]},
  2024: { label: '2023/24 + Euro 2024 (+ Copa América 2024)', award: 'Ballon d’Or (época; 100 jornalistas)', real: 'Rodri', rows: [
    R('Rodri','Man City','EPL','DM',42,9,10,1,1,2,7,0,0,'EURO',5,1,10,1,'B'),
    R('Vinícius Júnior','Real Madrid','LL','W',42,21,13,6,3,5,4,1,0,'COPA',2,1,null,2,'B'),
    R('Jude Bellingham','Real Madrid','LL','AM',39,23,11,4,5,5,7,2,1,'EURO',4,1,null,3,'B'),
    R('Dani Carvajal','Real Madrid','LL','DF',38,5,7,1,2,5,7,0,0,'EURO',5,1,9,4,'B'),
    R('Erling Haaland','Man City','EPL','FW',38,33,6,6,1,2,0,0,0,'',0,1,null,5,'B'),
    R('Harry Kane','Bayern','BL','FW',42,44,11,8,3,3,7,3,2,'EURO',4,0,null,null,'B'),
    R('Kylian Mbappé','PSG','L1','FW',39,35,9,8,2,3,6,1,0,'EURO',3,1,null,null,'B'),
    R('Lamine Yamal','Barcelona','LL','W',44,6,10,1,2,2,7,1,4,'EURO',5,0,null,null,'B'),
  ]},
  2025: { label: '2024/25', award: 'Ballon d’Or (época; 100 jornalistas)', real: 'Ousmane Dembélé', rows: [
    R('Ousmane Dembélé','PSG','L1','W',44,29,12,8,6,5,0,0,0,'',0,1,null,1,'B'),
    R('Lamine Yamal','Barcelona','LL','W',48,14,16,5,3,3,0,0,0,'',0,1,null,2,'B'),
    R('Vitinha','PSG','L1','CM',44,5,6,2,3,5,0,0,0,'',0,1,8.5,3,'B'),
    R('Mohamed Salah','Liverpool','EPL','W',47,31,22,2,4,1,0,0,0,'',0,1,null,4,'B'),
    R('Raphinha','Barcelona','LL','W',49,31,17,13,8,3,0,0,0,'',0,1,null,5,'B'),
    R('Achraf Hakimi','PSG','L1','DF',43,5,12,1,5,5,0,0,0,'',0,1,8.5,6,'B'),
    R('Kylian Mbappé','Real Madrid','LL','FW',43,35,6,4,1,2,0,0,0,'',0,0,null,7,'B'),
    R('Harry Kane','Bayern','BL','FW',41,34,10,8,2,2,0,0,0,'',0,1,null,13,'B'),
  ]},
  2026: { label: '2025/26 + Mundial 2026', award: 'Ballon d’Or (época; 100 jornalistas)', real: 'Harry Kane', rows: [
    R('Harry Kane','Bayern','BL','FW',44,50,7,14,2,3,7,6,1,'WC',3,1,null,1,'A'),
    R('Kylian Mbappé','Real Madrid','LL','FW',42,40,6,15,1,2,8,10,4,'WC',3,0,null,2,'A'),
    R('Lamine Yamal','Barcelona','LL','W',38,22,15,6,4,2,8,1,0,'WC',5,1,null,3,'A'),
    R('Rodri','Man City','EPL','DM',38,2,4,0,0,2,8,0,1,'WC',5,0,9.5,4,'C'),
    R('Lionel Messi','Inter Miami','MLS','FW',33,28,18,0,0,0,7,4,3,'WC',4,1,null,5,'C'),
    R('Khvicha Kvaratskhelia','PSG','L1','W',47,21,9,10,6,5,0,0,0,'',0,1,null,6,'C'),
    R('Ousmane Dembélé','PSG','L1','W',35,19,11,7,4,5,7,6,2,'WC',3,1,null,7,'C'),
    R('Erling Haaland','Man City','EPL','FW',45,33,6,7,1,1,6,7,0,'WC',2,0,null,8,'C'),
    R('Luis Díaz','Bayern','BL','W',42,23,17,8,4,3,4,1,1,'WC',1,1,null,null,'C'),
    R('Michael Olise','Bayern','BL','W',44,15,26,5,8,3,7,2,7,'WC',3,1,null,9,'C'),
    R('Fabián Ruiz','PSG','L1','CM',45,8,7,3,3,5,7,1,1,'WC',5,1,8.5,10,'C'),
    R('Vitinha','PSG','L1','CM',45,7,10,2,4,5,4,0,1,'WC',1,1,8.5,null,'C'),
  ]},
};

// Coeficientes de força da liga (1 = referência). Simplificação: constantes no tempo.
const LEAGUE = { EPL: 1.00, LL: 0.99, BL: 0.93, SA: 0.90, L1: 0.82, MLS: 0.62 };
// Multiplicador por torneio de seleções (nível da oposição)
const NTMULT = { WC: 1.0, EURO: 1.0, COPA: 0.92, AFCON: 0.85, '': 1.0 };

if (typeof module !== 'undefined') module.exports = { YEARS, LEAGUE, NTMULT };
