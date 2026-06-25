/**
 * Google Sheets API integration
 * Fase 7 — base de dades externa de clients
 */

export interface SheetRow {
  [key: string]: string | number | boolean | null
}

// Capçaleres del full de clients
export const CLIENT_SHEET_HEADERS = [
  'ID',
  'Nom',
  'Empresa',
  'Telèfon',
  'Email',
  'NIF/CIF',
  'Responsable intern',
  'Notes',
  'Data creació',
  'Origen',
]

// Fase 7: implementar sincronització real
export async function appendClientToSheet(
  _spreadsheetId: string,
  _clientData: SheetRow
): Promise<void> {
  throw new Error('Google Sheets no implementat fins a Fase 7')
}

export async function updateClientInSheet(
  _spreadsheetId: string,
  _rowIndex: number,
  _clientData: SheetRow
): Promise<void> {
  throw new Error('Google Sheets no implementat fins a Fase 7')
}

export async function findClientRowByEmail(
  _spreadsheetId: string,
  _email: string
): Promise<number | null> {
  throw new Error('Google Sheets no implementat fins a Fase 7')
}
