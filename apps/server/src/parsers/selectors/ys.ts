export const ysSelectors = {
  forecast: {
    tableRows: "tr",
    headerCell: "th.bg, td.bg",
    valueCell: "td.datatype1",
  },
  notice: {
    rows: "tr",
  },
};

export interface YsSignalPattern {
  label: string;
  pattern: RegExp;
}

export const ysSuspendSignalPatterns: YsSignalPattern[] = [
  { label: "전체 도선 중단", pattern: /전체\s*도선\s*중단/i },
  { label: "도선 중단", pattern: /도선\s*중단/i },
  { label: "기상 악화", pattern: /기상\s*악화/i },
  { label: "포트클로징", pattern: /(포트\s*클로징|PORT\s*CLOSING|PORTCLOSING)/i },
  { label: "항만 폐쇄", pattern: /항만\s*폐쇄/i },
  { label: "ALL PILOTAGE SUSPENDED", pattern: /ALL\s*PILOTAGE\s*SUSPENDED/i },
  { label: "PILOTAGE SUSPENDED", pattern: /PILOTAGE\s*SUSPENDED/i },
];

export const ysNormalSignalPatterns: YsSignalPattern[] = [
  { label: "1대기", pattern: /1\s*대기/i },
  { label: "2대기", pattern: /2\s*대기/i },
  { label: "OK", pattern: /\bO\s*\.?\s*K\b/i },
  { label: "휴가", pattern: /휴가/i },
  { label: "평시 배선", pattern: /(평시\s*배선|배선\s*평시)/i },
  { label: "대기 인원 표기", pattern: /\d+\s*대기/i },
];
