export const ysSelectors = {
  forecast: {
    tableRows: "tr",
    headerCell: "th.bg, td.bg",
    valueCell: "td.datatype1",
  },
  board: {
    rows: "tr",
    cells: "td",
  },
};

export interface YsSignalPattern {
  label: string;
  pattern: RegExp;
}

export const ysSuspendSignalPatterns: YsSignalPattern[] = [
  { label: "전체 도선 중단", pattern: /전체\s*도선\s*중단/i },
  { label: "전면 도선 중단", pattern: /전면\s*도선\s*중단/i },
  { label: "도선 중단", pattern: /도선\s*중단/i },
  { label: "도선업무 중단", pattern: /도선\s*업무\s*중단/i },
  { label: "도선 불가", pattern: /도선\s*(불가|정지)/i },
  { label: "기상 악화", pattern: /기상\s*악화/i },
  { label: "기상 불량", pattern: /기상\s*불량/i },
  { label: "포트클로징", pattern: /(포트\s*클로(징|즈)|PORT\s*CLOS(ING|ED|E)|PORTCLOSING|PORTCLOSED)/i },
  { label: "항만 폐쇄", pattern: /항만\s*(폐쇄|통제)/i },
  { label: "입출항 통제", pattern: /(입출항|입항|출항)\s*(통제|제한)/i },
  { label: "ALL PILOTAGE SUSPENDED", pattern: /ALL\s*PILOTAGE\s*SUSPENDED/i },
  { label: "PILOTAGE SUSPENDED", pattern: /PILOTAGE\s*SUSPENDED/i },
  { label: "PORT CLOSED", pattern: /PORT\s*CLOSED/i },
  { label: "HARBOR CLOSED", pattern: /HARB(?:O|OU)R\s*CLOSED/i },
];

export const ysNormalSignalPatterns: YsSignalPattern[] = [
  { label: "1대기", pattern: /1\s*대기/i },
  { label: "2대기", pattern: /2\s*대기/i },
  { label: "OK", pattern: /\bO\s*\.?\s*K\b/i },
  { label: "휴가", pattern: /휴가/i },
  { label: "평시 배선", pattern: /(평시\s*배선|배선\s*평시)/i },
  { label: "대기 인원 표기", pattern: /\d+\s*대기/i },
  { label: "도선 재개", pattern: /도선\s*재개/i },
  { label: "업무 재개", pattern: /업무\s*재개/i },
  { label: "정상 운영", pattern: /(정상\s*운영|운영\s*정상)/i },
  { label: "정상 배선", pattern: /(정상\s*배선|배선\s*정상)/i },
  { label: "PORT OPEN", pattern: /PORT\s*OPEN/i },
];
