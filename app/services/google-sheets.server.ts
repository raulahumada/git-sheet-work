import { google } from 'googleapis';

interface CommitData {
  hash: string;
  message: string;
  author: string;
  date: string;
  files: string[];
  repositoryType?: 'app' | 'bd'; // Nuevo campo para tipo de repositorio
  color?: string; // Color para la fila en formato hexadecimal
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
   * Determinar el tipo de archivo basado en su extensión y tipo de repositorio
   */
  private getFileType(
    filename: string,
    repositoryType: 'app' | 'bd' = 'app'
  ): string {
    const extension = filename.toLowerCase().split('.').pop();
    const normalizedPath = filename.toLowerCase().replace(/\\/g, '/');

    // Para repositorios de Base de Datos
    if (repositoryType === 'bd') {
      if (extension === 'sql') {
        if (normalizedPath.includes('/datamanipulation/')) {
          return 'DML (Data Manipulation Language)';
        } else if (normalizedPath.includes('/datadefinition/')) {
          return 'DDL (Data Definition Language)';
        } else {
          return 'Archivo SQL (.sql)';
        }
      }

      // Tipos específicos de BD
      switch (extension) {
        case 'pkb':
          return 'Package Body (.pkb)';
        case 'pks':
          return 'Package Specification (.pks)';
        case 'prc':
          return 'Stored Procedure (.prc)';
        case 'fnc':
          return 'Function (.fnc)';
        case 'trg':
          return 'Trigger (.trg)';
        case 'vw':
          return 'View (.vw)';
        default:
          return `BD - Otro (.${extension || 'sin extensión'})`;
      }
    }

    // Para repositorios de Aplicación (comportamiento original)
    if (extension === 'sql') {
      return 'Archivo SQL (.sql)';
    }

    switch (extension) {
      case 'aspx':
        return 'Página ASPX (.aspx)';
      case 'resx':
        return 'Hoja de Recurso (.resx)';
      case 'vbproj':
        return 'Proyecto VB (.vbproj)';
      case 'dll':
        return 'Componente (DLL) (.dll)';
      case 'rpt':
        return 'Reporte (RPT) (.rpt)';
      case 'vb':
        return 'Clase (.vb)';

      default:
        return `App - Otro (.${extension || 'sin extensión'})`;
    }
  }

