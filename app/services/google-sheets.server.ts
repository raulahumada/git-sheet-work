import { google } from 'googleapis';

interface CommitData {
  hash: string;
  message: string;
  author: string;
  date: string;
  files: string[];
}

interface SheetsConfig {
  spreadsheetId: string;
  credentials: {
    client_email: string;
    private_key: string;
  };
}

class GoogleSheetsService {
  private sheets;
  private auth;
  private spreadsheetId: string;

  constructor(config: SheetsConfig) {
    this.spreadsheetId = config.spreadsheetId;

    // Limpiar y formatear la clave privada
    let privateKey = config.credentials.private_key;

    // Remover comillas si existen
    privateKey = privateKey.replace(/^"|"$/g, '');

    // Asegurar que los \n estén correctamente convertidos
    privateKey = privateKey.replace(/\\n/g, '\n');

    // Verificar que la clave tenga el formato correcto
    if (
      !privateKey.includes('-----BEGIN PRIVATE KEY-----') ||
      !privateKey.includes('-----END PRIVATE KEY-----')
    ) {
      throw new Error(
        'La clave privada no tiene el formato correcto. Debe incluir -----BEGIN PRIVATE KEY----- y -----END PRIVATE KEY-----'
      );
    }

    // Configurar autenticación con service account
    this.auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: config.credentials.client_email,
        private_key: privateKey,
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    this.sheets = google.sheets({ version: 'v4', auth: this.auth });
  }

  /**
   * Determinar el tipo de archivo basado en su extensión
   */
  private getFileType(filename: string): string {
    const extension = filename.toLowerCase().split('.').pop();

    switch (extension) {
      case 'aspx':
        return 'Página ASPX (.aspx)';
      case 'resx':
        return 'Hoja de Recurso (.resx)';
      case 'dll':
        return 'Componente (DLL) (.dll)';
      case 'rpt':
        return 'Reporte (RPT) (.rpt)';
      case 'vb':
        return 'Clase (.vb)';
      default:
        return `Otro (.${extension || 'sin extensión'})`;
    }
  }

  /**
   * Agregar un nuevo commit a la hoja de Google Sheets
   * Crea una fila por cada archivo modificado
   */
  async addCommit(commitData: CommitData): Promise<void> {
    try {
      const values: string[][] = [];

      // Si no hay archivos, crear al menos una fila con el commit
      if (commitData.files.length === 0) {
        values.push([
          commitData.hash,
          commitData.message,
          commitData.author,
          commitData.date,
          '(sin archivos)',
          'N/A',
          new Date().toISOString(), // Timestamp de cuándo se registró
        ]);
      } else {
        // Crear una fila por cada archivo
        commitData.files.forEach((file) => {
          values.push([
            commitData.hash,
            commitData.message,
            commitData.author,
            commitData.date,
            file,
            this.getFileType(file),
            new Date().toISOString(), // Timestamp de cuándo se registró
          ]);
        });
      }

      await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: 'Commits!A:G', // Ajustado para incluir la nueva columna
        valueInputOption: 'RAW',
        requestBody: {
          values,
        },
      });

