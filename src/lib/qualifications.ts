export type Qualification =
  | "labor"
  | "lager"
  | "messwarte"
  | "b_schein_verantwortlich"
  | "anlagenfahrer";

export const QUALIFICATIONS: Qualification[] = [
  "labor",
  "lager",
  "messwarte",
  "b_schein_verantwortlich",
  "anlagenfahrer",
];

export const qualificationLabels: Record<Qualification, string> = {
  labor: "Labor",
  lager: "Lager",
  messwarte: "Messwarte",
  b_schein_verantwortlich: "B-Schein",
  anlagenfahrer: "Anlagenfahrer",
};

/** Schichtgruppen im Rotationsbetrieb. */
export type RotationTeam = "A" | "B" | "C" | "D";
export const ROTATION_TEAMS: RotationTeam[] = ["A", "B", "C", "D"];
