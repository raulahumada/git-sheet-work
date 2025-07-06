import type { ActionFunctionArgs } from '@remix-run/node';
import { data } from '@remix-run/node';
import {
  getAzureDevOpsConfig,
  getAzureDevOpsService,
  getRepositoryAvailability,
  type CommitInfo,
} from '~/services/git.server';
import {
  getGoogleSheetsConfig,
  getGoogleSheetsService,
} from '~/services/google-sheets.server';

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return data({ error: 'Método no permitido' }, { status: 405 });
  }

  try {
    const formData = await request.formData();
    const action = formData.get('action') as string;

    // Intentar obtener el servicio de Google Sheets y manejar errores de configuración
    let sheetsService;
    try {
      sheetsService = getGoogleSheetsService();
    } catch (error) {
      return data(
        {
          error:
            'Faltan variables de entorno para Google Sheets. Revisa la configuración en el archivo .env',
          success: false,
        },
        { status: 400 }
      );
    }

    switch (action) {
      case 'sync-commit': {
        const commitId = formData.get('commitId') as string;
        const repositoryType =
          (formData.get('repositoryType') as 'app' | 'bd') || 'app';
        const color = formData.get('color') as string;

        if (!commitId?.trim()) {
          return data(
            { error: 'El ID del commit es requerido' },
            { status: 400 }
          );
        }

        // Obtener el servicio de Azure DevOps específico para el tipo de repositorio
        const azureService = getAzureDevOpsService(repositoryType);

        if (!azureService) {
          const repoTypeName =
            repositoryType === 'app' ? 'Aplicación' : 'Base de Datos';
          return data(
            {
              error: `Azure DevOps para ${repoTypeName} no está configurado. Verifica las variables de entorno en el archivo .env`,
              success: false,
            },
            { status: 400 }
          );
        }

        // Obtener información del commit desde Azure DevOps
        const commitInfo = await azureService.getCommitInfo(commitId);

        // Sincronizar con Google Sheets incluyendo el tipo de repositorio y color
        await sheetsService.addCommit({
          hash: commitInfo.hash,
          message: commitInfo.message,
          author: commitInfo.author,
          date: commitInfo.date,
          files: commitInfo.files,
          repositoryType,
          color: color || '#4ECDC4', // Color por defecto si no se proporciona
        });

        return data({
          success: true,
          commit: commitInfo,
          message: `Commit de Azure DevOps sincronizado con Google Sheets (${
            repositoryType === 'app' ? 'Aplicación' : 'Base de Datos'
          })`,
        });
      }

      case 'sync-recent-commits': {
        const countParam = formData.get('count') as string;
        const repositoryType =
          (formData.get('repositoryType') as 'app' | 'bd') || 'app';
        const count = countParam ? parseInt(countParam, 10) : 10;

        // Obtener el servicio de Azure DevOps específico para el tipo de repositorio
        const azureService = getAzureDevOpsService(repositoryType);

        if (!azureService) {
          const repoTypeName =
            repositoryType === 'app' ? 'Aplicación' : 'Base de Datos';
          return data(
            {
              error: `Azure DevOps para ${repoTypeName} no está configurado. Verifica las variables de entorno en el archivo .env`,
              success: false,
            },
            { status: 400 }
          );
        }

        // Obtener commits recientes desde Azure DevOps
        const commits = await azureService.getRecentCommits(count);

        // Sincronizar todos los commits con Google Sheets incluyendo el tipo de repositorio
        for (const commit of commits) {
          await sheetsService.addCommit({
            hash: commit.hash,
            message: commit.message,
            author: commit.author,
            date: commit.date,
            files: commit.files,
            repositoryType,
          });
        }

        return data({
          success: true,
          commits,
          message: `${
            commits.length
          } commits de Azure DevOps sincronizados con Google Sheets (${
            repositoryType === 'app' ? 'Aplicación' : 'Base de Datos'
          })`,
        });
      }

      case 'initialize-sheets': {
        // Inicializar la hoja de Google Sheets con headers
        await sheetsService.initializeSheet();

        return data({
          success: true,
          message: 'Hoja de Google Sheets inicializada correctamente',
        });
      }

      case 'get-sheets-commits': {
        // Obtener todos los commits de Google Sheets
        const commits = await sheetsService.getCommits();

        return data({
          success: true,
          commits,
          message: 'Commits obtenidos de Google Sheets',
        });
      }

      case 'get-recent-commits': {
        const countParam = formData.get('count') as string;
        const repositoryType =
          (formData.get('repositoryType') as 'app' | 'bd') || 'app';
        const count = countParam ? parseInt(countParam, 10) : 5;

        // Obtener el servicio de Azure DevOps específico para el tipo de repositorio
        const azureService = getAzureDevOpsService(repositoryType);

        if (!azureService) {
          const repoTypeName =
            repositoryType === 'app' ? 'Aplicación' : 'Base de Datos';
          return data(
            {
              error: `Azure DevOps para ${repoTypeName} no está configurado. Verifica las variables de entorno en el archivo .env`,
              success: false,
            },
            { status: 400 }
          );
        }

        // Obtener commits recientes desde Azure DevOps (sin sincronizar)
        const commits = await azureService.getRecentCommits(count);

        return data({
          success: true,
          commits,
          message: `Commits recientes obtenidos de Azure DevOps (${
            repositoryType === 'app' ? 'Aplicación' : 'Base de Datos'
          })`,
        });
      }

      case 'create-unique-files-sheet': {
        // Crear una hoja con archivos únicos eliminando duplicados
        await sheetsService.createUniqueFilesSheet();

        return data({
          success: true,
          message:
            'Hoja de archivos únicos creada correctamente. Se eliminaron los duplicados y se organizaron por repositorio.',
        });
      }

      default:
        return data({ error: 'Acción no válida' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error en la API de commits:', error);

    return data(
      {
        error:
          error instanceof Error ? error.message : 'Error interno del servidor',
        success: false,
      },
      { status: 500 }
    );
  }
}

// Loader para obtener información de Azure DevOps y disponibilidad de repositorios
export async function loader() {
  try {
    // Verificar qué repositorios están configurados
    const repoAvailability = getRepositoryAvailability();

    // Intentar obtener commits recientes del repositorio de aplicación por defecto
    let recentCommits: CommitInfo[] = [];
    let defaultRepositoryType: 'app' | 'bd' = 'app';

    if (repoAvailability.app) {
      const azureService = getAzureDevOpsService('app');
      if (azureService) {
        recentCommits = await azureService.getRecentCommits(5);
        defaultRepositoryType = 'app';
      }
    } else if (repoAvailability.bd) {
      const azureService = getAzureDevOpsService('bd');
      if (azureService) {
        recentCommits = await azureService.getRecentCommits(5);
        defaultRepositoryType = 'bd';
      }
    }

    if (!repoAvailability.app && !repoAvailability.bd) {
      return data(
        {
          error: 'Ningún repositorio de Azure DevOps está configurado',
          success: false,
          repoAvailability,
        },
        { status: 400 }
      );
    }

    // Obtener configuración de Azure DevOps y Google Sheets
    const azureConfigApp = getAzureDevOpsConfig('app');
    const azureConfigBd = getAzureDevOpsConfig('bd');
    const sheetsConfig = getGoogleSheetsConfig();

    return data({
      success: true,
      recentCommits,
      azureConfigApp,
      azureConfigBd,
      sheetsConfig,
      repoAvailability,
      defaultRepositoryType,
      message: 'Commits recientes obtenidos de Azure DevOps',
    });
  } catch (error) {
    console.error('Error obteniendo commits de Azure DevOps:', error);

    return data(
      {
        error:
          error instanceof Error ? error.message : 'Error interno del servidor',
        success: false,
      },
      { status: 500 }
    );
  }
}