      console.log(
        `Commit ${commitData.hash} agregado a Google Sheets con ${values.length} filas (una por archivo)`
      );
    } catch (error) {
      console.error('Error al agregar commit a Google Sheets:', error);
      throw new Error('No se pudo agregar el commit a Google Sheets');
    }
  }

  /**
   * Crear los headers de la hoja si no existen
   */
  async initializeSheet(): Promise<void> {
    try {
      const headers = [
        'Hash del Commit',
        'Mensaje',
        'Autor',
        'Fecha del Commit',
        'Archivo Modificado',
        'Tipo de Archivo',
        'Timestamp de Registro',
      ];

      // Primero verificar si la hoja "Commits" existe
      try {
        await this.sheets.spreadsheets.values.get({
          spreadsheetId: this.spreadsheetId,
          range: 'Commits!A1:A1',
        });
      } catch (error) {
        // Si la hoja no existe, crearla
        const err = error as { code?: number; message?: string };
        if (
          err?.code === 400 &&
          err?.message?.includes('Unable to parse range')
        ) {
          console.log('Creando hoja "Commits"...');
          await this.sheets.spreadsheets.batchUpdate({
            spreadsheetId: this.spreadsheetId,
            requestBody: {
              requests: [
                {
                  addSheet: {
                    properties: {
                      title: 'Commits',
                    },
                  },
                },
              ],
            },
          });
        } else {
          throw error;
        }
      }

      // Verificar si ya existen headers
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: 'Commits!A1:G1',
      });

      if (!response.data.values || response.data.values.length === 0) {
        // Agregar headers si no existen
        await this.sheets.spreadsheets.values.update({
          spreadsheetId: this.spreadsheetId,
          range: 'Commits!A1:G1',
          valueInputOption: 'RAW',
          requestBody: {
            values: [headers],
          },
        });

        console.log('Headers inicializados en Google Sheets');
      } else {
        console.log('Headers ya existen en Google Sheets');
      }
    } catch (error) {
      console.error('Error al inicializar la hoja:', error);

      // Proporcionar más detalles del error
      let errorMessage = 'No se pudo inicializar la hoja de Google Sheets';

      const err = error as { code?: number; message?: string };
      if (err?.code === 403) {
        errorMessage =
          'No tienes permisos para acceder a la hoja de Google Sheets. Verifica que hayas compartido la hoja con la service account.';
      } else if (err?.code === 404) {
        errorMessage =
          'La hoja de Google Sheets no fue encontrada. Verifica el SPREADSHEET_ID en tu archivo .env';
      } else if (err?.message) {
        errorMessage = `Error de Google Sheets: ${err.message}`;
      }

      throw new Error(errorMessage);
    }
  }

  /**
   * Obtener todos los commits registrados
   * Agrupa las filas por hash de commit para reconstruir la estructura original
   */
  async getCommits(): Promise<CommitData[]> {
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: 'Commits!A2:G', // Omitir headers
      });

      if (!response.data.values) {
        return [];
      }

      // Agrupar por hash de commit
      const commitsMap = new Map<string, CommitData>();

      response.data.values.forEach((row: string[]) => {
        const hash = row[0] || '';
        const message = row[1] || '';
        const author = row[2] || '';
        const date = row[3] || '';
        const file = row[4] || '';
        // const type = row[5] || ''; // Tipo de archivo (no necesario para la reconstrucción)

        if (commitsMap.has(hash)) {
          // Si el commit ya existe, agregar el archivo a la lista
          const existingCommit = commitsMap.get(hash)!;
          if (file && file !== '(sin archivos)') {
            existingCommit.files.push(file);
          }
        } else {
          // Crear nuevo commit
          commitsMap.set(hash, {
            hash,
            message,
            author,
            date,
            files: file && file !== '(sin archivos)' ? [file] : [],
          });
        }
      });

      return Array.from(commitsMap.values());
    } catch (error) {
      console.error('Error al obtener commits de Google Sheets:', error);
      throw new Error('No se pudieron obtener los commits de Google Sheets');
    }
  }
}

// Instancia singleton del servicio
let googleSheetsService: GoogleSheetsService | null = null;

export function getGoogleSheetsService(): GoogleSheetsService {
  if (!googleSheetsService) {
    const config: SheetsConfig = {
      spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID!,
      credentials: {
        client_email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL!,
        private_key: process.env.GOOGLE_SHEETS_PRIVATE_KEY!,
      },
    };

    if (
      !config.spreadsheetId ||
      !config.credentials.client_email ||
      !config.credentials.private_key
    ) {
      throw new Error('Faltan variables de entorno para Google Sheets');
    }

    googleSheetsService = new GoogleSheetsService(config);
  }

  return googleSheetsService;
}

export type { CommitData, SheetsConfig };
