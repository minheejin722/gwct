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

export const ysAllSuspendedPatterns = [
  /전체\s*도선\s*중단/i,
  /all\s*pilotage\s*suspended/i,
];

export const ysPartialSuspendedPatterns = [
  /도선\s*(중단|통제)/i,
  /pilotage\s*suspended/i,
  /운항\s*중지/i,
  /기상\s*통제/i,
];
