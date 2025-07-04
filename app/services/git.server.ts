import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface GitCommitInfo {
  hash: string;
  message: string;
  author: string;
  date: string;
  files: string[];
}

export class GitService {
  private workingDirectory: string;

  constructor(workingDirectory = process.cwd()) {
    this.workingDirectory = workingDirectory;
  }

  /**
   * Ejecutar comando git en el directorio de trabajo
   */
  private async executeGitCommand(command: string): Promise<string> {
    try {
      const { stdout } = await execAsync(`git ${command}`, {
        cwd: this.workingDirectory,
      });
      return stdout.trim();
    } catch (error) {
      console.error(`Error ejecutando comando git: ${command}`, error);
      throw new Error(
        `Git command failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  /**
   * Obtener información del último commit
   */
  async getLastCommit(): Promise<GitCommitInfo> {
    try {
      // Obtener información básica del commit
      const commitInfo = await this.executeGitCommand(
        'log -1 --pretty=format:"%H|%s|%an|%ad" --date=iso'
      );

      const [hash, message, author, date] = commitInfo.split('|');

      // Obtener archivos modificados en el último commit
      const filesOutput = await this.executeGitCommand(
        'diff-tree --no-commit-id --name-only -r HEAD'
      );
      const files = filesOutput
        ? filesOutput.split('\n').filter((file) => file.trim())
        : [];

      return {
        hash: hash.trim(),
        message: message.trim(),
        author: author.trim(),
        date: date.trim(),
        files,
      };
    } catch (error) {
      console.error('Error obteniendo información del último commit:', error);
      throw new Error('No se pudo obtener información del último commit');
    }
  }

  /**
   * Obtener información de un commit específico
   */
  async getCommitInfo(commitHash: string): Promise<GitCommitInfo> {
    try {
      // Obtener información básica del commit
      const commitInfo = await this.executeGitCommand(
        `log -1 --pretty=format:"%H|%s|%an|%ad" --date=iso ${commitHash}`
      );

      const [hash, message, author, date] = commitInfo.split('|');

      // Obtener archivos modificados en el commit específico
      const filesOutput = await this.executeGitCommand(
        `diff-tree --no-commit-id --name-only -r ${commitHash}`
      );
      const files = filesOutput
        ? filesOutput.split('\n').filter((file) => file.trim())
        : [];

      return {
        hash: hash.trim(),
        message: message.trim(),
        author: author.trim(),
        date: date.trim(),
        files,
      };
    } catch (error) {
      console.error(
        `Error obteniendo información del commit ${commitHash}:`,
        error
      );
      throw new Error(
        `No se pudo obtener información del commit ${commitHash}`
      );
    }
  }

  /**
   * Realizar un commit con mensaje
   */
  async commit(message: string): Promise<GitCommitInfo> {
    try {
      // Verificar que hay cambios staged
      const stagedFiles = await this.executeGitCommand(
        'diff --cached --name-only'
      );
      if (!stagedFiles.trim()) {
        throw new Error('No hay archivos en staging para hacer commit');
      }

      // Realizar el commit
      await this.executeGitCommand(`commit -m "${message}"`);

      // Obtener información del commit que acabamos de crear
      return await this.getLastCommit();
    } catch (error) {
      console.error('Error realizando commit:', error);
      throw new Error('No se pudo realizar el commit');
    }
  }

  /**
   * Agregar archivos al staging area
   */
  async addFiles(files: string[]): Promise<void> {
    try {
      // Escapar cada nombre de archivo individualmente
      for (const file of files) {
        await this.executeGitCommand(`add "${file}"`);
      }
    } catch (error) {
      console.error('Error agregando archivos al staging:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Error desconocido';
      throw new Error(
        `No se pudieron agregar los archivos al staging: ${errorMessage}`
      );
    }
  }

  /**
   * Obtener archivos en staging
   */
  async getStagedFiles(): Promise<string[]> {
    try {
      const output = await this.executeGitCommand('diff --cached --name-only');
      return output ? output.split('\n').filter((file) => file.trim()) : [];
    } catch (error) {
      console.error('Error obteniendo archivos en staging:', error);
      return [];
    }
  }

  /**
   * Obtener archivos modificados (no staged)
   */
  async getModifiedFiles(): Promise<string[]> {
    try {
      const output = await this.executeGitCommand('diff --name-only');
      return output ? output.split('\n').filter((file) => file.trim()) : [];
    } catch (error) {
      console.error('Error obteniendo archivos modificados:', error);
      return [];
    }
  }

  /**
   * Obtener archivos no rastreados
   */
  async getUntrackedFiles(): Promise<string[]> {
    try {
      const output = await this.executeGitCommand(
        'ls-files --others --exclude-standard'
      );
      return output ? output.split('\n').filter((file) => file.trim()) : [];
    } catch (error) {
      console.error('Error obteniendo archivos no rastreados:', error);
      return [];
    }
  }

  /**
   * Verificar si el repositorio está limpio
   */
  async isClean(): Promise<boolean> {
    try {
      const output = await this.executeGitCommand('status --porcelain');
      return !output.trim();
    } catch (error) {
      console.error('Error verificando estado del repositorio:', error);
      return false;
    }
  }
}

// Instancia singleton del servicio
let gitService: GitService | null = null;

export function getGitService(): GitService {
  if (!gitService) {
    gitService = new GitService();
  }
  return gitService;
}
