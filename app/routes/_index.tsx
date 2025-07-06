import type { MetaFunction, LoaderFunctionArgs } from '@remix-run/node';
import { data } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import { useMemo } from 'react';
import { Button } from '~/components/ui/button';
import { GitCommit, FileText, ExternalLink } from 'lucide-react';
import { ThemeToggle } from '~/components/theme-toggle';
import { ConfigurationCard } from '~/components/configuration-card';
import { SyncCommitCard } from '~/components/sync-commit-card';
import { SyncRecentCommitsCard } from '~/components/sync-recent-commits-card';
import { RecentCommitsCard } from '~/components/recent-commits-card';
import { SheetsCommitsCard } from '~/components/sheets-commits-card';

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

  // Estados derivados memoizados
  const isLoading = useMemo(() => false, []);

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
          <ConfigurationCard isLoading={isLoading} />

          {/* Sincronizar commit específico */}
          <SyncCommitCard
            isLoading={isLoading}
            repoAvailability={loaderData.repoAvailability}
          />

          {/* Sincronizar commits recientes */}
          <SyncRecentCommitsCard
            isLoading={isLoading}
            repoAvailability={loaderData.repoAvailability}
          />

          {/* Commits recientes de Azure DevOps */}
          <RecentCommitsCard
            recentCommits={loaderData.recentCommits}
            azureConfigApp={loaderData.azureConfigApp}
            azureConfigBd={loaderData.azureConfigBd}
            repoAvailability={loaderData.repoAvailability}
            defaultRepositoryType={loaderData.defaultRepositoryType}
          />

          {/* Información de commits sincronizados */}
          <SheetsCommitsCard isLoading={isLoading} />
        </div>
      </div>
    </div>
  );
}
