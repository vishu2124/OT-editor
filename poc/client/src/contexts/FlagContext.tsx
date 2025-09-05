import React, { createContext, useContext } from 'react';

interface FlagContextType {
  addFlag: (flag: any) => void;
  removeFlag: (id: number) => void;
}

const FlagContext = createContext<FlagContextType | undefined>(undefined);

export const FlagProvider: React.FC<{ value: FlagContextType; children: React.ReactNode }> = ({ 
  value, 
  children 
}) => {
  return (
    <FlagContext.Provider value={value}>
      {children}
    </FlagContext.Provider>
  );
};

export const useFlag = () => {
  const context = useContext(FlagContext);
  if (context === undefined) {
    throw new Error('useFlag must be used within a FlagProvider');
  }
  return context;
};
