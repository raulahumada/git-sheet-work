import type { MetaFunction, LoaderFunctionArgs } from '@remix-run/node';
import { data } from '@remix-run/node';
import { useLoaderData, useFetcher } from '@remix-run/react';
import { useState, useEffect, useCallback, useMemo } from 'react';
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
import { Badge } from '~/components/ui/badge';
import { ScrollArea } from '~/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import {
  GitCommit,
  Upload,
  RefreshCw,
  FileText,
  User,
  Calendar,
  Hash,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import { ThemeToggle } from '~/components/theme-toggle';

export const meta: MetaFunction = () => {
  return [
    { title: 'Git Sheet Work - Azure DevOps Sync' },
    {
      name: 'description',
      content: 'Sincroniza commits de Azure DevOps con Google Sheets',
    },
  ];
};

interface CommitInfo {
  hash: string;
  message: string;
  author: string;
  date: string;
  files: string[];
}

interface LoaderData {
  success: boolean;
  recentCommits?: CommitInfo[];
  error?: string;
  message?: string;
  azureConfigApp?: {
    organization: string;
    project: string;
    repository: string;
    repositoryType: 'app';
  };
  azureConfigBd?: {
    organization: string;
    project: string;
    repository: string;
    repositoryType: 'bd';
  };
  sheetsConfig?: {
    spreadsheetId: string;
    hasConfig: boolean;
    url: string;
  };
  repoAvailability?: {
    app: boolean;
    bd: boolean;
    both: boolean;
  };
  defaultRepositoryType?: 'app' | 'bd';
}

interface FetcherData {
  success?: boolean;
  error?: string;
  message?: string;
  commit?: CommitInfo;
  commits?: CommitInfo[];
}

export async function loader({ request }: LoaderFunctionArgs) {
  // El loader obtiene commits recientes de Azure DevOps
  const url = new URL(request.url);
  const apiUrl = `${url.origin}/api/commit`;

  try {
    const response = await fetch(apiUrl);
    const responseData = await response.json();

    return data<LoaderData>(responseData);
  } catch (error) {
    return data<LoaderData>({
      success: false,
      error: 'Error al obtener commits de Azure DevOps',
    });
  }
}

