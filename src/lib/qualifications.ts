export type Qualification = "labor" | "lager" | "messwarte" | "labor_b_schein" | "anlagenfahrer";

export const QUALIFICATIONS: Qualification[] = [
  "labor",
  "lager",
  "messwarte",
  "labor_b_schein",
  "anlagenfahrer",
];

export const qualificationLabels: Record<Qualification, string> = {
  labor: "Labor",
  lager: "Lager",
  messwarte: "Messwarte",
  labor_b_schein: "Labor mit B-Schein",
  anlagenfahrer: "Anlagenfahrer",
};
