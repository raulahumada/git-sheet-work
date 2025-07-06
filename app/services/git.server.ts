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

// Nueva función para obtener el servicio de Azure DevOps según el tipo de repositorio
export function getAzureDevOpsService(
  repositoryType: 'app' | 'bd' = 'app'
): AzureDevOpsService | null {
  const prefix =
    repositoryType === 'app' ? 'AZURE_DEVOPS_APP_' : 'AZURE_DEVOPS_BD_';

  const organization = process.env[`${prefix}ORGANIZATION`];
  const project = process.env[`${prefix}PROJECT`];
  const repository = process.env[`${prefix}REPOSITORY`];
  const pat = process.env[`${prefix}PAT`];

  if (!organization || !project || !repository || !pat) {
    console.warn(
      `Variables de Azure DevOps para ${
        repositoryType === 'app' ? 'Aplicación' : 'Base de Datos'
      } no configuradas. Funcionalidad limitada.`
    );
    return null;
  }

  return new AzureDevOpsService(organization, project, repository, pat);
}

// Función para generar URL de commit en Azure DevOps según el tipo de repositorio
export function getAzureCommitUrl(
  commitHash: string,
  repositoryType: 'app' | 'bd' = 'app'
): string {
  const prefix =
    repositoryType === 'app' ? 'AZURE_DEVOPS_APP_' : 'AZURE_DEVOPS_BD_';

  const organization = process.env[`${prefix}ORGANIZATION`];
  const project = process.env[`${prefix}PROJECT`];
  const repository = process.env[`${prefix}REPOSITORY`];

  if (!organization || !project || !repository) {
    return '#';
  }

  return `https://dev.azure.com/${organization}/${project}/_git/${repository}/commit/${commitHash}`;
}

// Función para obtener configuración de Azure DevOps según el tipo de repositorio
export function getAzureDevOpsConfig(repositoryType: 'app' | 'bd' = 'app') {
  const prefix =
    repositoryType === 'app' ? 'AZURE_DEVOPS_APP_' : 'AZURE_DEVOPS_BD_';

  return {
    organization: process.env[`${prefix}ORGANIZATION`] || '',
    project: process.env[`${prefix}PROJECT`] || '',
    repository: process.env[`${prefix}REPOSITORY`] || '',
    repositoryType,
  };
}

// Función para verificar si ambos tipos de repositorio están configurados
export function getRepositoryAvailability() {
  const appConfigured = !!(
    process.env.AZURE_DEVOPS_APP_ORGANIZATION &&
    process.env.AZURE_DEVOPS_APP_PROJECT &&
    process.env.AZURE_DEVOPS_APP_REPOSITORY &&
    process.env.AZURE_DEVOPS_APP_PAT
  );

  const bdConfigured = !!(
    process.env.AZURE_DEVOPS_BD_ORGANIZATION &&
    process.env.AZURE_DEVOPS_BD_PROJECT &&
    process.env.AZURE_DEVOPS_BD_REPOSITORY &&
    process.env.AZURE_DEVOPS_BD_PAT
  );

  return {
    app: appConfigured,
    bd: bdConfigured,
    both: appConfigured && bdConfigured,
  };
}

export type { AzureDevOpsCommit, CommitInfo };
