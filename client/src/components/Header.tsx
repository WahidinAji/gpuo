import React from 'react';
import { GitBranch } from 'lucide-react';

export const Header: React.FC = () => {
  return (
    <header className="border-b bg-background">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <GitBranch className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold">GPUO</h1>
          </div>
          <p className="text-muted-foreground">
            Git Push -u Origin: Cherry-pick and push automation tool
          </p>
        </div>
      </div>
    </header>
  );
};
