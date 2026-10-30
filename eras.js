// Era-dependent tables. Copied into data.js by gen-data.js (edit here, not in data.js).
// ESTIMATED values (not fitted to the winners): the relative weight of each league/competition per decade,
// guided by European club results and historical UEFA coefficients.

// League strength per decade (1 = reference league).
const LEAGUE_DECADES = [1950, 1960, 1970, 1980, 1990, 2000, 2010, 2020];
const LEAGUE_ERA = {
  //    1950  1960  1970  1980  1990  2000  2010  2020
  LL:  [1.00, 0.95, 0.86, 0.88, 0.94, 1.00, 0.99, 0.99],
  SA:  [0.90, 1.00, 0.88, 0.95, 1.00, 0.95, 0.90, 0.90],
  EPL: [0.85, 0.90, 0.95, 0.95, 0.86, 0.98, 1.00, 1.00],
  BL:  [0.78, 0.85, 1.00, 0.92, 0.92, 0.88, 0.93, 0.93],
  GER: [0.78, 0.80, 0.80, 0.80, 0.80, 0.80, 0.80, 0.80],   // Oberliga (before the Bundesliga, 1963)
  L1:  [0.85, 0.78, 0.74, 0.82, 0.88, 0.82, 0.82, 0.82],
  ERE: [0.62, 0.85, 0.95, 0.80, 0.78, 0.72, 0.70, 0.72],
  POR: [0.72, 0.90, 0.80, 0.80, 0.80, 0.76, 0.78, 0.80],
  SCO: [0.75, 0.82, 0.78, 0.72, 0.66, 0.65, 0.60, 0.60],
  BEL: [0.62, 0.72, 0.82, 0.82, 0.74, 0.66, 0.68, 0.72],
  AUT: [0.78, 0.70, 0.68, 0.68, 0.62, 0.60, 0.58, 0.62],
  SUI: [0.65, 0.62, 0.60, 0.60, 0.60, 0.60, 0.60, 0.62],
  SWE: [0.65, 0.62, 0.62, 0.66, 0.60, 0.56, 0.55, 0.55],
  DEN: [0.55, 0.55, 0.58, 0.62, 0.60, 0.58, 0.58, 0.60],
  NOR: [0.50, 0.50, 0.52, 0.55, 0.60, 0.56, 0.55, 0.58],
  TUR: [0.55, 0.60, 0.62, 0.62, 0.68, 0.72, 0.72, 0.72],
  GRE: [0.55, 0.60, 0.65, 0.65, 0.68, 0.68, 0.65, 0.65],
  URS: [0.75, 0.78, 0.78, 0.80, 0.72, 0.72, 0.72, 0.72],
  RUS: [0.72, 0.72, 0.72, 0.72, 0.68, 0.72, 0.72, 0.65],
  UKR: [0.72, 0.72, 0.72, 0.72, 0.68, 0.70, 0.70, 0.65],
  YUG: [0.80, 0.80, 0.80, 0.78, 0.70, 0.62, 0.60, 0.60],
  TCH: [0.75, 0.78, 0.72, 0.70, 0.62, 0.62, 0.60, 0.62],
  HUN: [0.85, 0.80, 0.70, 0.65, 0.55, 0.50, 0.50, 0.52],
  POL: [0.62, 0.66, 0.70, 0.70, 0.60, 0.55, 0.55, 0.55],
  ROU: [0.60, 0.65, 0.68, 0.72, 0.65, 0.60, 0.58, 0.55],
  BUL: [0.62, 0.66, 0.68, 0.68, 0.60, 0.55, 0.52, 0.52],
  DDR: [0.62, 0.68, 0.72, 0.72, 0.72, 0.72, 0.72, 0.72],
  BRA: [0.90, 0.92, 0.86, 0.85, 0.80, 0.75, 0.72, 0.75],
  ARG: [0.85, 0.86, 0.82, 0.80, 0.76, 0.72, 0.70, 0.70],
  URU: [0.80, 0.80, 0.70, 0.68, 0.60, 0.58, 0.55, 0.55],
  MEX: [0.55, 0.55, 0.58, 0.60, 0.60, 0.62, 0.62, 0.62],
  EN2: [0.55, 0.55, 0.55, 0.55, 0.55, 0.60, 0.60, 0.62],   // English second tier
  ITB: [0.55, 0.55, 0.55, 0.55, 0.58, 0.58, 0.55, 0.55],   // Serie B
  CZE: [0.75, 0.78, 0.72, 0.70, 0.62, 0.62, 0.60, 0.62],   // = TCH
  PER: [0.55, 0.60, 0.62, 0.55, 0.50, 0.50, 0.50, 0.50],
  CHN: [0.40, 0.40, 0.40, 0.40, 0.45, 0.50, 0.55, 0.50],
  MLS: [0.50, 0.50, 0.50, 0.50, 0.55, 0.58, 0.62, 0.62],
  KSA: [0.45, 0.45, 0.45, 0.50, 0.52, 0.55, 0.55, 0.60],
};
const LEAGUE_DEFAULT = 0.55; // league without an entry in the table

// Weight of each continental club competition relative to the European Cup / Champions League
// (multiplies the stage reached and the output in that competition). UEL 2010+ = 0.6 and ECL = 0.4 reproduce the old
// scale (winning the UEL = 3, winning the ECL = 2).
const CUP_ERA = {
  //    1950  1960  1970  1980  1990  2000  2010  2020
  UCL: [1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00],
  CWC: [0.70, 0.78, 0.75, 0.70, 0.62, 0.62, 0.62, 0.62],   // Cup Winners' Cup (1960/61–1998/99)
  UEL: [0.55, 0.60, 0.72, 0.76, 0.76, 0.62, 0.60, 0.60],   // Inter-Cities Fairs Cup / UEFA Cup / Europa League
  ECL: [0.40, 0.40, 0.40, 0.40, 0.40, 0.40, 0.40, 0.40],
  LIB: [0.90, 0.90, 0.85, 0.80, 0.75, 0.70, 0.70, 0.70],   // Libertadores (South American candidates only)
  SUD: [0.45, 0.45, 0.45, 0.45, 0.45, 0.45, 0.45, 0.45],
  '':  [0, 0, 0, 0, 0, 0, 0, 0],
};

// Multiplier per national-team tournament (level of opposition).
const NTMULT = { WC: 1.0, EURO: 1.0, COPA: 0.92, AFCON: 0.85, ASIAN: 0.70, GOLD: 0.65, '': 1.0 };

const eraIdx = y => Math.max(0, Math.min(LEAGUE_DECADES.length - 1, Math.floor((y - 1950) / 10)));
const leagueStrength = (lg, y) => (LEAGUE_ERA[lg] ? LEAGUE_ERA[lg][eraIdx(y)] : LEAGUE_DEFAULT);
const cupWeight = (uT, y) => (CUP_ERA[uT || ''] || CUP_ERA[''])[eraIdx(y)];
