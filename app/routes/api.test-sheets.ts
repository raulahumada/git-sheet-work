import type { LoaderFunctionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import { getGoogleSheetsService } from '~/services/google-sheets.server';

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    console.log('🔍 Probando conexión con Google Sheets...');

    // Intentar obtener el servicio
    const sheetsService = getGoogleSheetsService();
    console.log('✅ Servicio de Google Sheets creado exitosamente');

    // Intentar acceder a la hoja (sin crear nada)
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID!;
    console.log('📋 SPREADSHEET_ID:', spreadsheetId);

    // Hacer una consulta simple para verificar acceso
    const { google } = await import('googleapis');
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL!,
        private_key: process.env.GOOGLE_SHEETS_PRIVATE_KEY!.replace(
          /\\n/g,
          '\n'
        ),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Intentar obtener información básica del spreadsheet
    const spreadsheetInfo = await sheets.spreadsheets.get({
      spreadsheetId: spreadsheetId,
    });

    console.log('✅ Conexión exitosa con Google Sheets');
    console.log(
      '📊 Título de la hoja:',
      spreadsheetInfo.data.properties?.title
    );
    console.log(
      '📑 Hojas disponibles:',
      spreadsheetInfo.data.sheets?.map((sheet) => sheet.properties?.title)
    );

    return json({
      success: true,
      message: 'Conexión exitosa con Google Sheets',
      spreadsheet: {
        id: spreadsheetId,
        title: spreadsheetInfo.data.properties?.title,
        sheets:
          spreadsheetInfo.data.sheets?.map(
            (sheet) => sheet.properties?.title
          ) || [],
        url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
      },
    });
  } catch (error: any) {
    console.error('❌ Error en diagnóstico de Google Sheets:', error);

    let errorDetails = 'Error desconocido';
    let suggestions: string[] = [];

    if (error?.code === 404) {
      errorDetails = 'Hoja de Google Sheets no encontrada';
      suggestions = [
        'Verifica que el SPREADSHEET_ID sea correcto',
        'Asegúrate de que la hoja no haya sido eliminada',
        'Verifica que tengas acceso a la hoja',
      ];
    } else if (error?.code === 403) {
      errorDetails = 'Sin permisos para acceder a la hoja';
      suggestions = [
        'Comparte la hoja con: ' + process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
        'Asegúrate de dar permisos de "Editor"',
        'Verifica que las credenciales sean correctas',
      ];
    } else if (error?.message?.includes('DECODER')) {
      errorDetails = 'Error en la clave privada';
      suggestions = [
        'Verifica el formato de GOOGLE_SHEETS_PRIVATE_KEY',
        'Asegúrate de que tenga \\n literales, no saltos de línea reales',
        'Regenera las credenciales en Google Cloud Console',
      ];
    } else if (error?.message?.includes('variables de entorno')) {
      errorDetails = 'Variables de entorno faltantes';
      suggestions = [
        'Configura GOOGLE_SHEETS_SPREADSHEET_ID',
        'Configura GOOGLE_SHEETS_CLIENT_EMAIL',
        'Configura GOOGLE_SHEETS_PRIVATE_KEY',
      ];
    }

    return json({
      success: false,
      error: errorDetails,
      suggestions,
      debugInfo: {
        hasSpreadsheetId: !!process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
        hasClientEmail: !!process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
        hasPrivateKey: !!process.env.GOOGLE_SHEETS_PRIVATE_KEY,
        spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
        clientEmail: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
        errorCode: error?.code,
        errorMessage: error?.message,
      },
    });
  }
}
