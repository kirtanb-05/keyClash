import React from 'react';

const Footer: React.FC = () => (
  <footer className="text-center py-5 text-text-muted text-xs font-mono select-none border-t border-bg-tertiary/40">
    keyclash · press{' '}
    <kbd className="inline-block bg-bg-secondary text-text-secondary px-1.5 py-0.5 rounded border border-bg-tertiary text-[10px] font-mono leading-none translate-y-[-1px]">
      tab
    </kbd>{' '}
    to restart
  </footer>
);

export default Footer;
