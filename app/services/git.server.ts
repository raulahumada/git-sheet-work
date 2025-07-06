import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface CommitInfo {
  hash: string;
  message: string;
  author: string;
  date: string;
  files: string[];
}

interface AzureDevOpsCommit {
  commitId: string;
  comment: string;
  author: {
    name: string;
    email: string;
    date: string;
  };
  changes?: Array<{
    item: {
      path: string;
    };
    changeType: string;
  }>;
}

class AzureDevOpsService {
  private organization: string;
  private project: string;
  private repository: string;
  private personalAccessToken: string;

  constructor(
    organization: string,
    project: string,
    repository: string,
    personalAccessToken: string
  ) {
    this.organization = organization;
    this.project = project;
    this.repository = repository;
    this.personalAccessToken = personalAccessToken;
  }

  /**
   * Obtener información de un commit específico desde Azure DevOps
   */
  async getCommitInfo(commitId: string): Promise<CommitInfo> {
    try {
      const baseUrl = `https://dev.azure.com/${this.organization}/${this.project}/_apis/git/repositories/${this.repository}`;

      // Obtener información básica del commit
      const commitUrl = `${baseUrl}/commits/${commitId}?api-version=7.0`;
      const changesUrl = `${baseUrl}/commits/${commitId}/changes?api-version=7.0`;

      const headers = {
        Authorization: `Basic ${Buffer.from(
          `:${this.personalAccessToken}`
        ).toString('base64')}`,
        'Content-Type': 'application/json',
      };

      // Hacer ambas peticiones en paralelo
      const [commitResponse, changesResponse] = await Promise.all([
        fetch(commitUrl, { headers }),
        fetch(changesUrl, { headers }),
      ]);

      if (!commitResponse.ok) {
        throw new Error(
          `Error al obtener commit: ${commitResponse.status} - ${commitResponse.statusText}`
        );
      }

      if (!changesResponse.ok) {
        throw new Error(
          `Error al obtener cambios: ${changesResponse.status} - ${changesResponse.statusText}`
        );
      }

      const commitData: AzureDevOpsCommit = await commitResponse.json();
      const changesData = await changesResponse.json();

      // Extraer archivos modificados (filtrar solo archivos, no carpetas)
      const files =
        changesData.changes
          ?.map(
            (change: {
              item: { path: string; isFolder?: boolean };
              changeType: string;
            }) => {
              // Remover el primer slash si existe
              return change.item.path.startsWith('/')
                ? change.item.path.substring(1)
                : change.item.path;
            }
          )
          .filter((path: string) => {
            // Filtrar solo archivos reales (que tengan extensión)
            // Excluir carpetas (que terminan en / o no tienen extensión)
            return path.includes('.') && !path.endsWith('/');
          }) || [];

      return {
        hash: commitData.commitId,
        message: commitData.comment,
        author: commitData.author.name,
        date: commitData.author.date,
        files: files,
      };
    } catch (error) {
      console.error(
        'Error al obtener información del commit desde Azure DevOps:',
        error
      );
      throw new Error(
        `No se pudo obtener la información del commit: ${
          error instanceof Error ? error.message : 'Error desconocido'
        }`
      );
    }
  }

  /**
   * Obtener los últimos commits del repositorio
   */
  async getRecentCommits(count: number = 10): Promise<CommitInfo[]> {
    try {
      const baseUrl = `https://dev.azure.com/${this.organization}/${this.project}/_apis/git/repositories/${this.repository}`;
      const commitsUrl = `${baseUrl}/commits?searchCriteria.$top=${count}&api-version=7.0`;

      const headers = {
        Authorization: `Basic ${Buffer.from(
          `:${this.personalAccessToken}`
        ).toString('base64')}`,
        'Content-Type': 'application/json',
      };

      const response = await fetch(commitsUrl, { headers });

      if (!response.ok) {
        throw new Error(
          `Error al obtener commits: ${response.status} - ${response.statusText}`
        );
      }

      const data = await response.json();
      const commits: AzureDevOpsCommit[] = data.value;

      // Obtener detalles de cada commit
      const commitInfoPromises = commits.map((commit) =>
        this.getCommitInfo(commit.commitId)
      );
      return await Promise.all(commitInfoPromises);
    } catch (error) {
      console.error('Error al obtener commits recientes:', error);
      throw new Error(
        `No se pudieron obtener los commits recientes: ${
          error instanceof Error ? error.message : 'Error desconocido'
        }`
      );
    }
  }
}

// Mantener la clase GitService original para compatibilidad
export class GitService {
  private repoPath: string;

  constructor(repoPath: string = process.cwd()) {
    this.repoPath = repoPath;
  }

  async commit(message: string): Promise<CommitInfo> {
    try {
      await execAsync(`git commit -m "${message}"`, {
        cwd: this.repoPath,
      });

      const commitHash = await this.getLastCommitHash();
      return await this.getCommitInfo(commitHash);
    } catch (error) {
      throw new Error(`Error al hacer commit: ${(error as Error).message}`);
    }
  }

