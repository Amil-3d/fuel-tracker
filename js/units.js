// Unit conversion and formatting. Storage is always metric; these only affect display/input.
export const LB_PER_KG = 2.20462262;

export const kgToLb = (kg) => kg * LB_PER_KG;
export const lbToKg = (lb) => lb / LB_PER_KG;

export function cmToFtIn(cm) {
  const total = Math.round(cm / 2.54);
  return { ft: Math.floor(total / 12), inch: total % 12 };
}

export const ftInToCm = (ft, inch) => (ft * 12 + inch) * 2.54;

export const weightUnit = (units) => (units === 'imperial' ? 'lb' : 'kg');

// kg -> number in the user's unit, rounded to 1 decimal.
export function toDisplayWeight(kg, units) {
  const v = units === 'imperial' ? kgToLb(kg) : kg;
  return Math.round(v * 10) / 10;
}

// number in the user's unit -> kg
export function fromDisplayWeight(value, units) {
  return units === 'imperial' ? lbToKg(value) : value;
}

export function fmtWeight(kg, units, digits = 1) {
  const v = units === 'imperial' ? kgToLb(kg) : kg;
  return `${v.toFixed(digits)} ${weightUnit(units)}`;
}

export function fmtHeight(cm, units) {
  if (units === 'imperial') {
    const { ft, inch } = cmToFtIn(cm);
    return `${ft}′ ${inch}″`;
  }
  return `${Math.round(cm)} cm`;
}

// Weekly rate, e.g. "1.0 lb/week"
export function fmtRate(kgPerWeek, units, digits = 1) {
  return `${fmtWeight(kgPerWeek, units, digits)}/week`;
}
