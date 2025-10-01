
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({ title, onClose, children }) => {
  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="bg-[#1a1a1a] border border-[#333333] rounded-xl shadow-2xl w-full max-w-md p-6 text-center"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold">{title}</h3>
            <button onClick={onClose} className="p-1 rounded-full hover:bg-[#333333] transition-colors">
              <X size={20} />
            </button>
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            {children}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default Modal;
