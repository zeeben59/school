import React from 'react';
import { cn } from '../../lib/utils';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  icon?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, icon, className, ...props }, ref) => {
    return (
      <div className="w-full space-y-1.5">
        <label className="text-sm font-medium text-slate-700 ml-1">
          {label}
        </label>
        <div className="relative group">
          {icon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand-500 transition-colors">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            className={cn(
              "w-full bg-white text-slate-900 placeholder:text-slate-500 border border-slate-200 rounded-xl py-2.5 transition-all outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500",
              icon ? "pl-10 pr-4" : "px-4",
              error ? "border-red-500 focus:ring-red-500/20 focus:border-red-500" : "hover:border-slate-300",
              className
            )}
            {...props}
          />
        </div>
        {error && (
          <p className="text-xs text-red-500 ml-1 mt-1 font-medium animate-in fade-in slide-in-from-top-1">
            {error}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;
