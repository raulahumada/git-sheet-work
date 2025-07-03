import type { MetaFunction, ActionFunctionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import { Form, useActionData, useNavigation } from '@remix-run/react';
import { useState } from 'react';
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
  GitBranch,
  File,
  Plus,
  Minus,
  RotateCcw,
  FolderGit2,
  GitCommit,
  Upload,
  Check,
  X,
} from 'lucide-react';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export const meta: MetaFunction = () => {
  return [
    { title: 'Git Sheet Work - 変更検出器' },
    {
      name: 'description',
      content: 'Gestiona cambios en git de forma minimalista',
    },
  ];
};

interface GitChange {
  status: string;
  file: string;
  additions?: number;
  deletions?: number;
  isStaged: boolean;
  isUntracked: boolean;
}

interface ActionData {
  changes?: GitChange[];
  error?: string;
  gitPath?: string;
  branch?: string;
  success?: string;
  operation?: string;
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const gitPath = formData.get('gitPath') as string;
  const operation = formData.get('operation') as string;
  const selectedFiles = formData.getAll('selectedFiles') as string[];
  const commitMessage = formData.get('commitMessage') as string;

  if (!gitPath) {
    return json<ActionData>({
      error: 'Por favor, especifica una ruta de git válida',
    });
  }

  try {
    const { stdout: gitCheck } = await execAsync(
      'git rev-parse --is-inside-work-tree',
      {
        cwd: gitPath,
      }
    );

    if (gitCheck.trim() !== 'true') {
      return json<ActionData>({
        error: 'La ruta especificada no es un repositorio git válido',
      });
    }

    const { stdout: branchOutput } = await execAsync(
      'git branch --show-current',
      {
        cwd: gitPath,
      }
    );

    // Manejar operaciones git
    if (operation && selectedFiles.length > 0) {
      switch (operation) {
        case 'add':
          for (const file of selectedFiles) {
            await execAsync(`git add "${file}"`, { cwd: gitPath });
          }
          return json<ActionData>({
            success: `Se añadieron ${selectedFiles.length} archivo(s) al stage`,
            operation: 'add',
            gitPath,
            branch: branchOutput.trim(),
          });

        case 'commit':
          if (!commitMessage) {
            return json<ActionData>({
              error: 'El mensaje de commit es requerido',
              gitPath,
              branch: branchOutput.trim(),
            });
          }
          await execAsync(`git commit -m "${commitMessage}"`, { cwd: gitPath });
          return json<ActionData>({
            success: `Commit realizado: "${commitMessage}"`,
            operation: 'commit',
            gitPath,
            branch: branchOutput.trim(),
          });

        case 'push':
          await execAsync(`git push origin ${branchOutput.trim()}`, {
            cwd: gitPath,
          });
          return json<ActionData>({
            success: `Push realizado a la rama ${branchOutput.trim()}`,
            operation: 'push',
            gitPath,
            branch: branchOutput.trim(),
          });
      }
    }

    const { stdout: statusOutput } = await execAsync('git status --porcelain', {
      cwd: gitPath,
    });

    const changes: GitChange[] = [];

    if (statusOutput.trim()) {
      const lines = statusOutput.trim().split('\n');

      for (const line of lines) {
        // Asegurar que la línea tiene al menos 3 caracteres
        if (line.length < 3) continue;

        const indexStatus = line.charAt(0);
        const workingStatus = line.charAt(1);

        // Handle different git status formats
        let file = '';
        if (line.charAt(2) === ' ') {
          // Standard format: "XY filename" where X and Y are status chars
          file = line.substring(3).trim();
        } else {
          // Non-standard format: "X filename" where there's only one status char
          file = line.substring(2).trim();
        }

        // Interpretar el formato de git status --porcelain:
        // Primer carácter = estado en el índice (staged)
        // Segundo carácter = estado en el working tree
        // Ejemplos: "A " = staged add, " M" = working modified, "MM" = staged modified + working modified
        const isUntracked = indexStatus === '?' && workingStatus === '?';
        const isStaged = !isUntracked && indexStatus !== ' ';
        const hasWorkingChanges =
          workingStatus !== ' ' && workingStatus !== '?';

        // Solo procesar archivos que tienen cambios (staged, working tree o untracked)
        if (isStaged || hasWorkingChanges || isUntracked) {
          try {
            let additions = 0;
            let deletions = 0;

            if (isStaged) {
              // Para archivos staged, usar git diff --cached
              const { stdout: diffStat } = await execAsync(
                `git diff --cached --numstat "${file}"`,
                { cwd: gitPath }
              );
              if (diffStat.trim()) {
                [additions, deletions] = diffStat
                  .trim()
                  .split('\t')
                  .map((n) => parseInt(n) || 0);
              }
            } else if (hasWorkingChanges && !isUntracked) {
              // Para archivos con cambios en working tree (no staged)
              const { stdout: diffStat } = await execAsync(
                `git diff --numstat "${file}"`,
                { cwd: gitPath }
              );
              if (diffStat.trim()) {
                [additions, deletions] = diffStat
                  .trim()
                  .split('\t')
                  .map((n) => parseInt(n) || 0);
              }
            }

            changes.push({
              status: isStaged ? indexStatus : workingStatus,
              file,
              additions,
              deletions,
              isStaged,
              isUntracked,
            });
          } catch {
            changes.push({
              status: isStaged ? indexStatus : workingStatus,
              file,
              isStaged,
              isUntracked,
            });
          }
        }
      }
    }

    return json<ActionData>({
      changes,
      gitPath,
      branch: branchOutput.trim(),
    });
  } catch (error) {
    return json<ActionData>({
      error: `Error al acceder al repositorio: ${
        error instanceof Error ? error.message : 'Error desconocido'
      }`,
    });
  }
}

