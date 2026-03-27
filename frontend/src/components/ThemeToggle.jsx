import { Moon, SunMedium } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export default function ThemeToggle({ compact = false }) {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`theme-toggle ${compact ? 'theme-toggle-compact' : ''}`}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
    >
      <span className="theme-toggle-icon" aria-hidden="true">
        {isDark ? <SunMedium className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </span>
      <span className="theme-toggle-copy">
        <span className="theme-toggle-label">{isDark ? 'Light mode' : 'Dark mode'}</span>
        {!compact ? <span className="theme-toggle-hint">Comfort view</span> : null}
      </span>
    </button>
  );
}
