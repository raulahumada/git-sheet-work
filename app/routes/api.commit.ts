import type { ActionFunctionArgs } from '@remix-run/node';
import { data } from '@remix-run/node';
import {
  getAzureDevOpsConfig,
  getAzureDevOpsService,
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

    // Obtener el servicio de Azure DevOps
    const azureService = getAzureDevOpsService();

    if (!azureService) {
      return data(
        {
          error:
            'Azure DevOps no está configurado. Verifica las variables de entorno: AZURE_DEVOPS_ORGANIZATION, AZURE_DEVOPS_PROJECT, AZURE_DEVOPS_REPOSITORY, AZURE_DEVOPS_PAT',
          success: false,
        },
        { status: 400 }
      );
    }

    switch (action) {
      case 'sync-commit': {
        const commitId = formData.get('commitId') as string;

        if (!commitId?.trim()) {
          return data(
            { error: 'El ID del commit es requerido' },
            { status: 400 }
          );
        }

        // Obtener información del commit desde Azure DevOps
        const commitInfo = await azureService.getCommitInfo(commitId);

        // Sincronizar con Google Sheets
        await sheetsService.addCommit({
          hash: commitInfo.hash,
          message: commitInfo.message,
          author: commitInfo.author,
          date: commitInfo.date,
          files: commitInfo.files,
        });

        return data({
          success: true,
          commit: commitInfo,
          message: 'Commit de Azure DevOps sincronizado con Google Sheets',
        });
      }

      case 'sync-recent-commits': {
        const countParam = formData.get('count') as string;
        const count = countParam ? parseInt(countParam, 10) : 10;

        // Obtener commits recientes desde Azure DevOps
        const commits = await azureService.getRecentCommits(count);

        // Sincronizar todos los commits con Google Sheets
        for (const commit of commits) {
          await sheetsService.addCommit({
            hash: commit.hash,
            message: commit.message,
            author: commit.author,
            date: commit.date,
            files: commit.files,
          });
        }

        return data({
          success: true,
          commits,
          message: `${commits.length} commits de Azure DevOps sincronizados con Google Sheets`,
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

// Loader simplificado para obtener información de Azure DevOps
export async function loader() {
  try {
    const azureService = getAzureDevOpsService();

    if (!azureService) {
      return data(
        {
          error: 'Azure DevOps no está configurado',
          success: false,
        },
        { status: 400 }
      );
    }

    // Obtener commits recientes para mostrar en la interfaz
    const recentCommits = await azureService.getRecentCommits(5);

    // Obtener configuración de Azure DevOps para generar URLs
    const azureConfig = getAzureDevOpsConfig();

    // Obtener configuración de Google Sheets
    const sheetsConfig = getGoogleSheetsConfig();

    return data({
      success: true,
      recentCommits,
      azureConfig,
      sheetsConfig,
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
