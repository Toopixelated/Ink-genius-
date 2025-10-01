
import React, { useState, useRef } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { Type, Wand2, Users, Sparkles, PersonStanding, Brush, Eraser, Download, CheckCircle, Upload, Group, Ungroup, Trash2, Lock, Unlock, Eye, EyeOff, Layers, Bold, Italic, AlignLeft, AlignCenter, AlignRight } from 'lucide-react';
import { useStore, CONFIG, type Tool, type LayerData } from '../types';
import { aiService } from '../services/api';
import Modal from './Modal';
import * as fabric from 'fabric';

const AIToolsPanel: React.FC = () => {
    const { canvas, selectedStyle, setLoading, setStyle, addToHistory } = useStore();
    const [prompt, setPrompt] = useState('');
    const [modalContent, setModalContent] = useState<{title: string, content: React.ReactNode} | null>(null);

    const generateDesign = async () => {
        if (!prompt.trim() || !canvas) return;
        setLoading(true, 'Generating AI design...');
        try {
            const imageUrl = await aiService.generateDesign(prompt, selectedStyle);
            const img = await fabric.Image.fromURL(imageUrl, { crossOrigin: 'anonymous' });
            img.scaleToWidth(canvas.getWidth() / 2);
            canvas.add(img);
            canvas.centerObject(img);
            canvas.setActiveObject(img);
            canvas.renderAll();
            addToHistory();
        } catch (error) {
            console.error('Generation failed:', error);
            setModalContent({ title: 'Error', content: <p className="text-red-400">{(error as Error).message}</p> });
        } finally {
            setLoading(false);
        }
    };

    const convertToStencil = async () => {
        if (!canvas) return;
        setLoading(true, 'Converting to stencil...');
        try {
            const dataUrl = canvas.toDataURL({ format: 'png', multiplier: 1 });
            const [header, base64Data] = dataUrl.split(',');
            const mimeType = header.match(/:(.*?);/)?.[1];
            if (!base64Data || !mimeType) throw new Error("Invalid canvas data.");
            
            const stencilUrl = await aiService.convertToStencil({ data: base64Data, mimeType });
            setModalContent({
                title: 'Stencil Ready!',
                content: (
                    <div className="flex flex-col items-center gap-4">
                        <img src={stencilUrl} alt="Generated Stencil" className="max-w-full rounded-lg border border-[#333333]" />
                        <a href={stencilUrl} download="stencil.png" className="w-full mt-2 flex items-center justify-center gap-2 bg-[#00e5ff] text-black font-bold py-2 px-4 rounded-lg hover:bg-opacity-80 transition-all">
                            <Download size={16} /> Download Stencil
                        </a>
                    </div>
                )
            });
        } catch (error) {
            console.error('Stencil conversion failed:', error);
            setModalContent({ title: 'Error', content: <p className="text-red-400">{(error as Error).message}</p> });
        } finally {
            setLoading(false);
        }
    };
    
    const suggestPlacement = async () => {
        if(!prompt.trim()) {
            setModalContent({ title: 'Input Required', content: <p>Please describe your tattoo idea first to get a placement suggestion.</p> });
            return;
        }
        setLoading(true, 'Getting placement advice...');
        try {
            const suggestions = await aiService.suggestPlacement(prompt, 'Arm'); // Defaulting to Arm for now
            setModalContent({ title: `Placement Advice for ${'Arm'}`, content: (
                <div className="space-y-3 text-left">
                    <p><strong>Size:</strong> {suggestions.size}</p>
                    <p><strong>Placement:</strong> {suggestions.placement}</p>
                    <p><strong>Adjustments:</strong> {suggestions.adjustments}</p>
                    <p><strong>Pain Level:</strong> {suggestions.painLevel}/10</p>
                    <p><strong>Healing:</strong> {suggestions.healing}</p>
                </div>
            )});
        } catch (error) {
            console.error('Placement suggestion failed:', error);
            setModalContent({ title: 'Error', content: <p className="text-red-400">{(error as Error).message}</p> });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-4 space-y-4 border-b border-[#333333]">
            <h3 className="text-lg font-bold">AI Assistant</h3>
            <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe your tattoo idea..."
                rows={3}
                className="w-full p-2 bg-[#0a0a0a] border border-[#333333] rounded-lg focus:ring-2 focus:ring-[#00e5ff] focus:outline-none"
            />
            <div className="space-y-2">
                <label className="text-sm font-medium">Style:</label>
                <select value={selectedStyle} onChange={(e) => setStyle(e.target.value)} className="w-full p-2 bg-[#0a0a0a] border border-[#333333] rounded-lg">
                    {CONFIG.STYLES.map(style => <option key={style} value={style}>{style}</option>)}
                </select>
            </div>
            <button onClick={generateDesign} className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[#00e5ff] to-[#ff00e5] text-black font-bold py-2 px-4 rounded-lg hover:bg-opacity-80 transition-all">
                <Sparkles size={16} /> Generate Design
            </button>
            
            <div className="pt-4 mt-4 border-t border-[#333333]/50">
                <h4 className="text-md font-semibold mb-3">Analysis &amp; Utilities</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                    <button onClick={convertToStencil} className="flex items-center justify-center gap-2 p-2 bg-[#0a0a0a] border border-[#333333] rounded-lg hover:border-[#00e5ff] transition-colors">
                        <Wand2 size={16} /> Stencil
                    </button>
                    <button onClick={suggestPlacement} className="flex items-center justify-center gap-2 p-2 bg-[#0a0a0a] border border-[#333333] rounded-lg hover:border-[#00e5ff] transition-colors">
                        <PersonStanding size={16} /> Placement
                    </button>
                </div>
            </div>

             {modalContent && <Modal title={modalContent.title} onClose={() => setModalContent(null)}>{modalContent.content}</Modal>}
        </div>
    );
};

const LayersPanel: React.FC = () => {
    const { layers, reorderLayers, activeObjectIds, toggleLayerLock, toggleLayerVisibility, groupSelection, ungroupSelection, deleteSelection, toggleLayerSelection, canvas } = useStore();
    const displayedLayers = [...layers].reverse();

    const activeObject = canvas?.getActiveObject();
    const canGroup = activeObject?.type === 'activeSelection';
    const canUngroup = activeObject?.type === 'group';

    const handleReorder = (newOrder: LayerData[]) => {
        reorderLayers(newOrder);
    };

    return (
        <div className="p-4">
            <h3 className="text-lg font-bold mb-3">Layers</h3>
            <div className="flex items-center gap-2 mb-3">
                <button onClick={groupSelection} disabled={!canGroup} className="flex-1 p-2 flex items-center justify-center gap-2 bg-[#0a0a0a] border border-[#333333] rounded-lg hover:border-[#00e5ff] transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                    <Group size={16} />
                </button>
                <button onClick={ungroupSelection} disabled={!canUngroup} className="flex-1 p-2 flex items-center justify-center gap-2 bg-[#0a0a0a] border border-[#333333] rounded-lg hover:border-[#00e5ff] transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                    <Ungroup size={16} />
                </button>
                <button onClick={deleteSelection} disabled={activeObjectIds.length === 0} className="flex-1 p-2 flex items-center justify-center gap-2 bg-[#0a0a0a] border border-[#333333] rounded-lg text-red-400 hover:border-red-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                    <Trash2 size={16} />
                </button>
            </div>
            <Reorder.Group axis="y" values={displayedLayers} onReorder={handleReorder} className="space-y-1">
                {displayedLayers.map(layer => (
                    <Reorder.Item key={layer.id} value={layer}>
                        <div
                            onClick={() => toggleLayerSelection(layer.id)}
                            className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                                activeObjectIds.includes(layer.id) ? 'bg-[#00e5ff]/20' : 'hover:bg-[#333333]/50'
                            }`}
                        >
                            <img src={layer.thumbnail} alt="layer preview" className="w-10 h-10 object-contain bg-white/10 rounded" />
                            <span className="flex-1 text-sm truncate">{layer.name}</span>
                            <button onClick={(e) => { e.stopPropagation(); toggleLayerVisibility(layer.id); }} className="p-1 hover:text-white text-gray-400">
                                {layer.visible ? <Eye size={16} /> : <EyeOff size={16} />}
                            </button>
                             <button onClick={(e) => { e.stopPropagation(); toggleLayerLock(layer.id); }} className="p-1 hover:text-white text-gray-400">
                                {layer.locked ? <Lock size={16} /> : <Unlock size={16} />}
                            </button>
                        </div>
                    </Reorder.Item>
                ))}
            </Reorder.Group>
        </div>
    );
};


const ToolsPanel: React.FC = () => {
    const { selectedTool, setTool, canvas, addToHistory } = useStore();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];

        if (!file || !canvas) {
            setTool('select');
            return;
        }

        const reader = new FileReader();
        reader.onload = async (event) => {
            const dataUrl = event.target?.result as string;
            if (dataUrl) {
                try {
                    const img = await fabric.Image.fromURL(dataUrl, { crossOrigin: 'anonymous' });
                    img.scaleToWidth(canvas.getWidth() / 2);
                    canvas.add(img);
                    canvas.centerObject(img);
                    canvas.setActiveObject(img);
                    canvas.renderAll();
                    addToHistory();
                } catch (error) {
                    console.error("Error loading image: ", error);
                } finally {
                    setTool('select');
                }
            } else {
                setTool('select');
            }
        };
        reader.readAsDataURL(file);

        if (e.target) {
            e.target.value = '';
        }
    };

    const tools: { id: Tool; icon: React.ReactNode; label: string }[] = [
        { id: 'select', icon: <CheckCircle size={20} />, label: 'Select' },
        { id: 'image', icon: <Upload size={20} />, label: 'Upload' },
        { id: 'layers', icon: <Layers size={20} />, label: 'Layers' },
        { id: 'draw', icon: <Brush size={20} />, label: 'Draw' },
        { id: 'eraser', icon: <Eraser size={20} />, label: 'Eraser' },
        { id: 'text', icon: <Type size={20} />, label: 'Text' },
        { id: 'ai', icon: <Sparkles size={20} />, label: 'AI' },
    ];

    return (
        <div className="p-4 border-b border-[#333333]">
            <h3 className="text-lg font-bold mb-3">Tools</h3>
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageUpload}
                style={{ display: 'none' }}
                accept="image/*"
            />
            <div className="grid grid-cols-3 gap-2">
                {tools.map(tool => (
                    <button
                        key={tool.id}
                        className={`aspect-square flex flex-col items-center justify-center gap-1 p-2 rounded-lg border transition-all duration-200 ${
                            selectedTool === tool.id
                                ? 'bg-[#00e5ff] text-black border-[#00e5ff] scale-105 shadow-lg shadow-[#00e5ff]/20'
                                : tool.id === 'ai' 
                                ? 'bg-gradient-to-br from-[#00e5ff]/10 to-[#ff00e5]/10 border-[#ff00e5]/40 hover:border-[#ff00e5] hover:shadow-[0_0_15px_rgba(255,0,229,0.4)] hover:scale-105'
                                : 'bg-[#0a0a0a] border-[#333333] hover:border-[#00e5ff] hover:scale-105'
                        }`}
                        onClick={() => {
                            if (tool.id === 'image') {
                                fileInputRef.current?.click();
                            }
                            setTool(tool.id);
                        }}
                        title={tool.label}
                    >
                        {tool.icon}
                        <span className="text-xs">{tool.label}</span>
                    </button>
                ))}
            </div>
        </div>
    );
};

const DrawingOptionsPanel: React.FC = () => {
    const { brushSize, setBrushSize, brushOpacity, setBrushOpacity, selectedTool } = useStore();

    return (
        <div className="p-4 border-b border-[#333333] space-y-4">
            <h3 className="text-lg font-bold">Brush Options</h3>
            <div className="space-y-2">
                <label htmlFor="brush-size" className="text-sm font-medium flex justify-between">
                    Size <span>{brushSize}px</span>
                </label>
                <input
                    id="brush-size"
                    type="range"
                    min="1"
                    max="100"
                    value={brushSize}
                    onChange={(e) => setBrushSize(parseInt(e.target.value, 10))}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-[#00e5ff]"
                />
            </div>
            {selectedTool === 'draw' && (
                <div className="space-y-2">
                    <label htmlFor="brush-opacity" className="text-sm font-medium flex justify-between">
                        Opacity <span>{Math.round(brushOpacity * 100)}%</span>
                    </label>
                    <input
                        id="brush-opacity"
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={brushOpacity}
                        onChange={(e) => setBrushOpacity(parseFloat(e.target.value))}
                        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-[#00e5ff]"
                    />
                </div>
            )}
        </div>
    );
};

const FONT_FAMILIES = ['Inter', 'Arial', 'Helvetica', 'Times New Roman', 'Courier New', 'Verdana', 'Georgia'];

const TextOptionsPanel: React.FC = () => {
    const { 
        fontFamily, setFontFamily,
        fontSize, setFontSize,
        fontWeight, setFontWeight,
        fontStyle, setFontStyle,
        textAlign, setTextAlign
    } = useStore();

    return (
        <div className="p-4 border-b border-[#333333] space-y-4">
            <h3 className="text-lg font-bold">Text Options</h3>
            <div className="space-y-2">
                 <label htmlFor="font-family" className="text-sm font-medium">Font</label>
                 <select 
                    id="font-family" 
                    value={fontFamily} 
                    onChange={(e) => setFontFamily(e.target.value)} 
                    className="w-full p-2 bg-[#0a0a0a] border border-[#333333] rounded-lg"
                >
                    {FONT_FAMILIES.map(font => <option key={font} value={font}>{font}</option>)}
                </select>
            </div>
            <div className="space-y-2">
                <label htmlFor="font-size" className="text-sm font-medium">Size</label>
                <input 
                    id="font-size" 
                    type="number" 
                    value={fontSize}
                    onChange={(e) => setFontSize(parseInt(e.target.value, 10))}
                    className="w-full p-2 bg-[#0a0a0a] border border-[#333333] rounded-lg"
                />
            </div>
            <div className="grid grid-cols-2 gap-2">
                <div className="flex rounded-lg border border-[#333333]">
                    <button 
                        onClick={() => setFontWeight(fontWeight === 'bold' ? 'normal' : 'bold')}
                        className={`flex-1 p-2 transition-colors ${fontWeight === 'bold' ? 'bg-[#00e5ff] text-black' : 'hover:bg-[#333]'}`}
                    ><Bold size={16}/></button>
                    <button 
                        onClick={() => setFontStyle(fontStyle === 'italic' ? 'normal' : 'italic')}
                        className={`flex-1 p-2 transition-colors ${fontStyle === 'italic' ? 'bg-[#00e5ff] text-black' : 'hover:bg-[#333]'}`}
                    ><Italic size={16}/></button>
                </div>
                 <div className="flex rounded-lg border border-[#333333]">
                    <button 
                        onClick={() => setTextAlign('left')}
                        className={`flex-1 p-2 transition-colors ${textAlign === 'left' ? 'bg-[#00e5ff] text-black' : 'hover:bg-[#333]'}`}
                    ><AlignLeft size={16}/></button>
                    <button 
                        onClick={() => setTextAlign('center')}
                        className={`flex-1 p-2 transition-colors ${textAlign === 'center' ? 'bg-[#00e5ff] text-black' : 'hover:bg-[#333]'}`}
                    ><AlignCenter size={16}/></button>
                    <button 
                        onClick={() => setTextAlign('right')}
                        className={`flex-1 p-2 transition-colors ${textAlign === 'right' ? 'bg-[#00e5ff] text-black' : 'hover:bg-[#333]'}`}
                    ><AlignRight size={16}/></button>
                </div>
            </div>

        </div>
    );
};

const TATTOO_COLORS = [
    '#000000', '#2F2F2F', '#5F5F5F', '#9F9F9F', '#FFFFFF',
    '#D0021B', '#F5A623', '#F8E71C', '#7ED321', '#4A90E2',
    '#9013FE', '#BD10E0', '#50E3C2', '#417505', '#B8E986',
];

const ColorPalettePanel: React.FC = () => {
    const { selectedColor, setSelectedColor } = useStore();

    return (
        <div className="p-4 border-b border-[#333333]">
            <h3 className="text-lg font-bold mb-3">Color Palette</h3>
            <div className="grid grid-cols-5 gap-3">
                {TATTOO_COLORS.map(color => (
                    <button
                        key={color}
                        onClick={() => setSelectedColor(color)}
                        className={`w-full aspect-square rounded-full border-2 transition-transform transform hover:scale-110 ${
                            selectedColor.toLowerCase() === color.toLowerCase()
                                ? 'border-white ring-2 ring-offset-2 ring-offset-[#1a1a1a] ring-white'
                                : 'border-transparent'
                        }`}
                        style={{ backgroundColor: color }}
                        title={color}
                        aria-label={`Select color ${color}`}
                    />
                ))}
            </div>
        </div>
    );
};

const Sidebar: React.FC = () => {
    const { selectedTool, activeObjectType } = useStore();

    const showDrawingOptions = selectedTool === 'draw' || selectedTool === 'eraser';
    const showTextOptions = selectedTool === 'text' || activeObjectType === 'i-text';
    const showAITools = selectedTool === 'ai';
    const showLayers = selectedTool === 'layers';
    const showColorPalette = ['draw', 'text', 'select'].includes(selectedTool);

    return (
        <div className="pb-8">
            <ToolsPanel />
            {showColorPalette && <ColorPalettePanel />}

            {/* Context-aware panels rendered in a stable, scrollable layout */}
            {showDrawingOptions && <DrawingOptionsPanel />}
            {showTextOptions && <TextOptionsPanel />}
            {showAITools && <AIToolsPanel />}
            {showLayers && <LayersPanel />}
        </div>
    );
};

export default Sidebar;