export default function Index() {
  const loaderData = useLoaderData<LoaderData>();
  const syncCommitFetcher = useFetcher<FetcherData>();
  const syncRecentFetcher = useFetcher<FetcherData>();
  const initSheetsFetcher = useFetcher<FetcherData>();
  const getCommitsFetcher = useFetcher<FetcherData>();

  const [commitId, setCommitId] = useState('');
  const [recentCount, setRecentCount] = useState(10);
  const [repositoryType, setRepositoryType] = useState<'app' | 'bd'>('app');
  const [recentRepositoryType, setRecentRepositoryType] = useState<
    'app' | 'bd'
  >('app');
  const [displayRepositoryType, setDisplayRepositoryType] = useState<
    'app' | 'bd' | undefined
  >(undefined);
  const [displayCommitCount, setDisplayCommitCount] = useState(5);

  // Fetcher para obtener commits recientes filtrados
  const fetchRecentCommitsFetcher = useFetcher<FetcherData>();

  // Manejar respuestas del fetcher de sync commit - optimizado
  useEffect(() => {
    if (syncCommitFetcher.data?.success) {
      setCommitId('');
    }
  }, [syncCommitFetcher.data?.success]);

  // Manejar respuestas de otros fetchers - optimizado
  useEffect(() => {
    if (syncRecentFetcher.data?.error) {
      toast.error(syncRecentFetcher.data.error);
    }
  }, [syncRecentFetcher.data?.error]);

  useEffect(() => {
    if (initSheetsFetcher.data?.error) {
      toast.error(initSheetsFetcher.data.error);
    }
  }, [initSheetsFetcher.data?.error]);

  useEffect(() => {
    if (getCommitsFetcher.data?.error) {
      toast.error(getCommitsFetcher.data.error);
    }
  }, [getCommitsFetcher.data?.error]);

  // Sincronizar displayRepositoryType con el repositorio disponible por defecto (solo al inicio)
  useEffect(() => {
    if (
      loaderData.defaultRepositoryType &&
      displayRepositoryType === undefined
    ) {
      setDisplayRepositoryType(loaderData.defaultRepositoryType);
    }
  }, [loaderData.defaultRepositoryType, displayRepositoryType]);

  // Handlers optimizados con useCallback
  const handleSyncCommit = useCallback(() => {
    if (!commitId.trim()) {
      toast.error('Por favor, ingresa un ID de commit válido');
      return;
    }

    const formData = new FormData();
    formData.append('action', 'sync-commit');
    formData.append('commitId', commitId.trim());
    formData.append('repositoryType', repositoryType);

    syncCommitFetcher.submit(formData, {
      method: 'POST',
      action: '/api/commit',
    });
  }, [commitId, repositoryType, syncCommitFetcher]);

  const handleSyncRecentCommits = useCallback(() => {
    const formData = new FormData();
    formData.append('action', 'sync-recent-commits');
    formData.append('count', recentCount.toString());
    formData.append('repositoryType', recentRepositoryType);

    syncRecentFetcher.submit(formData, {
      method: 'POST',
      action: '/api/commit',
    });
  }, [recentCount, recentRepositoryType, syncRecentFetcher]);

  const handleInitializeSheets = useCallback(() => {
    const formData = new FormData();
    formData.append('action', 'initialize-sheets');

    initSheetsFetcher.submit(formData, {
      method: 'POST',
      action: '/api/commit',
    });
  }, [initSheetsFetcher]);

  const handleGetSheetsCommits = useCallback(() => {
    const formData = new FormData();
    formData.append('action', 'get-sheets-commits');

    getCommitsFetcher.submit(formData, {
      method: 'POST',
      action: '/api/commit',
    });
  }, [getCommitsFetcher]);

  const handleFetchRecentCommits = useCallback(
    (repositoryType: 'app' | 'bd') => {
      const formData = new FormData();
      formData.append('action', 'get-recent-commits');
      formData.append('repositoryType', repositoryType);
      formData.append('count', displayCommitCount.toString());

      fetchRecentCommitsFetcher.submit(formData, {
        method: 'POST',
        action: '/api/commit',
      });
    },
    [fetchRecentCommitsFetcher, displayCommitCount]
  );

  // Estados derivados memoizados
  const isLoading = useMemo(
    () =>
      syncCommitFetcher.state === 'submitting' ||
      syncRecentFetcher.state === 'submitting' ||
      initSheetsFetcher.state === 'submitting' ||
      getCommitsFetcher.state === 'submitting',
    [
      syncCommitFetcher.state,
      syncRecentFetcher.state,
      initSheetsFetcher.state,
      getCommitsFetcher.state,
    ]
  );

  // Función optimizada para generar URL de commit
  const getAzureCommitUrl = useCallback(
    (commitHash: string, repositoryType: 'app' | 'bd' = 'app'): string => {
      const config =
        repositoryType === 'app'
          ? loaderData.azureConfigApp
          : loaderData.azureConfigBd;

      if (!config?.organization || !config?.project || !config?.repository) {
        return '#';
      }

      const { organization, project, repository } = config;
      return `https://dev.azure.com/${organization}/${project}/_git/${repository}/commit/${commitHash}`;
    },
    [loaderData.azureConfigApp, loaderData.azureConfigBd]
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-4 max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <GitCommit className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">Git Sheet Work</h1>
          </div>
          <div className="flex items-center gap-2">
            {loaderData.sheetsConfig?.hasConfig && (
              <Button variant="outline" size="sm" asChild>
                <a
                  href={loaderData.sheetsConfig.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2"
                >
                  <FileText className="h-4 w-4" />
                  Ver Google Sheets
                  <ExternalLink className="h-3 w-3" />
                </a>
              </Button>
            )}
            <ThemeToggle />
          </div>
        </div>

        <div className="grid gap-6">
          {/* Configuración inicial */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Configuración inicial
              </CardTitle>
              <CardDescription>
                Inicializa la hoja de Google Sheets antes de sincronizar commits
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={handleInitializeSheets}
                disabled={isLoading}
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
                <div className="text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/30 p-3 rounded-md border border-green-200 dark:border-green-800 mt-4">
                  ✅{' '}
                  {initSheetsFetcher.data.message ||
                    'Hoja de Google Sheets inicializada correctamente'}
                </div>
              )}

              {/* Mensaje de error de inicialización */}
              {initSheetsFetcher.data &&
                !initSheetsFetcher.data.success &&
                initSheetsFetcher.data.error && (
                  <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 p-3 rounded-md border border-red-200 dark:border-red-800 mt-4">
                    ❌ No se pudo inicializar Google Sheets. Verifica la
                    configuración e inténtalo de nuevo.
                  </div>
                )}
            </CardContent>
          </Card>

          {/* Sincronizar commit específico */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Hash className="h-5 w-5" />
                Sincronizar commit específico
              </CardTitle>
              <CardDescription>
                Ingresa el ID de un commit de Azure DevOps para sincronizarlo
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="commitId">ID del Commit</Label>
                  <Input
                    id="commitId"
                    type="text"
                    placeholder="Ej: a1b2c3d4e5f6..."
                    value={commitId}
                    onChange={(e) => setCommitId(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="repositoryType">Tipo de Repositorio</Label>
                  <Select
                    value={repositoryType}
                    onValueChange={(value: 'app' | 'bd') =>
                      setRepositoryType(value)
                    }
                    disabled={isLoading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona el tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {loaderData.repoAvailability?.app && (
                        <SelectItem value="app">🖥️ Aplicación</SelectItem>
                      )}
                      {loaderData.repoAvailability?.bd && (
                        <SelectItem value="bd">🗄️ Base de Datos</SelectItem>
                      )}
                      {!loaderData.repoAvailability?.app &&
                        !loaderData.repoAvailability?.bd && (
                          <SelectItem value="app" disabled>
                            No hay repositorios configurados
                          </SelectItem>
                        )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {!loaderData.repoAvailability?.app &&
                repositoryType === 'app' && (
                  <div className="text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 p-3 rounded-md">
                    ⚠️ Repositorio de Aplicación no configurado. Configura las
                    variables AZURE_DEVOPS_APP_* en el archivo .env
                  </div>
                )}
              {!loaderData.repoAvailability?.bd && repositoryType === 'bd' && (
                <div className="text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 p-3 rounded-md">
                  ⚠️ Repositorio de Base de Datos no configurado. Configura las
                  variables AZURE_DEVOPS_BD_* en el archivo .env
                </div>
              )}
              <Button
                onClick={handleSyncCommit}
                disabled={
                  isLoading ||
                  !commitId.trim() ||
                  (repositoryType === 'app' &&
                    !loaderData.repoAvailability?.app) ||
                  (repositoryType === 'bd' && !loaderData.repoAvailability?.bd)
                }
                className="w-full"
              >
                {syncCommitFetcher.state === 'submitting' ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Sincronizando...
                  </>
                ) : (
                  `Sincronizar Commit (${
                    repositoryType === 'app' ? 'Aplicación' : 'Base de Datos'
                  })`
                )}
              </Button>

              {/* Mensajes de respuesta del sync commit */}
              {syncCommitFetcher.data && syncCommitFetcher.data.success && (
                <div className="text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/30 p-3 rounded-md border border-green-200 dark:border-green-800">
                  ✅{' '}
                  {syncCommitFetcher.data.message ||
                    'Commit sincronizado correctamente'}
                </div>
              )}

              {/* Mensaje de error del sync commit */}
              {syncCommitFetcher.data &&
                !syncCommitFetcher.data.success &&
                syncCommitFetcher.data.error && (
                  <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 p-3 rounded-md border border-red-200 dark:border-red-800">
                    ❌ No se pudo sincronizar el commit. Verifica que el ID sea
                    válido e inténtalo de nuevo.
                  </div>
                )}
            </CardContent>
          </Card>

          {/* Sincronizar commits recientes */}
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
                    onChange={(e) =>
                      setRecentCount(parseInt(e.target.value) || 10)
                    }
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="recentRepositoryType">
                    Tipo de Repositorio
                  </Label>
                  <Select
                    value={recentRepositoryType}
                    onValueChange={(value: 'app' | 'bd') =>
                      setRecentRepositoryType(value)
                    }
                    disabled={isLoading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona el tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {loaderData.repoAvailability?.app && (
                        <SelectItem value="app">🖥️ Aplicación</SelectItem>
                      )}
                      {loaderData.repoAvailability?.bd && (
                        <SelectItem value="bd">🗄️ Base de Datos</SelectItem>
                      )}
                      {!loaderData.repoAvailability?.app &&
                        !loaderData.repoAvailability?.bd && (
                          <SelectItem value="app" disabled>
                            No hay repositorios configurados
                          </SelectItem>
                        )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {!loaderData.repoAvailability?.app &&
                recentRepositoryType === 'app' && (
                  <div className="text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 p-3 rounded-md">
                    ⚠️ Repositorio de Aplicación no configurado. Configura las
                    variables AZURE_DEVOPS_APP_* en el archivo .env
                  </div>
                )}
              {!loaderData.repoAvailability?.bd &&
                recentRepositoryType === 'bd' && (
                  <div className="text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 p-3 rounded-md">
                    ⚠️ Repositorio de Base de Datos no configurado. Configura
                    las variables AZURE_DEVOPS_BD_* en el archivo .env
                  </div>
                )}
              <Button
                onClick={handleSyncRecentCommits}
                disabled={
                  isLoading ||
                  (recentRepositoryType === 'app' &&
                    !loaderData.repoAvailability?.app) ||
                  (recentRepositoryType === 'bd' &&
                    !loaderData.repoAvailability?.bd)
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
                    recentRepositoryType === 'app'
                      ? 'Aplicación'
                      : 'Base de Datos'
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
                    ❌ No se pudieron sincronizar los commits recientes.
                    Verifica la configuración e inténtalo de nuevo.
                  </div>
                )}
            </CardContent>
          </Card>

          {/* Commits recientes de Azure DevOps */}
          {(loaderData.success && loaderData.recentCommits) ||
          fetchRecentCommitsFetcher.data?.commits ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GitCommit className="h-5 w-5" />
                  Commits recientes de Azure DevOps
                </CardTitle>
                <CardDescription>
                  Los {displayCommitCount} commits más recientes del repositorio
                  seleccionado
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Filtro por tipo de repositorio */}
                <div className="mb-4">
                  <Label htmlFor="displayRepositoryType">
                    Mostrar commits de:
                  </Label>
                  <Select
                    value={displayRepositoryType || 'app'}
                    onValueChange={(value: 'app' | 'bd') => {
                      setDisplayRepositoryType(value);
                      handleFetchRecentCommits(value);
                    }}
                    disabled={fetchRecentCommitsFetcher.state === 'submitting'}
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Selecciona el tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {loaderData.repoAvailability?.app && (
                        <SelectItem value="app">🖥️ Aplicación</SelectItem>
                      )}
                      {loaderData.repoAvailability?.bd && (
                        <SelectItem value="bd">🗄️ Base de Datos</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {/* Input para cantidad de commits */}
                <div className="mb-4">
                  <Label htmlFor="displayCommitCount">
                    Cantidad de commits a mostrar:
                  </Label>
                  <div className="flex gap-2 mt-2">
                    <Input
                      id="displayCommitCount"
                      type="number"
                      min="1"
                      max="20"
                      value={displayCommitCount}
                      onChange={(e) =>
                        setDisplayCommitCount(parseInt(e.target.value) || 5)
                      }
                      disabled={
                        fetchRecentCommitsFetcher.state === 'submitting'
                      }
                      className="w-24"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        handleFetchRecentCommits(displayRepositoryType || 'app')
                      }
                      disabled={
                        fetchRecentCommitsFetcher.state === 'submitting' ||
                        !displayRepositoryType
                      }
                    >
                      {fetchRecentCommitsFetcher.state === 'submitting' ? (
                        <>
                          <RefreshCw className="mr-1 h-3 w-3 animate-spin" />
                          Cargando...
                        </>
                      ) : (
                        'Actualizar'
                      )}
                    </Button>
                  </div>
                </div>

                {fetchRecentCommitsFetcher.state === 'submitting' && (
                  <div className="flex items-center justify-center py-4">
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    <span className="text-sm text-muted-foreground">
                      Obteniendo commits...
                    </span>
                  </div>
                )}

                <ScrollArea className="h-80">
                  <div className="space-y-3">
                    {(
                      fetchRecentCommitsFetcher.data?.commits ||
                      loaderData.recentCommits ||
                      []
                    ).map((commit) => (
                      <div
                        key={commit.hash}
                        className="border rounded-lg p-3 space-y-2"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 space-y-1">
                            <p className="font-medium text-sm">
                              {commit.message}
                            </p>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {commit.author}
                              </div>
                              <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {new Date(commit.date).toLocaleDateString()}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <a
                              href={getAzureCommitUrl(
                                commit.hash,
                                displayRepositoryType || 'app'
                              )}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 hover:opacity-80"
                              title="Ver commit en Azure DevOps"
                            >
                              <Badge variant="secondary" className="text-xs">
                                {commit.hash.substring(0, 7)}
                              </Badge>
                              <ExternalLink className="h-3 w-3 text-muted-foreground" />
                            </a>
                          </div>
                        </div>
                        {commit.files.length > 0 && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <FileText className="h-3 w-3" />
                            {commit.files.length} archivo(s) modificado(s)
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          ) : null}

          {/* Información de commits sincronizados */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Commits en Google Sheets
              </CardTitle>
              <CardDescription>
                Ver commits que ya están sincronizados en Google Sheets
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={handleGetSheetsCommits}
                disabled={isLoading}
                variant="outline"
                className="w-full"
              >
                {getCommitsFetcher.state === 'submitting' ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Obteniendo...
                  </>
                ) : (
                  'Ver commits en Google Sheets'
                )}
              </Button>

              {getCommitsFetcher.data?.commits && (
                <div className="mt-4">
                  <ScrollArea className="h-60">
                    <div className="space-y-2">
                      {getCommitsFetcher.data.commits.map((commit) => (
                        <div
                          key={commit.hash}
                          className="border rounded p-2 text-sm"
                        >
                          <div className="font-medium">{commit.message}</div>
                          <div className="text-xs text-muted-foreground">
                            {commit.author} •{' '}
                            {new Date(commit.date).toLocaleDateString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
