import type { MetaFunction, ActionFunctionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import { Form, useActionData, useNavigation } from '@remix-run/react';
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
  Check,
  X,
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
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

function buildFileTree(changes: GitChange[]): FileTreeNode[] {
  console.log('Building file tree with', changes.length, 'changes');

  const root: FileTreeNode[] = [];
  const pathMap = new Map<string, FileTreeNode>();

  // Crear nodo raíz implícito
  pathMap.set('', {
    name: '',
    path: '',
    isDirectory: true,
    children: [],
    isExpanded: true,
  });

  // Procesar solo los primeros 50 cambios para evitar colgarse
  const limitedChanges = changes.slice(0, 50);
  console.log(
    'Processing',
    limitedChanges.length,
    'changes (limited for performance)'
  );

  limitedChanges.forEach((change, changeIndex) => {
    if (changeIndex % 10 === 0) {
      console.log(
        `Processing change ${changeIndex}/${limitedChanges.length}: ${change.file}`
      );
    }

    // Normalizar la ruta de archivo - manejar tanto / como \
    const normalizedFile = change.file.replace(/\\/g, '/');
    const parts = normalizedFile.split('/').filter((part) => part.length > 0);

    if (parts.length === 0) return; // Skip empty paths

    let currentPath = '';

    parts.forEach((part, index) => {
      const parentPath = currentPath;
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const isLastPart = index === parts.length - 1;

      if (!pathMap.has(currentPath)) {
        const node: FileTreeNode = {
          name: part,
          path: currentPath,
          isDirectory: !isLastPart,
          children: [],
          change: isLastPart ? change : undefined,
          isExpanded: true,
        };

        pathMap.set(currentPath, node);

        // Añadir al padre
        const parent = pathMap.get(parentPath);
        if (parent) {
          parent.children.push(node);
        } else {
          root.push(node);
        }
      } else if (isLastPart) {
        // Si el nodo ya existe pero es la última parte, añadir el cambio
        const existingNode = pathMap.get(currentPath);
        if (existingNode) {
          existingNode.change = change;
        }
      }
    });
  });

  console.log('Root nodes before sorting:', root.length);

  // Ordenar recursivamente: carpetas primero, luego archivos, ambos alfabéticamente
  function sortTree(nodes: FileTreeNode[]): FileTreeNode[] {
    return nodes
      .sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      })
      .map((node) => ({
        ...node,
        children: sortTree(node.children),
      }));
  }

  // Si tenemos un nodo raíz implícito, devolver sus hijos
  const rootNode = pathMap.get('');
  const finalNodes = root.length > 0 ? root : rootNode ? rootNode.children : [];

  const result = sortTree(finalNodes);
  console.log('Final tree result:', result.length, 'root nodes');
  return result;
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
  const isExpanded = node.isDirectory ? expandedFolders.has(node.path) : false;
  const hasChanges =
    node.change || node.children.some((child) => hasChangesInTree(child));

  const handleToggle = () => {
    if (node.isDirectory) {
      console.log(
        'Toggling folder:',
        node.path,
        'currently expanded:',
        isExpanded
      );
      onToggleFolder(node.path);
    }
  };

  // Debug log para carpetas
  if (node.isDirectory && level === 0) {
    console.log(
      'Root folder:',
      node.name,
      'path:',
      node.path,
      'expanded:',
      isExpanded,
      'children:',
      node.children.length
    );
  }

  return (
    <div>
      <div
        className={`flex items-center space-x-2 py-1 px-2 hover:bg-muted/20 transition-colors cursor-pointer ${
          level > 0 ? `ml-${level * 4}` : ''
        }`}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
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
        {node.isDirectory ? (
          <>
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
            {isExpanded ? (
              <FolderOpen className="h-4 w-4 text-blue-500" />
            ) : (
              <Folder className="h-4 w-4 text-blue-500" />
            )}
            <span className="text-sm font-medium">{node.name}</span>
            {hasChanges && !node.change && (
              <Badge variant="outline" className="text-xs h-5 px-1">
                {countChangesInTree(node)}
              </Badge>
            )}
          </>
        ) : (
          node.change && (
            <>
              <div className="w-4" /> {/* Espaciado para alineación */}
              <input
                type="checkbox"
                checked={selectedFiles.includes(node.change?.file || '')}
                onChange={(e) => {
                  e.stopPropagation();
                  if (node.change) {
                    onFileSelect(node.change.file, e.target.checked);
                  }
                }}
                className="rounded"
                onClick={(e) => e.stopPropagation()}
              />
              {getStatusIcon(
                node.change.status,
                node.change.isStaged,
                node.change.isUntracked
              )}
              <span className="text-sm font-mono">{node.name}</span>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  {node.change.status === 'M'
                    ? 'Modificado'
                    : node.change.status === 'A'
                    ? 'Añadido'
                    : node.change.status === 'D'
                    ? 'Eliminado'
                    : node.change.isUntracked
                    ? 'No tracked'
                    : node.change.status}
                </Badge>
                {node.change.isStaged && (
                  <Badge
                    variant="outline"
                    className="text-xs text-green-600 border-green-600"
                  >
                    Staged
                  </Badge>
                )}
              </div>
              {(node.change.additions !== undefined ||
                node.change.deletions !== undefined) && (
                <div className="flex items-center space-x-2 text-xs ml-auto">
                  {node.change.additions !== undefined &&
                    node.change.additions > 0 && (
                      <span className="flex items-center text-green-600">
                        <Plus className="mr-1 h-3 w-3" />
                        {node.change.additions}
                      </span>
                    )}
                  {node.change.deletions !== undefined &&
                    node.change.deletions > 0 && (
                      <span className="flex items-center text-red-600">
                        <Minus className="mr-1 h-3 w-3" />
                        {node.change.deletions}
                      </span>
                    )}
                </div>
              )}
            </>
          )
        )}
      </div>

      {node.isDirectory && isExpanded && (
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

function hasChangesInTree(node: FileTreeNode): boolean {
  if (node.change) return true;
  return node.children.some((child) => hasChangesInTree(child));
}

function countChangesInTree(node: FileTreeNode): number {
  let count = node.change ? 1 : 0;
  node.children.forEach((child) => {
    count += countChangesInTree(child);
  });
  return count;
}

export default function Index() {
  const actionData = useActionData<ActionData>();
  const navigation = useNavigation();
  const [gitPath, setGitPath] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [commitMessage, setCommitMessage] = useState('');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set()
  );

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
  const stagedFiles =
    actionData?.changes?.filter((change) => change.isStaged) || [];

  // Construir árbol de archivos
  console.log('Action data changes:', actionData?.changes);
  const fileTree = actionData?.changes ? buildFileTree(actionData.changes) : [];
  console.log('Built file tree:', fileTree);

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

  // Inicializar carpetas expandidas cuando hay nuevos datos
  useEffect(() => {
    if (actionData?.changes && actionData.changes.length > 0) {
      // Expandir todas las carpetas por defecto
      const tree = buildFileTree(actionData.changes);
      const allFolderPaths = getAllFolderPaths(tree);
      console.log('Setting expanded folders:', allFolderPaths);
      setExpandedFolders(new Set(allFolderPaths));
    }
  }, [actionData?.changes]);

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

              {/* Árbol de archivos */}
              <Card className="border-border/40 shadow-sm">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg font-light">
                    Cambios ({actionData.changes.length})
                  </CardTitle>
                  <CardDescription>
                    Archivos organizados por carpetas
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {actionData.changes.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-sm text-muted-foreground">
                        No hay cambios en el repositorio
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Debug info */}
                      <div className="text-xs text-muted-foreground">
                        Debug: {actionData.changes.length} cambios,{' '}
                        {fileTree.length} nodos raíz, {expandedFolders.size}{' '}
                        carpetas expandidas
                      </div>
                      <ScrollArea className="h-[500px] w-full">
                        <div className="space-y-1">
                          {fileTree.length === 0 ? (
                            <div className="text-sm text-muted-foreground">
                              No se pudo construir el árbol de archivos
                            </div>
                          ) : (
                            fileTree.map((node) => (
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
