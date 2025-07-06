import { useState, useEffect, useCallback } from 'react';
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
  RefreshCw,
  FileText,
  User,
  Calendar,
  ExternalLink,
} from 'lucide-react';

interface CommitInfo {
  hash: string;
  message: string;
  author: string;
  date: string;
  files: string[];
}

interface FetcherData {
  success?: boolean;
  error?: string;
  message?: string;
  commits?: CommitInfo[];
}

interface AzureConfig {
  organization: string;
  project: string;
  repository: string;
  repositoryType: 'app' | 'bd';
}

interface RepoAvailability {
  app: boolean;
  bd: boolean;
  both: boolean;
}

interface RecentCommitsCardProps {
  recentCommits?: CommitInfo[];
  azureConfigApp?: AzureConfig;
  azureConfigBd?: AzureConfig;
  repoAvailability?: RepoAvailability;
  defaultRepositoryType?: 'app' | 'bd';
}

export function RecentCommitsCard({
  recentCommits,
  azureConfigApp,
  azureConfigBd,
  repoAvailability,
  defaultRepositoryType,
}: RecentCommitsCardProps) {
  const fetchRecentCommitsFetcher = useFetcher<FetcherData>();
  const [displayRepositoryType, setDisplayRepositoryType] = useState<
    'app' | 'bd' | undefined
  >(undefined);
  const [displayCommitCount, setDisplayCommitCount] = useState(5);

  // Sincronizar displayRepositoryType con el repositorio disponible por defecto (solo al inicio)
  useEffect(() => {
    if (defaultRepositoryType && displayRepositoryType === undefined) {
      setDisplayRepositoryType(defaultRepositoryType);
    }
  }, [defaultRepositoryType, displayRepositoryType]);

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

  // Función optimizada para generar URL de commit
  const getAzureCommitUrl = useCallback(
    (commitHash: string, repositoryType: 'app' | 'bd' = 'app'): string => {
      const config = repositoryType === 'app' ? azureConfigApp : azureConfigBd;

      if (!config?.organization || !config?.project || !config?.repository) {
        return '#';
      }

      const { organization, project, repository } = config;
      return `https://dev.azure.com/${organization}/${project}/_git/${repository}/commit/${commitHash}`;
    },
    [azureConfigApp, azureConfigBd]
  );

  // Solo mostrar el card si hay commits o si se han obtenido commits filtrados
  if (!recentCommits && !fetchRecentCommitsFetcher.data?.commits) {
    return null;
  }

  return (
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
          <Label htmlFor="displayRepositoryType">Mostrar commits de:</Label>
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
              {repoAvailability?.app && (
                <SelectItem value="app">🖥️ Aplicación</SelectItem>
              )}
              {repoAvailability?.bd && (
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
              disabled={fetchRecentCommitsFetcher.state === 'submitting'}
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
              recentCommits ||
              []
            ).map((commit) => (
              <div
                key={commit.hash}
                className="border rounded-lg p-3 space-y-2"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 space-y-1">
                    <p className="font-medium text-sm">{commit.message}</p>
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
  );
}
