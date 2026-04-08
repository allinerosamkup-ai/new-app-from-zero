import React from 'react';

interface AuraInputV2Props extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  icon?: React.ReactNode;
}

export const AuraInputV2: React.FC<AuraInputV2Props> = ({ 
  label, 
  icon, 
  className = '', 
  ...props 
}) => {
  return (
    <div className="editorial-input-wrap">
      <label className="editorial-input-label">{label}</label>
      <div className="editorial-input" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {icon}
        <input 
          className={`editorial-input-element ${className}`} 
          style={{ 
            background: 'transparent', 
            border: 'none', 
            outline: 'none', 
            flex: 1, 
            height: '100%',
            color: 'inherit',
            fontSize: 'inherit'
          }} 
          {...props} 
        />
      </div>
    </div>
  );
};
