import type { MetaFunction, ActionFunctionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import {
  Form,
  useActionData,
  useNavigation,
  useFetcher,
} from '@remix-run/react';
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
  GitBranch,
  File,
  Plus,
  Minus,
  RotateCcw,
  FolderGit2,
  GitCommit,
  Upload,
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import { exec } from 'child_process';
import { promisify } from 'util';
import { toast } from 'sonner';
import { ThemeToggle } from '~/components/theme-toggle';

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

interface FileTreeNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children: FileTreeNode[];
  change?: GitChange;
  isExpanded?: boolean;
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

        case 'unstage':
          for (const file of selectedFiles) {
            await execAsync(`git restore --staged "${file}"`, { cwd: gitPath });
          }
          return json<ActionData>({
            success: `Se quitaron ${selectedFiles.length} archivo(s) del stage`,
            operation: 'unstage',
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
      const lines = statusOutput.split('\n').filter((line) => line.length > 0);

      for (const line of lines) {
        // Asegurar que la línea tiene al menos 3 caracteres
        if (line.length < 3) continue;

        const indexStatus = line.charAt(0);
        const workingStatus = line.charAt(1);

        // Git status --porcelain format is always "XY filename" where X and Y are status chars
        // X = index status, Y = working tree status
        const file = line.substring(3).trim();

        // Interpretar el formato de git status --porcelain:
        // Primer carácter = estado en el índice (staged)
        // Segundo carácter = estado en el working tree
        // Ejemplos: "A " = staged add, " M" = working modified, "MM" = staged modified + working modified
        const isUntracked = indexStatus === '?' && workingStatus === '?';
        const isStaged =
          !isUntracked && indexStatus !== ' ' && indexStatus !== '?';
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

function buildFileTree(changes: GitChange[]): FileTreeNode[] {
  const tree: Record<string, FileTreeNode> = {};

  function createNode(
    name: string,
    path: string,
    isDirectory: boolean
  ): FileTreeNode {
    return {
      name,
      path,
      isDirectory,
      children: [],
      isExpanded: true,
    };
  }

  // Crear nodos para cada archivo/directorio
  changes.forEach((change) => {
    const parts = change.file.split('/');
    let currentPath = '';

    parts.forEach((part, index) => {
      const previousPath = currentPath;
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const isLastPart = index === parts.length - 1;

      if (!tree[currentPath]) {
        tree[currentPath] = createNode(part, currentPath, !isLastPart);

        if (!isLastPart) {
          // Es un directorio
          tree[currentPath].isDirectory = true;
        } else {
          // Es un archivo
          tree[currentPath].isDirectory = false;
          tree[currentPath].change = change;
        }
      }

      // Conectar con el padre
      if (previousPath && tree[previousPath]) {
        const parent = tree[previousPath];
        if (!parent.children.some((child) => child.path === currentPath)) {
          parent.children.push(tree[currentPath]);
        }
      }
    });
  });

  // Retornar solo los nodos raíz (sin padre)
  const rootNodes = Object.values(tree).filter((node) => {
    const parentPath = node.path.substring(0, node.path.lastIndexOf('/'));
    return !parentPath || !tree[parentPath];
  });

  function sortTree(nodes: FileTreeNode[]): FileTreeNode[] {
    return nodes
      .sort((a, b) => {
        // Directorios primero
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        // Luego alfabéticamente
        return a.name.localeCompare(b.name);
      })
      .map((node) => ({
        ...node,
        children: sortTree(node.children),
      }));
  }

  return sortTree(rootNodes);
}

function getStatusIcon(
  status: string,
  isStaged: boolean,
  isUntracked: boolean
) {
  if (isUntracked) {
    return <Plus className="h-4 w-4 text-blue-500" />;
  }

  if (isStaged) {
    if (status === 'A') return <Plus className="h-4 w-4 text-green-500" />;
    if (status === 'M') return <File className="h-4 w-4 text-yellow-500" />;
    if (status === 'D') return <Minus className="h-4 w-4 text-red-500" />;
  } else {
    if (status === 'M') return <File className="h-4 w-4 text-orange-500" />;
    if (status === 'D') return <Minus className="h-4 w-4 text-red-500" />;
  }

  return <File className="h-4 w-4 text-muted-foreground" />;
}

function FileTreeItem({
  node,
  selectedFiles,
  onFileSelect,
  level = 0,
  expandedFolders,
  onToggleFolder,
}: {
  node: FileTreeNode;
  selectedFiles: string[];
  onFileSelect: (file: string, checked: boolean) => void;
  level?: number;
  expandedFolders: Set<string>;
  onToggleFolder: (path: string) => void;
}) {
  const isSelected = selectedFiles.includes(node.path);
  const isExpanded = expandedFolders.has(node.path);

  const handleToggle = () => {
    if (node.isDirectory) {
      onToggleFolder(node.path);
    } else if (node.change) {
      onFileSelect(node.path, !isSelected);
    }
  };

  const paddingLeft = level * 20 + 8;

  if (node.isDirectory) {
    return (
      <div>
        <div
          className="flex items-center space-x-2 py-1 px-2 hover:bg-muted/50 cursor-pointer rounded"
          style={{ paddingLeft: `${paddingLeft}px` }}
          onClick={handleToggle}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleToggle();
            }
          }}
          role="button"
          tabIndex={0}
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          {isExpanded ? (
            <FolderOpen className="h-4 w-4 text-blue-500" />
          ) : (
            <Folder className="h-4 w-4 text-blue-500" />
          )}
          <span className="text-sm font-medium">{node.name}</span>
          <Badge variant="outline" className="text-xs ml-auto">
            {countChangesInTree(node)}
          </Badge>
        </div>
        {isExpanded && (
          <div>
            {node.children.map((child) => (
              <FileTreeItem
                key={child.path}
                node={child}
                selectedFiles={selectedFiles}
                onFileSelect={onFileSelect}
                level={level + 1}
                expandedFolders={expandedFolders}
                onToggleFolder={onToggleFolder}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`flex items-center space-x-2 py-1 px-2 hover:bg-muted/50 cursor-pointer rounded ${
        isSelected ? 'bg-muted' : ''
      }`}
      style={{ paddingLeft: `${paddingLeft}px` }}
      onClick={handleToggle}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleToggle();
        }
      }}
      role="button"
      tabIndex={0}
    >
      <input
        type="checkbox"
        checked={isSelected}
        onChange={(e) => onFileSelect(node.path, e.target.checked)}
        className="rounded"
        onClick={(e) => e.stopPropagation()}
      />
      {node.change &&
        getStatusIcon(
          node.change.status,
          node.change.isStaged,
          node.change.isUntracked
        )}
      <span className="text-sm font-mono flex-1">{node.name}</span>
      {node.change && (
        <div className="flex items-center space-x-1 text-xs">
          {node.change.additions !== undefined && (
            <span className="text-green-600">+{node.change.additions}</span>
          )}
          {node.change.deletions !== undefined && (
            <span className="text-red-600">-{node.change.deletions}</span>
          )}
        </div>
      )}
    </div>
  );
}

function hasChangesInTree(node: FileTreeNode): boolean {
  return (
    !!node.change || node.children.some((child) => hasChangesInTree(child))
  );
}

function countChangesInTree(node: FileTreeNode): number {
  const count = node.change ? 1 : 0;
  return (
    count +
    node.children.reduce((sum, child) => sum + countChangesInTree(child), 0)
  );
}

export default function Index() {
  const actionData = useActionData<ActionData>();
  const navigation = useNavigation();
  const fetcher = useFetcher<ActionData>();
  const [gitPath, setGitPath] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [commitMessage, setCommitMessage] = useState('');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set()
  );
  const [isUnstaging, setIsUnstaging] = useState(false);
  const [optimisticChanges, setOptimisticChanges] = useState<
    GitChange[] | null
  >(null);
  // Cache de los últimos datos válidos para evitar que el árbol desaparezca
  const [lastValidChanges, setLastValidChanges] = useState<GitChange[]>([]);

  const isLoading =
    navigation.state === 'submitting' ||
    fetcher.state === 'submitting' ||
    isUnstaging;

  // Usar cambios optimistas si están disponibles, sino datos del fetcher, sino actionData, sino cache
  const currentData = fetcher.data || actionData;
  const currentChanges = (() => {
    // Prioridad: optimistas > datos del fetcher/action > cache
    if (optimisticChanges && optimisticChanges.length > 0) {
      return optimisticChanges;
    }
    if (currentData?.changes && currentData.changes.length > 0) {
      return currentData.changes;
    }
    return lastValidChanges;
  })();

  // Actualizar cache cuando tengamos nuevos datos válidos
  useEffect(() => {
    if (currentData?.changes && currentData.changes.length > 0) {
      setLastValidChanges(currentData.changes);
    }
  }, [currentData?.changes]);

  const handleFileSelect = (file: string, checked: boolean) => {
    if (checked) {
      setSelectedFiles([...selectedFiles, file]);
    } else {
      setSelectedFiles(selectedFiles.filter((f) => f !== file));
    }
  };

  const handleSelectAll = () => {
    if (currentData?.changes) {
      const allFiles = currentData.changes.map((change) => change.file);
      setSelectedFiles(allFiles);
    }
  };

  const handleDeselectAll = () => {
    setSelectedFiles([]);
  };

  // Función para hacer add optimista (cambio visual inmediato)
  const handleOptimisticAdd = () => {
    if (!currentChanges || currentChanges.length === 0) return;

    // Crear una copia de los cambios actuales
    const updatedChanges = currentChanges.map((change) => {
      if (selectedFiles.includes(change.file)) {
        // Marcar como staged
        return { ...change, isStaged: true };
      }
      return change;
    });

    // Actualizar la UI inmediatamente
    setOptimisticChanges(updatedChanges);
    // NO resetear selectedFiles inmediatamente para preservar la selección
  };

  // Función para hacer unstage optimista (cambio visual inmediato)
  const handleOptimisticUnstage = () => {
    if (!currentChanges || currentChanges.length === 0) return;

    // Crear una copia de los cambios actuales
    const updatedChanges = currentChanges.map((change) => {
      if (selectedFiles.includes(change.file) && change.isStaged) {
        // Marcar como no staged solo si está staged y está seleccionado
        return { ...change, isStaged: false };
      }
      return change;
    });

    // Actualizar la UI inmediatamente
    setOptimisticChanges(updatedChanges);
    // NO resetear selectedFiles inmediatamente para preservar la selección
  };

  // Función para hacer add con actualizaciones optimistas
  const handleAdd = () => {
    if (!currentData?.gitPath || selectedFiles.length === 0) return;

    // Primero hacer el cambio visual inmediato
    handleOptimisticAdd();

    // Luego ejecutar el comando en segundo plano usando fetcher
    const formData = new FormData();
    formData.append('gitPath', currentData.gitPath);
    formData.append('operation', 'add');
    selectedFiles.forEach((file) => {
      formData.append('selectedFiles', file);
    });

    fetcher.submit(formData, { method: 'post' });
  };

  // Función para hacer unstage con actualizaciones optimistas
  const handleUnstage = () => {
    if (!currentData?.gitPath || selectedFiles.length === 0) return;

    // Primero hacer el cambio visual inmediato
    handleOptimisticUnstage();
    setIsUnstaging(true);

    // Luego ejecutar el comando en segundo plano usando fetcher
    const formData = new FormData();
    formData.append('gitPath', currentData.gitPath);
    formData.append('operation', 'unstage');
    selectedFiles.forEach((file) => {
      formData.append('selectedFiles', file);
    });

    fetcher.submit(formData, { method: 'post' });
  };

  const handleToggleFolder = (path: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedFolders(newExpanded);
  };

  // Para operaciones git, necesitamos saber qué archivos están staged
  const unstagedFiles =
    currentChanges.filter((change) => !change.isStaged) || [];

  // Función para obtener todas las carpetas del árbol
  const getAllFolderPaths = (nodes: FileTreeNode[]): string[] => {
    const paths: string[] = [];
    nodes.forEach((node) => {
      if (node.isDirectory) {
        paths.push(node.path);
        paths.push(...getAllFolderPaths(node.children));
      }
    });
    return paths;
  };

  // Inicializar carpetas expandidas cuando hay nuevos datos del servidor (solo primera vez)
  useEffect(() => {
    const currentDataSource = fetcher.data || actionData;

    // Solo expandir en la primera carga cuando no hay carpetas expandidas
    if (
      currentDataSource?.changes &&
      currentDataSource.changes.length > 0 &&
      expandedFolders.size === 0
    ) {
      const tree = buildFileTree(currentDataSource.changes);
      const allFolderPaths = getAllFolderPaths(tree);
      setExpandedFolders(new Set(allFolderPaths));
    }
  }, [actionData?.changes, fetcher.data?.changes, expandedFolders.size]);

  // Recargar datos automáticamente después de operaciones git exitosas
  useEffect(() => {
    const data = fetcher.data || actionData;

    if (
      data?.success &&
      (data.operation === 'add' || data.operation === 'unstage')
    ) {
      // Mostrar toast de éxito
      toast.success(data.success, {
        duration: 3000,
      });

      // Solo limpiar selecciones después de add/unstage exitoso
      setSelectedFiles([]);
      // Resetear el estado de unstaging
      setIsUnstaging(false);

      // Limpiar cambios optimistas solo si tenemos datos válidos del servidor
      if (data.changes && data.changes.length > 0) {
        // Asegurarnos de que los nuevos datos estén en el cache antes de limpiar optimistas
        setLastValidChanges(data.changes);

        // Limpiar optimisticChanges después de un delay mínimo
        setTimeout(() => {
          setOptimisticChanges(null);
        }, 100);
      }

      // NO resetear expandedFolders aquí - mantener el estado del árbol
    }

    if (data?.error) {
      // Mostrar toast de error
      toast.error(data.error, {
        duration: 5000,
      });

      // En caso de error, también limpiar optimisticChanges para volver al estado real
      setOptimisticChanges(null);
    }
  }, [
    fetcher.data,
    actionData?.success,
    actionData?.operation,
    actionData?.error,
  ]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/40">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
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
            <ThemeToggle />
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
                      <Button
                        onClick={handleAdd}
                        className="w-full"
                        variant="default"
                        disabled={isLoading}
                        type="button"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Add ({selectedFiles.length})
                      </Button>

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
                          {currentChanges
                            .filter((c) => c.isStaged)
                            .map((change) => (
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
                              currentChanges.filter((c) => c.isStaged)
                                .length === 0 ||
                              !commitMessage
                            }
                          >
                            <GitCommit className="mr-2 h-4 w-4" />
                            Commit (
                            {currentChanges.filter((c) => c.isStaged).length})
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

              {/* Sección Stage */}
              {currentChanges.filter((c) => c.isStaged).length > 0 && (
                <Card className="border-green-200 bg-green-50/30 dark:border-green-800 dark:bg-green-950/30 shadow-sm">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-lg font-light text-green-800 dark:text-green-200">
                      Stage ({currentChanges.filter((c) => c.isStaged).length})
                    </CardTitle>
                    <CardDescription className="text-green-700 dark:text-green-300">
                      Archivos listos para commit
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Controles para archivos staged */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Button
                          onClick={() => {
                            const stagedFileNames =
                              currentChanges
                                .filter((c) => c.isStaged)
                                .map((c) => c.file) || [];
                            const newSelected = [
                              ...new Set([
                                ...selectedFiles,
                                ...stagedFileNames,
                              ]),
                            ];
                            setSelectedFiles(newSelected);
                          }}
                          variant="outline"
                          size="sm"
                          type="button"
                        >
                          Seleccionar todos staged
                        </Button>
                        <span className="text-sm text-green-700 dark:text-green-300">
                          {
                            selectedFiles.filter((f) =>
                              currentChanges.some(
                                (c) => c.file === f && c.isStaged
                              )
                            ).length
                          }{' '}
                          staged seleccionados
                        </span>
                      </div>

                      {/* Unstage Button */}
                      {selectedFiles.filter((f) =>
                        currentChanges.some((c) => c.file === f && c.isStaged)
                      ).length > 0 && (
                        <Button
                          onClick={handleUnstage}
                          variant="outline"
                          size="sm"
                          disabled={isLoading || isUnstaging}
                          type="button"
                        >
                          <Minus className="mr-2 h-4 w-4" />
                          {isUnstaging ? 'Unstaging...' : 'Unstage'} (
                          {
                            selectedFiles.filter((f) =>
                              currentChanges.some(
                                (c) => c.file === f && c.isStaged
                              )
                            ).length
                          }
                          )
                        </Button>
                      )}
                    </div>

                    {/* Árbol de archivos staged */}
                    <ScrollArea className="h-[400px] w-full">
                      <div className="space-y-1">
                        {buildFileTree(
                          currentChanges.filter((c) => c.isStaged)
                        ).map((node) => (
                          <FileTreeItem
                            key={node.path}
                            node={node}
                            selectedFiles={selectedFiles}
                            onFileSelect={handleFileSelect}
                            expandedFolders={expandedFolders}
                            onToggleFolder={handleToggleFolder}
                          />
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              )}

              {/* Sección Working Tree */}
              <Card className="border-border/40 shadow-sm">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg font-light">
                    Working Tree ({unstagedFiles.length})
                  </CardTitle>
                  <CardDescription>
                    Archivos con cambios no staged
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {unstagedFiles.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-sm text-muted-foreground">
                        No hay cambios sin staging en el repositorio
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <ScrollArea className="h-[500px] w-full">
                        <div className="space-y-1">
                          {buildFileTree(unstagedFiles).length === 0 ? (
                            <div className="text-sm text-muted-foreground">
                              No se pudo construir el árbol de archivos
                            </div>
                          ) : (
                            buildFileTree(unstagedFiles).map((node) => (
                              <FileTreeItem
                                key={node.path}
                                node={node}
                                selectedFiles={selectedFiles}
                                onFileSelect={handleFileSelect}
                                expandedFolders={expandedFolders}
                                onToggleFolder={handleToggleFolder}
                              />
                            ))
                          )}
                        </div>
                      </ScrollArea>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
