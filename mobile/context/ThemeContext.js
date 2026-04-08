import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ThemeContext = createContext(null);

export const COLORS = {
  light: {
    background: '#f9fafb',
    surface: '#ffffff',
    surfaceSecondary: '#f3f4f6',
    border: '#f3f4f6',
    borderStrong: '#e5e7eb',
    text: '#111827',
    textSecondary: '#6b7280',
    textMuted: '#9ca3af',
    primary: '#4f46e5',
    primaryLight: '#ede9fe',
    danger: '#ef4444',
    dangerLight: '#fef2f2',
  },
  dark: {
    background: '#0f0f0f',
    surface: '#1a1a1a',
    surfaceSecondary: '#242424',
    border: '#2a2a2a',
    borderStrong: '#333333',
    text: '#f9fafb',
    textSecondary: '#9ca3af',
    textMuted: '#6b7280',
    primary: '#6366f1',
    primaryLight: '#1e1b4b',
    danger: '#f87171',
    dangerLight: '#2d1515',
  },
};

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('dark_mode').then((val) => {
      if (val === 'true') setIsDark(true);
    });
  }, []);

  const toggleDark = async () => {
    const next = !isDark;
    setIsDark(next);
    await AsyncStorage.setItem('dark_mode', String(next));
  };

  const colors = isDark ? COLORS.dark : COLORS.light;

  return (
    <ThemeContext.Provider value={{ isDark, toggleDark, colors }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
