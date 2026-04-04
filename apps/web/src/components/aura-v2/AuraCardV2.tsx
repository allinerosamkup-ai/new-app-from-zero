import React from 'react';

interface AuraCardV2Props extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const AuraCardV2: React.FC<AuraCardV2Props> = ({ 
  children, 
  className = '', 
  ...props 
}) => {
  return (
    <div className={`aura-v2-card ${className}`} {...props}>
      {children}
    </div>
  );
};
