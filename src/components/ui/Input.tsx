import React, { forwardRef, ReactNode } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  endAdornment?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({ label, error, endAdornment, className = '', ...props }, ref) => {
  return (
    <div className="w-full">
      {label && <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase tracking-wider">{label}</label>}
      <div className="relative">
        <input
          ref={ref}
          className={`w-full bg-marvil-dark border ${error ? 'border-red-500' : 'border-marvil-border'} rounded px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-marvil-orange focus:ring-1 focus:ring-marvil-orange transition-colors duration-200 ${endAdornment ? 'pr-10' : ''} ${className}`}
          {...props}
        />
        {endAdornment && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-white cursor-pointer">
            {endAdornment}
          </div>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-red-500 font-medium">{error}</p>}
    </div>
  );
});

Input.displayName = 'Input';