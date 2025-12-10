
import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, maxWidth = 'md' }) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const maxWidthClass = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
  }[maxWidth];

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-0">
        <div 
          className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity" 
          onClick={onClose}
        />

        <div className={`relative transform overflow-hidden rounded-xl bg-secondary border border-gray-700 text-left shadow-xl transition-all sm:my-8 w-full ${maxWidthClass}`}>
          <div className="px-4 py-3 sm:px-6 border-b border-gray-800 flex justify-between items-center bg-gray-900/50">
            <h3 className="text-lg font-semibold leading-6 text-white">{title}</h3>
            <button
              onClick={onClose}
              className="rounded-md text-gray-400 hover:text-white focus:outline-none"
            >
              <X size={20} />
            </button>
          </div>
          <div className="px-4 py-5 sm:p-6 max-h-[80vh] overflow-y-auto">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Modal;