  async getCommitInfo(hash: string): Promise<CommitInfo> {
    try {
      const [commitInfo, files] = await Promise.all([
        execAsync(`git show --format="%H|%s|%an|%ai" --name-only ${hash}`, {
          cwd: this.repoPath,
        }),
        this.getCommitFiles(hash),
      ]);

      const lines = commitInfo.stdout.trim().split('\n');
      const [commitHash, message, author, date] = lines[0].split('|');

      return {
        hash: commitHash,
        message,
        author,
        date,
        files,
      };
    } catch (error) {
      throw new Error(
        `Error al obtener información del commit: ${(error as Error).message}`
      );
    }
  }

  async getLastCommit(): Promise<CommitInfo> {
    const hash = await this.getLastCommitHash();
    return this.getCommitInfo(hash);
  }

  private async getLastCommitHash(): Promise<string> {
    try {
      const { stdout } = await execAsync('git rev-parse HEAD', {
        cwd: this.repoPath,
      });
      return stdout.trim();
    } catch (error) {
      throw new Error(
        `Error al obtener el último commit: ${(error as Error).message}`
      );
    }
  }

  private async getCommitFiles(hash: string): Promise<string[]> {
    try {
      const { stdout } = await execAsync(
        `git diff-tree --no-commit-id --name-only -r ${hash}`,
        {
          cwd: this.repoPath,
        }
      );

      return stdout
        .trim()
        .split('\n')
        .filter((file) => file.length > 0);
    } catch (error) {
      return [];
    }
  }

  async addFiles(files: string[]): Promise<void> {
    const fileList = files.map((f) => `"${f}"`).join(' ');
    await execAsync(`git add ${fileList}`, { cwd: this.repoPath });
  }

  async getStagedFiles(): Promise<string[]> {
    try {
      const { stdout } = await execAsync('git diff --cached --name-only', {
        cwd: this.repoPath,
      });

      return stdout
        .trim()
        .split('\n')
        .filter((file) => file.length > 0);
    } catch (error) {
      return [];
    }
  }

  async getModifiedFiles(): Promise<string[]> {
    try {
      const { stdout } = await execAsync('git diff --name-only', {
        cwd: this.repoPath,
      });

      return stdout
        .trim()
        .split('\n')
        .filter((file) => file.length > 0);
    } catch (error) {
      return [];
    }
  }

  async getUntrackedFiles(): Promise<string[]> {
    try {
      const { stdout } = await execAsync(
        'git ls-files --others --exclude-standard',
        {
          cwd: this.repoPath,
        }
      );

      return stdout
        .trim()
        .split('\n')
        .filter((file) => file.length > 0);
    } catch (error) {
      return [];
    }
  }

  async isClean(): Promise<boolean> {
    try {
      const { stdout } = await execAsync('git status --porcelain', {
        cwd: this.repoPath,
      });

      return stdout.trim().length === 0;
    } catch (error) {
      return false;
    }
  }
}

// Instancia singleton del servicio Git
let gitService: GitService | null = null;

export function getGitService(): GitService {
  if (!gitService) {
    gitService = new GitService();
  }
  return gitService;
}

// Nueva función para obtener el servicio de Azure DevOps
export function getAzureDevOpsService(): AzureDevOpsService | null {
  const organization = process.env.AZURE_DEVOPS_ORGANIZATION;
  const project = process.env.AZURE_DEVOPS_PROJECT;
  const repository = process.env.AZURE_DEVOPS_REPOSITORY;
  const pat = process.env.AZURE_DEVOPS_PAT;

  if (!organization || !project || !repository || !pat) {
    console.warn(
      'Variables de Azure DevOps no configuradas. Funcionalidad limitada.'
    );
    return null;
  }

  return new AzureDevOpsService(organization, project, repository, pat);
}

// Función para generar URL de commit en Azure DevOps
export function getAzureCommitUrl(commitHash: string): string {
  const organization = process.env.AZURE_DEVOPS_ORGANIZATION;
  const project = process.env.AZURE_DEVOPS_PROJECT;
  const repository = process.env.AZURE_DEVOPS_REPOSITORY;

  if (!organization || !project || !repository) {
    return '#';
  }

  return `https://dev.azure.com/${organization}/${project}/_git/${repository}/commit/${commitHash}`;
}

// Función para obtener configuración de Azure DevOps
export function getAzureDevOpsConfig() {
  return {
    organization: process.env.AZURE_DEVOPS_ORGANIZATION || '',
    project: process.env.AZURE_DEVOPS_PROJECT || '',
    repository: process.env.AZURE_DEVOPS_REPOSITORY || '',
  };
}

export type { AzureDevOpsCommit, CommitInfo };
