import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GitCommitPicker } from './components/GitCommitPicker';
import { BranchManager } from './components/BranchManager';
import { ActionHistory } from './components/ActionHistory';
import { Header } from './components/Header';

const queryClient = new QueryClient();

function App() {
  const [activeTab, setActiveTab] = useState<'commits' | 'branches' | 'history'>('commits');

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="flex justify-center mb-8">
            <div className="flex space-x-1 bg-muted p-1 rounded-lg">
              <button
                onClick={() => setActiveTab('commits')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'commits'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Cherry Pick
              </button>
              <button
                onClick={() => setActiveTab('branches')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'branches'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Branches
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'history'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                History
              </button>
            </div>
          </div>

          <div className="max-w-4xl mx-auto">
            {activeTab === 'commits' && <GitCommitPicker />}
            {activeTab === 'branches' && <BranchManager />}
            {activeTab === 'history' && <ActionHistory />}
          </div>
        </div>
      </div>
    </QueryClientProvider>
  );
}

export default App;
