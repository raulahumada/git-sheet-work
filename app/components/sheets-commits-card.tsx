import { useFetcher } from '@remix-run/react';
import { Button } from '~/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/card';
import { ScrollArea } from '~/components/ui/scroll-area';
import { FileText, RefreshCw } from 'lucide-react';

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

interface SheetsCommitsCardProps {
  isLoading: boolean;
}

export function SheetsCommitsCard({ isLoading }: SheetsCommitsCardProps) {
  const getCommitsFetcher = useFetcher<FetcherData>();

  const handleGetSheetsCommits = () => {
    const formData = new FormData();
    formData.append('action', 'get-sheets-commits');

    getCommitsFetcher.submit(formData, {
      method: 'POST',
      action: '/api/commit',
    });
  };

  return (
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
          disabled={isLoading || getCommitsFetcher.state === 'submitting'}
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
                  <div key={commit.hash} className="border rounded p-2 text-sm">
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
  );
}
