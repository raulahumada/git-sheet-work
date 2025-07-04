import type { ActionFunctionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import { getGitService, GitService } from '~/services/git.server';
import { getGoogleSheetsService } from '~/services/google-sheets.server';

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return json({ error: 'Método no permitido' }, { status: 405 });
  }

  try {
    const formData = await request.formData();
    const action = formData.get('action') as string;

    const gitService = getGitService();

    // Intentar obtener el servicio de Google Sheets y manejar errores de configuración
    let sheetsService;
    try {
      sheetsService = getGoogleSheetsService();
    } catch (error) {
      return json(
        {
          error:
            'Faltan variables de entorno para Google Sheets. Revisa la configuración en el archivo .env',
          success: false,
        },
        { status: 400 }
      );
    }

    switch (action) {
      case 'commit': {
        const message = formData.get('message') as string;
        const gitPath = formData.get('gitPath') as string;
        const selectedFiles = formData.getAll('selectedFiles') as string[];

        if (!message?.trim()) {
          return json(
            { error: 'El mensaje del commit es requerido' },
            { status: 400 }
          );
        }

        if (!gitPath?.trim()) {
          return json(
            { error: 'La ruta del repositorio es requerida' },
            { status: 400 }
          );
        }

        // Crear una instancia del servicio Git con el directorio específico
        const gitServiceWithPath = new GitService(gitPath);

        // Si hay archivos seleccionados, añadirlos al staging primero
        if (selectedFiles.length > 0) {
          console.log('Archivos seleccionados para staging:', selectedFiles);
          await gitServiceWithPath.addFiles(selectedFiles);
        } else {
          console.log(
            'No hay archivos seleccionados, usando archivos ya en staging'
          );
        }

        // Realizar el commit
        const commitInfo = await gitServiceWithPath.commit(message);

        // Sincronizar con Google Sheets
        await sheetsService.addCommit({
          hash: commitInfo.hash,
          message: commitInfo.message,
          author: commitInfo.author,
          date: commitInfo.date,
          files: commitInfo.files,
        });

        return json({
          success: true,
          commit: commitInfo,
          message: 'Commit realizado y sincronizado con Google Sheets',
        });
      }

      case 'sync-last-commit': {
        // Obtener el último commit y sincronizarlo con Google Sheets
        const lastCommit = await gitService.getLastCommit();

        await sheetsService.addCommit({
          hash: lastCommit.hash,
          message: lastCommit.message,
          author: lastCommit.author,
          date: lastCommit.date,
          files: lastCommit.files,
        });

        return json({
          success: true,
          commit: lastCommit,
          message: 'Último commit sincronizado con Google Sheets',
        });
      }

      case 'sync-commit': {
        const commitHash = formData.get('commitHash') as string;

        if (!commitHash?.trim()) {
          return json(
            { error: 'El hash del commit es requerido' },
            { status: 400 }
          );
        }

        // Obtener información del commit específico
        const commitInfo = await gitService.getCommitInfo(commitHash);

        // Sincronizar con Google Sheets
        await sheetsService.addCommit({
          hash: commitInfo.hash,
          message: commitInfo.message,
          author: commitInfo.author,
          date: commitInfo.date,
          files: commitInfo.files,
        });

        return json({
          success: true,
          commit: commitInfo,
          message: 'Commit sincronizado con Google Sheets',
        });
      }

      case 'initialize-sheets': {
        // Inicializar la hoja de Google Sheets con headers
        await sheetsService.initializeSheet();

        return json({
          success: true,
          message: 'Hoja de Google Sheets inicializada correctamente',
        });
      }

      case 'get-sheets-commits': {
        // Obtener todos los commits de Google Sheets
        const commits = await sheetsService.getCommits();

        return json({
          success: true,
          commits,
          message: 'Commits obtenidos de Google Sheets',
        });
      }

      default:
        return json({ error: 'Acción no válida' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error en la API de commits:', error);

    return json(
      {
        error:
          error instanceof Error ? error.message : 'Error interno del servidor',
        success: false,
      },
      { status: 500 }
    );
  }
}

// También permitir GET para obtener información
export async function loader() {
  try {
    const gitService = getGitService();

    // Obtener estado actual del repositorio
    const [stagedFiles, modifiedFiles, untrackedFiles, isClean] =
      await Promise.all([
        gitService.getStagedFiles(),
        gitService.getModifiedFiles(),
        gitService.getUntrackedFiles(),
        gitService.isClean(),
      ]);

    let lastCommit = null;
    try {
      lastCommit = await gitService.getLastCommit();
    } catch (error) {
      // El repositorio podría no tener commits aún
      console.warn('No se pudo obtener el último commit:', error);
    }

    return json({
      success: true,
      repository: {
        stagedFiles,
        modifiedFiles,
        untrackedFiles,
        isClean,
        lastCommit,
      },
    });
  } catch (error) {
    console.error('Error obteniendo estado del repositorio:', error);

    return json(
      {
        error:
          error instanceof Error ? error.message : 'Error interno del servidor',
        success: false,
      },
      { status: 500 }
    );
  }
}
