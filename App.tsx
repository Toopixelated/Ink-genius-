import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, useAnimation, PanInfo } from 'framer-motion';
import { Menu, X, Save, Undo2, Redo2, Settings, Loader2 } from 'lucide-react';
import { useStore } from './types';
import { dbService } from './services/api';
import TattooCanvas from './components/TattooCanvas';
import Sidebar from './components/Sidebar';
import { useAppBodyHeight } from './hooks/useAppBodyHeight';

const Header: React.FC<{ sidebarOpen: boolean; onToggle: () => void; }> = ({ sidebarOpen, onToggle }) => {
    const { undo, redo, isSaving, canvas } = useStore();

    const saveDesign = async () => {
        if (!canvas) return;
        useStore.setState({ isSaving: true });
        try {
            const designData = {
                canvas: JSON.stringify(canvas.toJSON()),
                // FIX: Added multiplier property to toDataURL options to match TDataUrlOptions type.
                thumbnail: canvas.toDataURL({ format: 'png', quality: 0.8, multiplier: 1 }),
                name: 'Design ' + new Date().toLocaleDateString(),
                style: useStore.getState().selectedStyle
            };
            await dbService.saveDesign(designData);
            // Add toast notification logic here
        } catch (error) {
            console.error('Save failed:', error);
        } finally {
            useStore.setState({ isSaving: false });
        }
    };

    return (
        <header className="flex items-center justify-between p-3 bg-[#1a1a1a] border-b border-[#333333] z-40 shrink-0">
            <div className="flex items-center gap-4">
                <button onClick={onToggle} className="p-2 text-gray-300 hover:text-white transition-colors">
                    {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
                </button>
                <h1 className="text-xl font-bold flex items-center gap-2">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 2L2 7V21H22V7L12 2Z" stroke="#00E5FF" strokeWidth="2" strokeLinejoin="round"/>
                        <path d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z" stroke="#FF00E5" strokeWidth="2"/>
                    </svg>
                    InkGenius AI
                </h1>
            </div>
            <div className="flex items-center gap-2">
                <button onClick={undo} className="p-2 text-gray-300 hover:text-white transition-colors disabled:opacity-50" disabled={useStore.getState().historyIndex <= 0}>
                    <Undo2 size={20} />
                </button>
                <button onClick={redo} className="p-2 text-gray-300 hover:text-white transition-colors disabled:opacity-50" disabled={useStore.getState().historyIndex >= useStore.getState().history.length - 1}>
                    <Redo2 size={20} />
                </button>
                <button onClick={saveDesign} disabled={isSaving} className="p-2 text-gray-300 hover:text-white transition-colors disabled:opacity-50">
                    {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                </button>
                <button className="p-2 text-gray-300 hover:text-white transition-colors">
                    <Settings size={20} />
                </button>
            </div>
        </header>
    );
};


const App: React.FC = () => {
    const { undo, redo } = useStore();
    const [isOpen, setIsOpen] = useState(true);
    const [isMobile, setIsMobile] = useState(false);
    const controls = useAnimation();
    const bodyHeight = useAppBodyHeight();
    
    const SIDEBAR_WIDTH = 320; // w-80

    useEffect(() => {
        const handleResize = () => {
            const mobile = window.innerWidth < 768;
            if (mobile !== isMobile) {
                setIsMobile(mobile);
            }
        };
        handleResize(); // Initial check
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [isMobile]);

    useEffect(() => {
        controls.start(isOpen ? 'open' : 'closed');
    }, [isOpen, controls]);

    const sidebarVariants = {
        open: { x: 0 },
        closed: { x: -SIDEBAR_WIDTH },
    };
    
    const mainVariants = {
        open: { marginLeft: isMobile ? 0 : SIDEBAR_WIDTH },
        closed: { marginLeft: 0 },
    };
    
    useEffect(() => {
        const handleKeyboard = (e: KeyboardEvent) => {
            if (e.metaKey || e.ctrlKey) {
                switch (e.key) {
                    case 'z': e.preventDefault(); e.shiftKey ? redo() : undo(); break;
                }
            }
        };
        window.addEventListener('keydown', handleKeyboard);
        return () => window.removeEventListener('keydown', handleKeyboard);
    }, [undo, redo]);

    return (
        <div className="h-screen w-screen bg-[#0a0a0a] text-white flex flex-col antialiased overflow-hidden">
            <Header sidebarOpen={isOpen} onToggle={() => setIsOpen(!isOpen)} />
            <div className="flex-1 flex relative">
                <AnimatePresence>
                    {isOpen && isMobile && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/60 z-20"
                            onClick={() => setIsOpen(false)}
                        />
                    )}
                </AnimatePresence>
                
                <motion.aside
                    drag="x"
                    onDragEnd={(_, info) => {
                        if (info.offset.x < -50 || info.velocity.x < -200) setIsOpen(false);
                        else controls.start('open'); // Snap back
                    }}
                    dragConstraints={{ left: 0, right: 0 }}
                    dragElastic={{ left: 0.1, right: 0 }}
                    initial="open"
                    animate={controls}
                    variants={sidebarVariants}
                    transition={{ type: 'spring', stiffness: 400, damping: 40 }}
                    style={{ height: bodyHeight > 0 ? bodyHeight : 'auto' }}
                    className="w-80 bg-[#1a1a1a] border-r border-[#333333] flex-shrink-0 absolute top-0 left-0 z-30 shadow-2xl flex flex-col"
                >
                    <div className="flex-1 overflow-y-auto min-h-0">
                        <Sidebar />
                    </div>
                </motion.aside>

                <AnimatePresence>
                    {!isOpen && (
                        <motion.button
                            onClick={() => setIsOpen(true)}
                            className="absolute top-0 left-0 h-full w-8 z-20 flex items-center justify-center cursor-pointer group"
                            aria-label="Open sidebar"
                            initial={{ x: -32 }}
                            animate={{ x: 0 }}
                            exit={{ x: -32 }}
                        >
                            <div className="w-1.5 h-24 bg-white/20 rounded-r-full transition-all group-hover:bg-white/30 group-hover:h-32 group-active:h-20" />
                        </motion.button>
                    )}
                </AnimatePresence>
                
                <motion.main
                    animate={controls}
                    variants={mainVariants}
                    transition={{ type: 'spring', stiffness: 400, damping: 40 }}
                    className="flex-1 flex items-center justify-center bg-[#222222] p-4 overflow-auto"
                >
                    <TattooCanvas />
                </motion.main>
            </div>
        </div>
    );
};

export default App;
