import { useFetcher } from '@remix-run/react';
import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from './ui/card';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Separator } from './ui/separator';
import {
  FileSpreadsheet,
  RefreshCw,
  Check,
  AlertCircle,
  Clock,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';

interface GoogleSheetsSyncProps {
  gitPath?: string;
  isEnabled?: boolean;
}

interface FetcherData {
  success?: boolean;
  message?: string;
  error?: string;
  commits?: Array<{
    hash: string;
    message: string;
    author: string;
    date: string;
    files: string[];
  }>;
}

export function GoogleSheetsSync({
  gitPath,
  isEnabled = true,
}: GoogleSheetsSyncProps) {
  const fetcher = useFetcher<FetcherData>();
  const [commitHash, setCommitHash] = useState('');
  const [isInitialized, setIsInitialized] = useState(false);

  // Estados derivados
  const isLoading = fetcher.state !== 'idle';
  const isSuccessful = fetcher.data?.success === true;

  // Efecto para manejar respuestas del servidor
  useEffect(() => {
    if (fetcher.data?.success) {
      toast.success(fetcher.data.message || 'Operación completada', {
        duration: 4000,
      });

      // Si se inicializó la hoja, marcar como inicializada
      if (fetcher.data.message?.includes('inicializada')) {
        setIsInitialized(true);
      }

      // Limpiar el hash después de sincronizar
      if (fetcher.data.message?.includes('sincronizado')) {
        setCommitHash('');
      }
    }

    if (fetcher.data?.error) {
      toast.error(fetcher.data.error, {
        duration: 6000,
      });
    }
  }, [fetcher.data]);

  const handleInitializeSheets = () => {
    fetcher.submit(
      { action: 'initialize-sheets' },
      { method: 'post', action: '/api/commit' }
    );
  };

  const handleSyncLastCommit = () => {
    fetcher.submit(
      { action: 'sync-last-commit' },
      { method: 'post', action: '/api/commit' }
    );
  };

  const handleSyncSpecificCommit = () => {
    if (!commitHash.trim()) {
      toast.error('Por favor ingresa un hash de commit válido');
      return;
    }

    fetcher.submit(
      {
        action: 'sync-commit',
        commitHash: commitHash.trim(),
      },
      { method: 'post', action: '/api/commit' }
    );
  };

  const handleGetSheetsCommits = () => {
    fetcher.submit(
      { action: 'get-sheets-commits' },
      { method: 'post', action: '/api/commit' }
    );
  };

  if (!isEnabled) {
    return (
      <Card className="border-border/40 shadow-sm opacity-50">
        <CardHeader className="pb-4">
          <div className="flex items-center space-x-2">
            <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg font-light">
              Sincronización con Google Sheets
            </CardTitle>
            <Badge variant="secondary" className="text-xs">
              No disponible
            </Badge>
          </div>
          <CardDescription className="text-muted-foreground">
            Selecciona un repositorio git para habilitar la sincronización
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="border-border/40 shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <FileSpreadsheet className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <CardTitle className="text-lg font-light">
              Sincronización con Google Sheets
            </CardTitle>
            {isSuccessful && (
              <Badge
                variant="secondary"
                className="text-green-700 dark:text-green-300"
              >
                <Check className="mr-1 h-3 w-3" />
                Sincronizado
              </Badge>
            )}
          </div>

          {gitPath && (
            <a
              href="https://sheets.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
        </div>
        <CardDescription className="text-muted-foreground">
          Sincroniza automáticamente los commits con tu hoja de Google Sheets
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Inicialización */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Configuración inicial</Label>
            {isInitialized && (
              <Badge
                variant="outline"
                className="text-xs text-green-700 dark:text-green-300"
              >
                <Check className="mr-1 h-3 w-3" />
                Configurado
              </Badge>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <Button
              onClick={handleInitializeSheets}
              disabled={isLoading}
              variant="outline"
              size="sm"
              className="flex-1"
            >
              {isLoading &&
              fetcher.formData?.get('action') === 'initialize-sheets' ? (
                <>
                  <Clock className="mr-2 h-4 w-4 animate-spin" />
                  Configurando...
                </>
              ) : (
                <>
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  Configurar Hoja
                </>
              )}
            </Button>

            <Button
              onClick={handleGetSheetsCommits}
              disabled={isLoading}
              variant="outline"
              size="sm"
            >
              {isLoading &&
              fetcher.formData?.get('action') === 'get-sheets-commits' ? (
                <Clock className="h-4 w-4 animate-spin" />
              ) : (
                'Ver Datos'
              )}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Configura la hoja con los headers necesarios para el registro de
            commits
          </p>
        </div>

        <Separator />

        {/* Sincronización de commits */}
        <div className="space-y-4">
          <Label className="text-sm font-medium">Sincronización manual</Label>

          {/* Último commit */}
          <div className="space-y-2">
            <Button
              onClick={handleSyncLastCommit}
              disabled={isLoading}
              variant="default"
              size="sm"
              className="w-full"
            >
              {isLoading &&
              fetcher.formData?.get('action') === 'sync-last-commit' ? (
                <>
                  <Clock className="mr-2 h-4 w-4 animate-spin" />
                  Sincronizando último commit...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Sincronizar último commit
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground">
              Envía el último commit del repositorio a Google Sheets
            </p>
          </div>

          {/* Commit específico */}
          <div className="space-y-2">
            <div className="flex space-x-2">
              <Input
                placeholder="Hash del commit (ej: a1b2c3d...)"
                value={commitHash}
                onChange={(e) => setCommitHash(e.target.value)}
                className="flex-1 font-mono text-sm"
                disabled={isLoading}
              />
              <Button
                onClick={handleSyncSpecificCommit}
                disabled={isLoading || !commitHash.trim()}
                variant="outline"
                size="sm"
              >
                {isLoading &&
                fetcher.formData?.get('action') === 'sync-commit' ? (
                  <Clock className="h-4 w-4 animate-spin" />
                ) : (
                  'Sincronizar'
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Sincroniza un commit específico usando su hash
            </p>
          </div>
        </div>

        {/* Información de estado */}
        {fetcher.data?.commits && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">Estado de la hoja</Label>
            <div className="flex items-center space-x-2">
              <Badge variant="outline" className="text-xs">
                {fetcher.data.commits.length} commits registrados
              </Badge>
              <span className="text-xs text-muted-foreground">
                en Google Sheets
              </span>
            </div>
          </div>
        )}

        {/* Advertencia sobre configuración */}
        {fetcher.data?.error?.includes('variables de entorno') && (
          <div className="flex items-start space-x-2 p-3 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-md">
            <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
            <div className="space-y-1">
              <p className="text-sm text-yellow-800 dark:text-yellow-200 font-medium">
                Configuración requerida
              </p>
              <p className="text-xs text-yellow-700 dark:text-yellow-300">
                Configura las variables de entorno para Google Sheets. Consulta
                el archivo env-example.txt para más detalles.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
