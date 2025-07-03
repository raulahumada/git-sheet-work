import { Moon, Sun, Monitor } from 'lucide-react';
import { useTheme } from '~/lib/theme-provider';
import { Button } from './ui/button';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const toggleTheme = () => {
    if (theme === 'light') {
      setTheme('dark');
    } else if (theme === 'dark') {
      setTheme('system');
    } else {
      setTheme('light');
    }
  };

  const getIcon = () => {
    if (theme === 'light') return <Sun className="h-4 w-4" />;
    if (theme === 'dark') return <Moon className="h-4 w-4" />;
    return <Monitor className="h-4 w-4" />;
  };

  const getLabel = () => {
    if (theme === 'light') return 'Cambiar a modo oscuro';
    if (theme === 'dark') return 'Cambiar a modo sistema';
    return 'Cambiar a modo claro';
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleTheme}
      title={getLabel()}
      className="h-8 w-8 px-0"
    >
      {getIcon()}
    </Button>
  );
}