function getStatusIcon(
  status: string,
  isStaged: boolean,
  isUntracked: boolean
) {
  if (isUntracked) {
    return <File className="h-4 w-4 text-blue-500" />;
  }

  switch (status) {
    case 'A':
      return <Plus className="h-4 w-4 text-green-500" />;
    case 'M':
      return <RotateCcw className="h-4 w-4 text-yellow-500" />;
    case 'D':
      return <Minus className="h-4 w-4 text-red-500" />;
    default:
      return <File className="h-4 w-4 text-muted-foreground" />;
  }
}

export default function Index() {
  const actionData = useActionData<ActionData>();
  const navigation = useNavigation();
  const [gitPath, setGitPath] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [commitMessage, setCommitMessage] = useState('');

  const isLoading = navigation.state === 'submitting';

  const handleFileSelect = (file: string, checked: boolean) => {
    if (checked) {
      setSelectedFiles([...selectedFiles, file]);
    } else {
      setSelectedFiles(selectedFiles.filter((f) => f !== file));
    }
  };

  const handleSelectAll = () => {
    if (actionData?.changes) {
      const allFiles = actionData.changes.map((change) => change.file);
      setSelectedFiles(allFiles);
    }
  };

  const handleDeselectAll = () => {
    setSelectedFiles([]);
  };

  // Agrupar cambios por tipo de operación, sin importar si están staged o no
  const modifiedFiles =
    actionData?.changes?.filter((change) => change.status === 'M') || [];
  const addedFiles =
    actionData?.changes?.filter(
      (change) => change.status === 'A' || change.isUntracked
    ) || [];
  const deletedFiles =
    actionData?.changes?.filter((change) => change.status === 'D') || [];

  // Para operaciones git, necesitamos saber qué archivos están staged
  const stagedFiles =
    actionData?.changes?.filter((change) => change.isStaged) || [];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/40">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center space-x-3">
            <FolderGit2 className="h-8 w-8 text-foreground" />
            <div>
              <h1 className="text-2xl font-light tracking-wide text-foreground">
                Git Sheet Work
              </h1>
              <p className="text-sm text-muted-foreground font-light">
                変更管理器 • Gestor de cambios git
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="space-y-8">
          {/* Formulario de entrada */}
          <Card className="border-border/40 shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-light">
                Repositorio Git
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Especifica la ruta al repositorio git para gestionar los cambios
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form method="post" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="gitPath" className="text-sm font-medium">
                    Ruta del repositorio
                  </Label>
                  <Input
                    id="gitPath"
                    name="gitPath"
                    type="text"
                    placeholder="ej. C:\path\to\your\git\repository"
                    value={gitPath}
                    onChange={(e) => setGitPath(e.target.value)}
                    className="font-mono text-sm"
                    required
                  />
                </div>
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full sm:w-auto"
                >
                  {isLoading ? (
                    <>
                      <RotateCcw className="mr-2 h-4 w-4 animate-spin" />
                      Analizando...
                    </>
                  ) : (
                    <>
                      <GitBranch className="mr-2 h-4 w-4" />
                      Analizar cambios
                    </>
                  )}
                </Button>
              </Form>
            </CardContent>
          </Card>

          {/* Mensajes de éxito/error */}
          {actionData?.success && (
            <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
              <CardContent className="pt-6">
                <div className="flex items-center space-x-2">
                  <Check className="h-4 w-4 text-green-600" />
                  <p className="text-sm text-green-800 dark:text-green-200">
                    {actionData.success}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {actionData?.error && (
            <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950">
              <CardContent className="pt-6">
                <div className="flex items-center space-x-2">
                  <X className="h-4 w-4 text-red-600" />
                  <p className="text-sm text-red-800 dark:text-red-200">
                    {actionData.error}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Resultados y controles */}
          {actionData?.changes && (
            <>
              {/* Panel de controles */}
              <Card className="border-border/40 shadow-sm">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-light">
                      Controles Git
                    </CardTitle>
                    {actionData.branch && (
                      <Badge variant="outline" className="font-mono text-xs">
                        <GitBranch className="mr-1 h-3 w-3" />
                        {actionData.branch}
                      </Badge>
                    )}
                  </div>
                  {actionData.gitPath && (
                    <CardDescription className="font-mono text-xs">
                      {actionData.gitPath}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Selección */}
                  <div className="flex items-center space-x-2">
                    <Button
                      onClick={handleSelectAll}
                      variant="outline"
                      size="sm"
                      type="button"
                    >
                      Seleccionar todos
                    </Button>
                    <Button
                      onClick={handleDeselectAll}
                      variant="outline"
                      size="sm"
                      type="button"
                    >
                      Deseleccionar todos
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      {selectedFiles.length} archivo(s) seleccionado(s)
                    </span>
                  </div>

                  {/* Acciones Git */}
                  {selectedFiles.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Add */}
                      <Form method="post">
                        <input
                          type="hidden"
                          name="gitPath"
                          value={actionData.gitPath}
                        />
                        <input type="hidden" name="operation" value="add" />
                        {selectedFiles.map((file) => (
                          <input
                            key={file}
                            type="hidden"
                            name="selectedFiles"
                            value={file}
                          />
                        ))}
                        <Button
                          type="submit"
                          className="w-full"
                          variant="default"
                          disabled={isLoading}
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Add ({selectedFiles.length})
                        </Button>
                      </Form>

                      {/* Commit */}
                      <div className="space-y-2">
                        <Input
                          placeholder="Mensaje de commit"
                          value={commitMessage}
                          onChange={(e) => setCommitMessage(e.target.value)}
                          className="text-sm"
                        />
                        <Form method="post">
                          <input
                            type="hidden"
                            name="gitPath"
                            value={actionData.gitPath}
                          />
                          <input
                            type="hidden"
                            name="operation"
                            value="commit"
                          />
                          <input
                            type="hidden"
                            name="commitMessage"
                            value={commitMessage}
                          />
                          {stagedFiles.map((change) => (
                            <input
                              key={change.file}
                              type="hidden"
                              name="selectedFiles"
                              value={change.file}
                            />
                          ))}
                          <Button
                            type="submit"
                            className="w-full"
                            variant="default"
                            disabled={
                              isLoading ||
                              stagedFiles.length === 0 ||
                              !commitMessage
                            }
                          >
                            <GitCommit className="mr-2 h-4 w-4" />
                            Commit ({stagedFiles.length})
                          </Button>
                        </Form>
                      </div>

                      {/* Push */}
                      <Form method="post">
                        <input
                          type="hidden"
                          name="gitPath"
                          value={actionData.gitPath}
                        />
                        <input type="hidden" name="operation" value="push" />
                        <input
                          type="hidden"
                          name="selectedFiles"
                          value="dummy"
                        />
                        <Button
                          type="submit"
                          className="w-full"
                          variant="default"
                          disabled={isLoading}
                        >
                          <Upload className="mr-2 h-4 w-4" />
                          Push
                        </Button>
                      </Form>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Lista de cambios por tipo */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Archivos Modificados */}
                <Card className="border-border/40 shadow-sm">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-lg font-light text-yellow-600">
                      Modificados ({modifiedFiles.length})
                    </CardTitle>
                    <CardDescription>Archivos con cambios</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {modifiedFiles.length === 0 ? (
                      <div className="text-center py-4">
                        <p className="text-sm text-muted-foreground">
                          No hay archivos modificados
                        </p>
                      </div>
                    ) : (
                      <ScrollArea className="h-[300px] w-full">
                        <div className="space-y-2">
                          {modifiedFiles.map((change, index) => (
                            <div
                              key={index}
                              className="flex items-center space-x-3 p-2 rounded-md border border-border/40 hover:bg-muted/20 transition-colors"
                            >
                              <input
                                type="checkbox"
                                checked={selectedFiles.includes(change.file)}
                                onChange={(e) =>
                                  handleFileSelect(
                                    change.file,
                                    e.target.checked
                                  )
                                }
                                className="rounded"
                              />
                              {getStatusIcon(
                                change.status,
                                change.isStaged,
                                change.isUntracked
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="font-mono text-sm truncate">
                                  {change.file}
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge
                                    variant="secondary"
                                    className="text-xs"
                                  >
                                    Modificado
                                  </Badge>
                                  {change.isStaged && (
                                    <Badge
                                      variant="outline"
                                      className="text-xs text-green-600 border-green-600"
                                    >
                                      Staged
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              {(change.additions !== undefined ||
                                change.deletions !== undefined) && (
                                <div className="flex items-center space-x-2 text-xs">
                                  {change.additions !== undefined &&
                                    change.additions > 0 && (
                                      <span className="flex items-center text-green-600">
                                        <Plus className="mr-1 h-3 w-3" />
                                        {change.additions}
                                      </span>
                                    )}
                                  {change.deletions !== undefined &&
                                    change.deletions > 0 && (
                                      <span className="flex items-center text-red-600">
                                        <Minus className="mr-1 h-3 w-3" />
                                        {change.deletions}
                                      </span>
                                    )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                  </CardContent>
                </Card>

                {/* Archivos Nuevos */}
                <Card className="border-border/40 shadow-sm">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-lg font-light text-green-600">
                      Nuevos ({addedFiles.length})
                    </CardTitle>
                    <CardDescription>
                      Archivos añadidos o sin seguimiento
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {addedFiles.length === 0 ? (
                      <div className="text-center py-4">
                        <p className="text-sm text-muted-foreground">
                          No hay archivos nuevos
                        </p>
                      </div>
                    ) : (
                      <ScrollArea className="h-[300px] w-full">
                        <div className="space-y-2">
                          {addedFiles.map((change, index) => (
                            <div
                              key={index}
                              className="flex items-center space-x-3 p-2 rounded-md border border-border/40 hover:bg-muted/20 transition-colors"
                            >
                              <input
                                type="checkbox"
                                checked={selectedFiles.includes(change.file)}
                                onChange={(e) =>
                                  handleFileSelect(
                                    change.file,
                                    e.target.checked
                                  )
                                }
                                className="rounded"
                              />
                              {getStatusIcon(
                                change.status,
                                change.isStaged,
                                change.isUntracked
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="font-mono text-sm truncate">
                                  {change.file}
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge
                                    variant="secondary"
                                    className="text-xs"
                                  >
                                    {change.isUntracked
                                      ? 'No tracked'
                                      : 'Añadido'}
                                  </Badge>
                                  {change.isStaged && !change.isUntracked && (
                                    <Badge
                                      variant="outline"
                                      className="text-xs text-green-600 border-green-600"
                                    >
                                      Staged
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                  </CardContent>
                </Card>

                {/* Archivos Eliminados */}
                <Card className="border-border/40 shadow-sm">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-lg font-light text-red-600">
                      Eliminados ({deletedFiles.length})
                    </CardTitle>
                    <CardDescription>Archivos borrados</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {deletedFiles.length === 0 ? (
                      <div className="text-center py-4">
                        <p className="text-sm text-muted-foreground">
                          No hay archivos eliminados
                        </p>
                      </div>
                    ) : (
                      <ScrollArea className="h-[300px] w-full">
                        <div className="space-y-2">
                          {deletedFiles.map((change, index) => (
                            <div
                              key={index}
                              className="flex items-center space-x-3 p-2 rounded-md border border-border/40 hover:bg-muted/20 transition-colors"
                            >
                              <input
                                type="checkbox"
                                checked={selectedFiles.includes(change.file)}
                                onChange={(e) =>
                                  handleFileSelect(
                                    change.file,
                                    e.target.checked
                                  )
                                }
                                className="rounded"
                              />
                              {getStatusIcon(
                                change.status,
                                change.isStaged,
                                change.isUntracked
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="font-mono text-sm truncate">
                                  {change.file}
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge
                                    variant="secondary"
                                    className="text-xs"
                                  >
                                    Eliminado
                                  </Badge>
                                  {change.isStaged && (
                                    <Badge
                                      variant="outline"
                                      className="text-xs text-green-600 border-green-600"
                                    >
                                      Staged
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </div>
      </main>

      <footer className="border-t border-border/40 mt-16">
        <div className="container mx-auto px-4 py-6">
          <p className="text-center text-xs text-muted-foreground font-light">
            Git Sheet Work • 简素な設計
          </p>
        </div>
      </footer>
    </div>
  );
}
// test change
