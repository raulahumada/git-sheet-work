import { useFetcher } from '@remix-run/react';
import { Button } from '~/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/card';
import { Upload, RefreshCw, FileSpreadsheet } from 'lucide-react';

interface FetcherData {
  success?: boolean;
  error?: string;
  message?: string;
}

interface ConfigurationCardProps {
  isLoading: boolean;
}

export function ConfigurationCard({ isLoading }: ConfigurationCardProps) {
  const initSheetsFetcher = useFetcher<FetcherData>();
  const uniqueFilesFetcher = useFetcher<FetcherData>();

  const handleInitializeSheets = () => {
    const formData = new FormData();
    formData.append('action', 'initialize-sheets');

    initSheetsFetcher.submit(formData, {
      method: 'POST',
      action: '/api/commit',
    });
  };

  const handleCreateUniqueFilesSheet = () => {
    const formData = new FormData();
    formData.append('action', 'create-unique-files-sheet');

    uniqueFilesFetcher.submit(formData, {
      method: 'POST',
      action: '/api/commit',
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Configuración inicial
        </CardTitle>
        <CardDescription>
          Inicializa la hoja de Google Sheets y genera reportes de archivos
          únicos
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Botón para inicializar Google Sheets */}
        <div>
          <Button
            onClick={handleInitializeSheets}
            disabled={isLoading || initSheetsFetcher.state === 'submitting'}
            className="w-full"
          >
            {initSheetsFetcher.state === 'submitting' ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Inicializando...
              </>
            ) : (
              'Inicializar Google Sheets'
            )}
          </Button>

          {/* Mensaje de éxito de inicialización */}
          {initSheetsFetcher.data && initSheetsFetcher.data.success && (
            <div className="text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/30 p-3 rounded-md border border-green-200 dark:border-green-800 mt-3">
              ✅{' '}
              {initSheetsFetcher.data.message ||
                'Hoja de Google Sheets inicializada correctamente'}
            </div>
          )}

          {/* Mensaje de error de inicialización */}
          {initSheetsFetcher.data &&
            !initSheetsFetcher.data.success &&
            initSheetsFetcher.data.error && (
              <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 p-3 rounded-md border border-red-200 dark:border-red-800 mt-3">
                ❌ No se pudo inicializar Google Sheets. Verifica la
                configuración e inténtalo de nuevo.
              </div>
            )}
        </div>

        {/* Botón para crear hoja de archivos únicos */}
        <div>
          <Button
            onClick={handleCreateUniqueFilesSheet}
            disabled={isLoading || uniqueFilesFetcher.state === 'submitting'}
            className="w-full"
            variant="outline"
          >
            {uniqueFilesFetcher.state === 'submitting' ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Generando hoja de archivos únicos...
              </>
            ) : (
              <>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Crear hoja de archivos únicos
              </>
            )}
          </Button>

          {/* Mensaje de éxito para archivos únicos */}
          {uniqueFilesFetcher.data && uniqueFilesFetcher.data.success && (
            <div className="text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/30 p-3 rounded-md border border-green-200 dark:border-green-800 mt-3">
              ✅{' '}
              {uniqueFilesFetcher.data.message ||
                'Hoja de archivos únicos creada correctamente'}
            </div>
          )}

          {/* Mensaje de error para archivos únicos */}
          {uniqueFilesFetcher.data &&
            !uniqueFilesFetcher.data.success &&
            uniqueFilesFetcher.data.error && (
              <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 p-3 rounded-md border border-red-200 dark:border-red-800 mt-3">
                ❌{' '}
                {uniqueFilesFetcher.data.error ||
                  'No se pudo crear la hoja de archivos únicos'}
              </div>
            )}
        </div>
      </CardContent>
    </Card>
  );
}
