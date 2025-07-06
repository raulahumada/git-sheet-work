import { useState } from 'react';
import { useFetcher } from '@remix-run/react';
import { Button } from '~/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/card';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { RefreshCw } from 'lucide-react';

interface FetcherData {
  success?: boolean;
  error?: string;
  message?: string;
}

interface RepoAvailability {
  app: boolean;
  bd: boolean;
  both: boolean;
}

interface SyncRecentCommitsCardProps {
  isLoading: boolean;
  repoAvailability?: RepoAvailability;
}

export function SyncRecentCommitsCard({
  isLoading,
  repoAvailability,
}: SyncRecentCommitsCardProps) {
  const syncRecentFetcher = useFetcher<FetcherData>();
  const [recentCount, setRecentCount] = useState(10);
  const [recentRepositoryType, setRecentRepositoryType] = useState<
    'app' | 'bd'
  >('app');

  const handleSyncRecentCommits = () => {
    const formData = new FormData();
    formData.append('action', 'sync-recent-commits');
    formData.append('count', recentCount.toString());
    formData.append('repositoryType', recentRepositoryType);

    syncRecentFetcher.submit(formData, {
      method: 'POST',
      action: '/api/commit',
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5" />
          Sincronizar commits recientes
        </CardTitle>
        <CardDescription>
          Obtén y sincroniza los commits más recientes de Azure DevOps
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="recentCount">Cantidad de commits</Label>
            <Input
              id="recentCount"
              type="number"
              min="1"
              max="50"
              value={recentCount}
              onChange={(e) => setRecentCount(parseInt(e.target.value) || 10)}
              disabled={isLoading || syncRecentFetcher.state === 'submitting'}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="recentRepositoryType">Tipo de Repositorio</Label>
            <Select
              value={recentRepositoryType}
              onValueChange={(value: 'app' | 'bd') =>
                setRecentRepositoryType(value)
              }
              disabled={isLoading || syncRecentFetcher.state === 'submitting'}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona el tipo" />
              </SelectTrigger>
              <SelectContent>
                {repoAvailability?.app && (
                  <SelectItem value="app">🖥️ Aplicación</SelectItem>
                )}
                {repoAvailability?.bd && (
                  <SelectItem value="bd">🗄️ Base de Datos</SelectItem>
                )}
                {!repoAvailability?.app && !repoAvailability?.bd && (
                  <SelectItem value="app" disabled>
                    No hay repositorios configurados
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        {!repoAvailability?.app && recentRepositoryType === 'app' && (
          <div className="text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 p-3 rounded-md">
            ⚠️ Repositorio de Aplicación no configurado. Configura las variables
            AZURE_DEVOPS_APP_* en el archivo .env
          </div>
        )}

        {!repoAvailability?.bd && recentRepositoryType === 'bd' && (
          <div className="text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 p-3 rounded-md">
            ⚠️ Repositorio de Base de Datos no configurado. Configura las
            variables AZURE_DEVOPS_BD_* en el archivo .env
          </div>
        )}

        <Button
          onClick={handleSyncRecentCommits}
          disabled={
            isLoading ||
            syncRecentFetcher.state === 'submitting' ||
            (recentRepositoryType === 'app' && !repoAvailability?.app) ||
            (recentRepositoryType === 'bd' && !repoAvailability?.bd)
          }
          className="w-full"
        >
          {syncRecentFetcher.state === 'submitting' ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Sincronizando...
            </>
          ) : (
            `Sincronizar ${recentCount} commits recientes (${
              recentRepositoryType === 'app' ? 'Aplicación' : 'Base de Datos'
            })`
          )}
        </Button>

        {/* Mensaje de éxito de sincronización reciente */}
        {syncRecentFetcher.data && syncRecentFetcher.data.success && (
          <div className="text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/30 p-3 rounded-md border border-green-200 dark:border-green-800 mt-4">
            ✅{' '}
            {syncRecentFetcher.data.message ||
              'Commits recientes sincronizados con Google Sheets'}
          </div>
        )}

        {/* Mensaje de error de sincronización reciente */}
        {syncRecentFetcher.data &&
          !syncRecentFetcher.data.success &&
          syncRecentFetcher.data.error && (
            <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 p-3 rounded-md border border-red-200 dark:border-red-800 mt-4">
              ❌ No se pudieron sincronizar los commits recientes. Verifica la
              configuración e inténtalo de nuevo.
            </div>
          )}
      </CardContent>
    </Card>
  );
}
