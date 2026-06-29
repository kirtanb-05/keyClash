import React from 'react';
import ThemeToggle from './ThemeToggle';

/**
 * Header – minimal top bar with the KeyClash logo.
 */
const Header: React.FC = () => {
  return (
    <header className="flex items-center justify-between px-8 py-4 select-none border-b border-bg-tertiary/40">
      {/* Logo */}
      <div className="flex items-center gap-0.5">
        <span className="text-accent-primary font-mono font-bold text-xl tracking-tight">
          key
        </span>
        <span className="text-text-primary font-mono font-bold text-xl tracking-tight">
          clash
        </span>
      </div>

      <ThemeToggle />
    </header>
  );
};

export default Header;
