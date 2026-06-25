/**
 * Google Drive API integration
 * Fase 8 — gestió documental
 */

export interface DriveFile {
  id: string
  name: string
  mimeType: string
  size: number
  webViewLink: string
  webContentLink: string
  parents?: string[]
  createdTime: string
}

// Fase 8: implementar pujada i organització de fitxers
export async function uploadFileToDrive(
  _file: Buffer,
  _fileName: string,
  _mimeType: string,
  _folderId: string
): Promise<DriveFile> {
  throw new Error('Google Drive no implementat fins a Fase 8')
}

export async function createFolderInDrive(
  _name: string,
  _parentId?: string
): Promise<string> {
  throw new Error('Google Drive no implementat fins a Fase 8')
}

export async function deleteFileFromDrive(_fileId: string): Promise<void> {
  throw new Error('Google Drive no implementat fins a Fase 8')
}

/**
 * Genera la ruta de carpetes per a un document de client:
 * CLIENTS / Nom Client / Any / Cita YYYY-MM-DD - Tema / document
 */
export function buildDrivePath(
  clientName: string,
  year: number,
  appointmentDate: string,
  topic: string
): string {
  return `CLIENTS/${clientName}/${year}/Cita ${appointmentDate} - ${topic}`
}
