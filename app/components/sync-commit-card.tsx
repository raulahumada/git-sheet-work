import { useState, useEffect } from 'react';
import { useFetcher } from '@remix-run/react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { Hash, RefreshCw, Palette } from 'lucide-react';

interface FetcherData {
  success?: boolean;
  error?: string;
  message?: string;
}

interface RepoAvailability {
  app: boolean;
  bd: boolean;
  both: boolean;
}

interface SyncCommitCardProps {
  isLoading: boolean;
  repoAvailability?: RepoAvailability;
}

// Colores predefinidos para el picker
const PREDEFINED_COLORS = [
  '#FF6B6B', // Rojo claro
  '#4ECDC4', // Verde azulado
  '#45B7D1', // Azul claro
  '#96CEB4', // Verde claro
  '#FFEAA7', // Amarillo claro
  '#DDA0DD', // Morado claro
  '#FFB347', // Naranja claro
  '#98D8C8', // Verde menta
  '#F7DC6F', // Amarillo dorado
  '#BB8FCE', // Lavanda
];

const DEFAULT_COLOR = '#4ECDC4';

export function SyncCommitCard({
  isLoading,
  repoAvailability,
}: SyncCommitCardProps) {
  const syncCommitFetcher = useFetcher<FetcherData>();
  const [commitId, setCommitId] = useState('');
  const [repositoryType, setRepositoryType] = useState<'app' | 'bd'>('app');
  const [selectedColor, setSelectedColor] = useState(DEFAULT_COLOR);
  const [isColorLoaded, setIsColorLoaded] = useState(false);

  // Cargar color guardado del localStorage al montar el componente
  useEffect(() => {
    // Verificar que estamos en el cliente antes de acceder a localStorage
    if (typeof window !== 'undefined') {
      const savedColor = localStorage.getItem('git-sheet-commit-color');
      if (savedColor) {
        setSelectedColor(savedColor);
      }
      setIsColorLoaded(true);
    }
  }, []);

  // Guardar color en localStorage cuando cambie (solo después de cargar)
  useEffect(() => {
    // Verificar que estamos en el cliente y que ya se cargó el color inicial
    if (typeof window !== 'undefined' && isColorLoaded) {
      localStorage.setItem('git-sheet-commit-color', selectedColor);
    }
  }, [selectedColor, isColorLoaded]);

  // Limpiar commitId cuando el sync es exitoso
  useEffect(() => {
    if (syncCommitFetcher.data?.success) {
      setCommitId('');
    }
  }, [syncCommitFetcher.data?.success]);

  const handleSyncCommit = () => {
    if (!commitId.trim()) {
      return;
    }

    const formData = new FormData();
    formData.append('action', 'sync-commit');
    formData.append('commitId', commitId.trim());
    formData.append('repositoryType', repositoryType);
    formData.append('color', selectedColor); // Enviar el color seleccionado

    syncCommitFetcher.submit(formData, {
      method: 'POST',
      action: '/api/commit',
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Hash className="h-5 w-5" />
          Sincronizar commit específico
        </CardTitle>
        <CardDescription>
          Ingresa el ID de un commit de Azure DevOps para sincronizarlo
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="commitId">ID del Commit</Label>
            <Input
              id="commitId"
              type="text"
              placeholder="Ej: a1b2c3d4e5f6..."
              value={commitId}
              onChange={(e) => setCommitId(e.target.value)}
              disabled={isLoading || syncCommitFetcher.state === 'submitting'}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="repositoryType">Tipo de Repositorio</Label>
            <Select
              value={repositoryType}
              onValueChange={(value: 'app' | 'bd') => setRepositoryType(value)}
              disabled={isLoading || syncCommitFetcher.state === 'submitting'}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona el tipo" />
              </SelectTrigger>
              <SelectContent>
                {repoAvailability?.app && (
                  <SelectItem value="app">🖥️ Aplicación</SelectItem>
                )}
                {repoAvailability?.bd && (
                  <SelectItem value="bd">🗄️ Base de Datos</SelectItem>
                )}
                {!repoAvailability?.app && !repoAvailability?.bd && (
                  <SelectItem value="app" disabled>
                    No hay repositorios configurados
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="colorPicker">Color de la fila</Label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="w-8 h-8 rounded border-2 border-gray-300 cursor-pointer flex items-center justify-center hover:scale-105 transition-transform"
                style={{ backgroundColor: selectedColor }}
                onClick={() => {
                  const input = document.getElementById(
                    'colorInput'
                  ) as HTMLInputElement;
                  input?.click();
                }}
                disabled={isLoading || syncCommitFetcher.state === 'submitting'}
                title="Abrir selector de color personalizado"
              >
                <Palette className="h-4 w-4 text-white drop-shadow-md" />
              </button>
              <input
                id="colorInput"
                type="color"
                value={selectedColor}
                onChange={(e) => setSelectedColor(e.target.value)}
                className="sr-only"
                disabled={isLoading || syncCommitFetcher.state === 'submitting'}
              />
              <div className="flex flex-wrap gap-1">
                {PREDEFINED_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`w-6 h-6 rounded border-2 cursor-pointer hover:scale-110 transition-transform ${
                      selectedColor === color
                        ? 'border-gray-600'
                        : 'border-gray-300'
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => setSelectedColor(color)}
                    disabled={
                      isLoading || syncCommitFetcher.state === 'submitting'
                    }
                    title={`Seleccionar color ${color}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {!repoAvailability?.app && repositoryType === 'app' && (
          <div className="text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 p-3 rounded-md">
            ⚠️ Repositorio de Aplicación no configurado. Configura las variables
            AZURE_DEVOPS_APP_* en el archivo .env
          </div>
        )}

        {!repoAvailability?.bd && repositoryType === 'bd' && (
          <div className="text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 p-3 rounded-md">
            ⚠️ Repositorio de Base de Datos no configurado. Configura las
            variables AZURE_DEVOPS_BD_* en el archivo .env
          </div>
        )}

        <Button
          onClick={handleSyncCommit}
          disabled={
            isLoading ||
            syncCommitFetcher.state === 'submitting' ||
            !commitId.trim() ||
            (repositoryType === 'app' && !repoAvailability?.app) ||
            (repositoryType === 'bd' && !repoAvailability?.bd)
          }
          className="w-full"
        >
          {syncCommitFetcher.state === 'submitting' ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Sincronizando...
            </>
          ) : (
            <div className="flex items-center justify-center gap-2">
              <span>
                Sincronizar Commit (
                {repositoryType === 'app' ? 'Aplicación' : 'Base de Datos'})
              </span>
              <div
                className="w-4 h-4 rounded border border-white/30"
                style={{ backgroundColor: selectedColor }}
                title={`Color seleccionado: ${selectedColor}`}
              />
            </div>
          )}
        </Button>

        {/* Mensajes de respuesta del sync commit */}
        {syncCommitFetcher.data && syncCommitFetcher.data.success && (
          <div className="text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/30 p-3 rounded-md border border-green-200 dark:border-green-800">
            ✅{' '}
            {syncCommitFetcher.data.message ||
              'Commit sincronizado correctamente'}
          </div>
        )}

        {/* Mensaje de error del sync commit */}
        {syncCommitFetcher.data &&
          !syncCommitFetcher.data.success &&
          syncCommitFetcher.data.error && (
            <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 p-3 rounded-md border border-red-200 dark:border-red-800">
              ❌ No se pudo sincronizar el commit. Verifica que el ID sea válido
              e inténtalo de nuevo.
            </div>
          )}
      </CardContent>
    </Card>
  );
}