  /**
   * Convertir color hex a RGB para Google Sheets
   */
  private hexToRgb(hex: string) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          red: parseInt(result[1], 16) / 255,
          green: parseInt(result[2], 16) / 255,
          blue: parseInt(result[3], 16) / 255,
        }
      : { red: 0.3, green: 0.8, blue: 0.77 }; // Color por defecto
  }

  /**
   * Obtener el ID de la hoja "Commits"
   */
  private async getCommitsSheetId(): Promise<number> {
    try {
      const response = await this.sheets.spreadsheets.get({
        spreadsheetId: this.spreadsheetId,
      });

      const commitsSheet = response.data.sheets?.find(
        (sheet) => sheet.properties?.title === 'Commits'
      );

      return commitsSheet?.properties?.sheetId ?? 0;
    } catch (error) {
      console.warn(
        'No se pudo obtener el ID de la hoja Commits, usando 0 por defecto'
      );
      return 0;
    }
  }

  /**
   * Agregar un nuevo commit a la hoja de Google Sheets
   * Crea una fila por cada archivo modificado y aplica color de fondo
   */
  async addCommit(commitData: CommitData): Promise<void> {
    try {
      const values: string[][] = [];
      const repositoryType = commitData.repositoryType || 'app';

      // Si no hay archivos, crear al menos una fila con el commit
      if (commitData.files.length === 0) {
        values.push([
          commitData.hash,
          commitData.message,
          commitData.author,
          commitData.date,
          '(sin archivos)',
          'N/A',
          repositoryType === 'app' ? 'Aplicación' : 'Base de Datos',
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
            this.getFileType(file, repositoryType),
            repositoryType === 'app' ? 'Aplicación' : 'Base de Datos',
            new Date().toISOString(), // Timestamp de cuándo se registró
          ]);
        });
      }

      // Primero obtener el número de filas existentes para saber dónde empezar
      const existingResponse = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: 'Commits!A:A',
      });

      const existingRowCount = existingResponse.data.values?.length || 1;
      const startRowIndex = existingRowCount; // 0-based index donde empezarán las nuevas filas
      const endRowIndex = startRowIndex + values.length;

      // Agregar los valores
      await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: 'Commits!A:H',
        valueInputOption: 'RAW',
        requestBody: {
          values,
        },
      });

      // Aplicar color de fondo si se proporciona
      if (commitData.color && commitData.color !== '#FFFFFF') {
        try {
          const rgbColor = this.hexToRgb(commitData.color);
          const sheetId = await this.getCommitsSheetId();

          await this.sheets.spreadsheets.batchUpdate({
            spreadsheetId: this.spreadsheetId,
            requestBody: {
              requests: [
                {
                  repeatCell: {
                    range: {
                      sheetId: sheetId,
                      startRowIndex: startRowIndex,
                      endRowIndex: endRowIndex,
                      startColumnIndex: 0,
                      endColumnIndex: 8, // Columnas A-H
                    },
                    cell: {
                      userEnteredFormat: {
                        backgroundColor: rgbColor,
                      },
                    },
                    fields: 'userEnteredFormat.backgroundColor',
                  },
                },
              ],
            },
          });
        } catch (formatError) {
          console.warn(
            'No se pudo aplicar el color, pero el commit se guardó correctamente:',
            formatError
          );
          // No lanzar error, el commit ya se guardó exitosamente
        }
      }

      console.log(
        `Commit ${commitData.hash} del repositorio ${
          repositoryType === 'app' ? 'Aplicación' : 'Base de Datos'
        } agregado a Google Sheets con ${
          values.length
        } filas (una por archivo)${
          commitData.color ? ` con color ${commitData.color}` : ''
        }`
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
        'Repositorio',
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
        range: 'Commits!A1:H1',
      });

      if (!response.data.values || response.data.values.length === 0) {
        // Agregar headers si no existen
        await this.sheets.spreadsheets.values.update({
          spreadsheetId: this.spreadsheetId,
          range: 'Commits!A1:H1',
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
        range: 'Commits!A2:H', // Ajustado para incluir la nueva columna
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
        const repositoryTypeText = row[6] || 'Aplicación';
        const repositoryType =
          repositoryTypeText === 'Base de Datos' ? 'bd' : 'app';

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
            repositoryType,
          });
        }
      });

      return Array.from(commitsMap.values());
    } catch (error) {
      console.error('Error al obtener commits de Google Sheets:', error);
      throw new Error('No se pudieron obtener los commits de Google Sheets');
    }
  }

  /**
   * Crear una hoja con archivos únicos a partir de la hoja de commits
   * Elimina duplicados cuando el mismo archivo aparece en múltiples commits
   */
  async createUniqueFilesSheet(): Promise<void> {
    try {
      // Obtener todos los datos de la hoja de commits
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: 'Commits!A2:H',
      });

      if (!response.data.values) {
        throw new Error('No hay datos en la hoja de commits para procesar');
      }

      // Mapa para almacenar archivos únicos con su información más reciente
      const uniqueFilesMap = new Map<
        string,
        {
          file: string;
          fileType: string;
          repositoryType: string;
          lastCommitHash: string;
          lastCommitMessage: string;
          lastCommitAuthor: string;
          lastCommitDate: string;
          commitCount: number;
          firstCommitDate: string;
        }
      >();

      // Procesar cada fila para encontrar archivos únicos
      response.data.values.forEach((row: string[]) => {
        const hash = row[0] || '';
        const message = row[1] || '';
        const author = row[2] || '';
        const date = row[3] || '';
        const file = row[4] || '';
        const fileType = row[5] || '';
        const repositoryType = row[6] || 'Aplicación';

        // Saltear filas sin archivo o con archivos especiales
        if (!file || file === '(sin archivos)') {
          return;
        }

        // Crear clave única combinando archivo y tipo de repositorio
        const fileKey = `${file}|${repositoryType}`;

        if (uniqueFilesMap.has(fileKey)) {
          // Si el archivo ya existe, actualizar con la información más reciente
          const existing = uniqueFilesMap.get(fileKey)!;

          // Comparar fechas para determinar cuál es más reciente
          const existingDate = new Date(existing.lastCommitDate);
          const currentDate = new Date(date);

          if (currentDate > existingDate) {
            existing.lastCommitHash = hash;
            existing.lastCommitMessage = message;
            existing.lastCommitAuthor = author;
            existing.lastCommitDate = date;
          }

          // Incrementar contador de commits
          existing.commitCount++;

          // Actualizar primera fecha si es anterior
          const firstDate = new Date(existing.firstCommitDate);
          if (currentDate < firstDate) {
            existing.firstCommitDate = date;
          }
        } else {
          // Nuevo archivo único
          uniqueFilesMap.set(fileKey, {
            file,
            fileType,
            repositoryType,
            lastCommitHash: hash,
            lastCommitMessage: message,
            lastCommitAuthor: author,
            lastCommitDate: date,
            commitCount: 1,
            firstCommitDate: date,
          });
        }
      });

      // Crear o limpiar la hoja "Archivos Únicos"
      const sheetName = 'Archivos Únicos';

      try {
        // Verificar si la hoja existe
        await this.sheets.spreadsheets.values.get({
          spreadsheetId: this.spreadsheetId,
          range: `${sheetName}!A1:A1`,
        });

        // Si existe, limpiar el contenido
        await this.sheets.spreadsheets.values.clear({
          spreadsheetId: this.spreadsheetId,
          range: `${sheetName}!A:I`,
        });
      } catch (error) {
        // Si la hoja no existe, crearla
        const err = error as { code?: number; message?: string };
        if (
          err?.code === 400 &&
          err?.message?.includes('Unable to parse range')
        ) {
          console.log(`Creando hoja "${sheetName}"...`);
          await this.sheets.spreadsheets.batchUpdate({
            spreadsheetId: this.spreadsheetId,
            requestBody: {
              requests: [
                {
                  addSheet: {
                    properties: {
                      title: sheetName,
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

      // Preparar los datos para la nueva hoja
      const headers = [
        'Archivo',
        'Tipo de Archivo',
        'Repositorio',
        'Último Commit Hash',
        'Último Commit Mensaje',
        'Último Commit Autor',
        'Última Fecha de Modificación',
        'Primera Fecha de Modificación',
        'Número de Commits que lo Tocaron',
      ];

      const values = [headers];

      // Convertir el mapa a filas ordenadas por repositorio y luego por archivo
      const sortedFiles = Array.from(uniqueFilesMap.values()).sort((a, b) => {
        // Primero ordenar por repositorio
        if (a.repositoryType !== b.repositoryType) {
          return a.repositoryType.localeCompare(b.repositoryType);
        }
        // Luego por nombre de archivo
        return a.file.localeCompare(b.file);
      });

      sortedFiles.forEach((fileInfo) => {
        values.push([
          fileInfo.file,
          fileInfo.fileType,
          fileInfo.repositoryType,
          fileInfo.lastCommitHash,
          fileInfo.lastCommitMessage,
          fileInfo.lastCommitAuthor,
          fileInfo.lastCommitDate,
          fileInfo.firstCommitDate,
          fileInfo.commitCount.toString(),
        ]);
      });

      // Escribir los datos en la nueva hoja
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!A1:I${values.length}`,
        valueInputOption: 'RAW',
        requestBody: {
          values,
        },
      });

      console.log(
        `Hoja "${sheetName}" creada con ${sortedFiles.length} archivos únicos`
      );
    } catch (error) {
      console.error('Error al crear la hoja de archivos únicos:', error);
      throw new Error('No se pudo crear la hoja de archivos únicos');
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

// Función para generar URL de Google Sheets
export function getGoogleSheetsUrl(): string {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;

  if (!spreadsheetId) {
    return '#';
  }

  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
}

// Función para obtener configuración de Google Sheets
export function getGoogleSheetsConfig() {
  return {
    spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID || '',
    hasConfig: !!(
      process.env.GOOGLE_SHEETS_SPREADSHEET_ID &&
      process.env.GOOGLE_SHEETS_CLIENT_EMAIL &&
      process.env.GOOGLE_SHEETS_PRIVATE_KEY
    ),
    url: getGoogleSheetsUrl(),
  };
}

export type { CommitData, SheetsConfig };
