import type { MetaFunction, LoaderFunctionArgs } from '@remix-run/node';
import { data } from '@remix-run/node';
import { useLoaderData, useFetcher } from '@remix-run/react';
import { useState, useEffect } from 'react';
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
  azureConfig?: {
    organization: string;
    project: string;
    repository: string;
  };
  sheetsConfig?: {
    spreadsheetId: string;
    hasConfig: boolean;
    url: string;
  };
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

  // Manejar respuestas del fetcher
  useEffect(() => {
    if (syncCommitFetcher.data?.success) {
      toast.success(
        syncCommitFetcher.data.message || 'Commit sincronizado correctamente'
      );
      setCommitId('');
    } else if (syncCommitFetcher.data?.error) {
      toast.error(syncCommitFetcher.data.error);
    }
  }, [syncCommitFetcher.data]);

  useEffect(() => {
    if (syncRecentFetcher.data?.success) {
      toast.success(
        syncRecentFetcher.data.message || 'Commits recientes sincronizados'
      );
    } else if (syncRecentFetcher.data?.error) {
      toast.error(syncRecentFetcher.data.error);
    }
  }, [syncRecentFetcher.data]);

  useEffect(() => {
    if (initSheetsFetcher.data?.success) {
      toast.success(
        initSheetsFetcher.data.message || 'Hoja inicializada correctamente'
      );
    } else if (initSheetsFetcher.data?.error) {
      toast.error(initSheetsFetcher.data.error);
    }
  }, [initSheetsFetcher.data]);

  const handleSyncCommit = () => {
    if (!commitId.trim()) {
      toast.error('Por favor, ingresa un ID de commit válido');
      return;
    }

    const formData = new FormData();
    formData.append('action', 'sync-commit');
    formData.append('commitId', commitId.trim());

    syncCommitFetcher.submit(formData, {
      method: 'POST',
      action: '/api/commit',
    });
  };

  const handleSyncRecentCommits = () => {
    const formData = new FormData();
    formData.append('action', 'sync-recent-commits');
    formData.append('count', recentCount.toString());

    syncRecentFetcher.submit(formData, {
      method: 'POST',
      action: '/api/commit',
    });
  };

  const handleInitializeSheets = () => {
    const formData = new FormData();
    formData.append('action', 'initialize-sheets');

    initSheetsFetcher.submit(formData, {
      method: 'POST',
      action: '/api/commit',
    });
  };

  const handleGetSheetsCommits = () => {
    const formData = new FormData();
    formData.append('action', 'get-sheets-commits');

    getCommitsFetcher.submit(formData, {
      method: 'POST',
      action: '/api/commit',
    });
  };

  const isLoading =
    syncCommitFetcher.state === 'submitting' ||
    syncRecentFetcher.state === 'submitting' ||
    initSheetsFetcher.state === 'submitting' ||
    getCommitsFetcher.state === 'submitting';

  // Función para generar URL de commit en Azure DevOps
  const getAzureCommitUrl = (commitHash: string): string => {
    if (
      !loaderData.azureConfig?.organization ||
      !loaderData.azureConfig?.project ||
      !loaderData.azureConfig?.repository
    ) {
      return '#';
    }

    const { organization, project, repository } = loaderData.azureConfig;
    return `https://dev.azure.com/${organization}/${project}/_git/${repository}/commit/${commitHash}`;
  };

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
              <Button
                onClick={handleSyncCommit}
                disabled={isLoading || !commitId.trim()}
                className="w-full"
              >
                {syncCommitFetcher.state === 'submitting' ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Sincronizando...
                  </>
                ) : (
                  'Sincronizar Commit'
                )}
              </Button>
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
              <Button
                onClick={handleSyncRecentCommits}
                disabled={isLoading}
                className="w-full"
              >
                {syncRecentFetcher.state === 'submitting' ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Sincronizando...
                  </>
                ) : (
                  `Sincronizar ${recentCount} commits recientes`
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Commits recientes de Azure DevOps */}
          {loaderData.success && loaderData.recentCommits && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GitCommit className="h-5 w-5" />
                  Commits recientes de Azure DevOps
                </CardTitle>
                <CardDescription>
                  Los 5 commits más recientes del repositorio
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-80">
                  <div className="space-y-3">
                    {loaderData.recentCommits.map((commit) => (
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
                              href={getAzureCommitUrl(commit.hash)}
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
          )}

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

          {/* Información de error */}
          {loaderData.error && (
            <Card className="border-destructive">
              <CardHeader>
                <CardTitle className="text-destructive">Error</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {loaderData.error}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
