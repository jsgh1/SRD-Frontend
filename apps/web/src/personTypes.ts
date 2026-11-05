export const documents: Record<string, string> = {
  RC: "Registro Civil",
  TI: "Tarjeta de Identidad",
  CC: "Cédula de Ciudadanía",
  CE: "Cédula de Extranjería",
  NIT: "NIT",
};
export const genders: Record<string, string> = {
  male: "Masculino",
  female: "Femenino",
  other: "Otro",
};
export const positions: Record<string, string> = {
  president: "Presidente",
  vicepresident: "Vicepresidente",
  secretary: "Secretario",
  treasurer: "Tesorero",
  fiscal: "Fiscal",
  other: "Otro",
};
export type Person = Record<string, any> & {
  id: string;
  first_names: string;
  last_names: string;
  document_type: string;
  document_number: string;
  status: string;
  version: number;
};
