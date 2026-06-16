
import React, { createContext, useContext, useState, useEffect } from 'react';

type Theme = 'light' | 'dark';
type ViewMode = 'light' | 'dark' | 'darkroom';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void; // Legacy / Cycling wrapper
  isDarkroom: boolean;
  toggleDarkroom: () => void; // Legacy wrapper
  viewMode: ViewMode;
  cycleMode: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const savedMode = localStorage.getItem('filmlog_view_mode');
    const savedTheme = localStorage.getItem('filmlog_theme');
    const savedDarkroom = localStorage.getItem('filmlog_darkroom') === 'true';

    // Migration from old keys if new key not present
    if (!savedMode) {
      if (savedDarkroom) return 'darkroom';
      if (savedTheme === 'dark') return 'dark';
      return 'light';
    }
    return savedMode as ViewMode;
  });

  // Derived state for backward compatibility
  const theme = viewMode === 'light' ? 'light' : 'dark';
  const isDarkroom = viewMode === 'darkroom';

  useEffect(() => {
    // Save state
    localStorage.setItem('filmlog_view_mode', viewMode);
    localStorage.setItem('filmlog_theme', theme);
    localStorage.setItem('filmlog_darkroom', String(isDarkroom));

    // Apply classes
    const root = document.documentElement;
    
    if (viewMode === 'dark') {
      root.classList.add('dark');
      root.classList.remove('darkroom-mode');
    } else if (viewMode === 'darkroom') {
      root.classList.add('dark');
      root.classList.add('darkroom-mode');
    } else {
      root.classList.remove('dark');
      root.classList.remove('darkroom-mode');
    }
  }, [viewMode, theme, isDarkroom]);

  const cycleMode = () => {
    setViewMode(prev => {
      if (prev === 'light') return 'dark';
      if (prev === 'dark') return 'darkroom';
      return 'light';
    });
  };

  // Wrapper functions for backward compatibility with existing components
  const toggleTheme = () => cycleMode();
  const toggleDarkroom = () => {
    setViewMode(prev => prev === 'darkroom' ? 'dark' : 'darkroom');
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, isDarkroom, toggleDarkroom, viewMode, cycleMode }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
