import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as fabric from 'fabric';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore, CONFIG, type Tool } from '../types';
import { ZoomIn, ZoomOut, RotateCw, Grid3x3, Loader2 } from 'lucide-react';

const CanvasToolbar: React.FC<{
    zoom: number;
    showGrid: boolean;
    onZoom: (delta: number) => void;
    onResetZoom: () => void;
    onRotate: () => void;
    onToggleGrid: () => void;
}> = ({ zoom, onZoom, onResetZoom, onRotate, onToggleGrid, showGrid }) => {
    return (
        <div className="absolute bottom-4 right-4 flex flex-col items-end gap-2 z-10">
            <div className="bg-[#1a1a1a] border border-[#333333] rounded-lg p-1 flex items-center gap-1 shadow-lg">
                <button onClick={onRotate} className="p-2 hover:bg-[#333] rounded-md transition-colors"><RotateCw size={20} /></button>
                <button onClick={onToggleGrid} className={`p-2 hover:bg-[#333] rounded-md transition-colors ${showGrid ? 'text-[#00e5ff]' : ''}`}><Grid3x3 size={20} /></button>
            </div>
            <div className="bg-[#1a1a1a] border border-[#333333] rounded-lg p-1 flex items-center gap-1 shadow-lg">
                <button onClick={() => onZoom(-10)} className="p-2 hover:bg-[#333] rounded-md transition-colors"><ZoomOut size={20} /></button>
                <button onClick={onResetZoom} className="w-16 text-center text-sm font-semibold p-2 hover:bg-[#333] rounded-md transition-colors">{zoom}%</button>
                <button onClick={() => onZoom(10)} className="p-2 hover:bg-[#333] rounded-md transition-colors"><ZoomIn size={20} /></button>
            </div>
        </div>
    );
};

const hexToRgba = (hex: string, opacity: number): string => {
    let c: any = hex.substring(1).split('');
    if (c.length === 3) {
        c = [c[0], c[0], c[1], c[1], c[2], c[2]];
    }
    c = '0x' + c.join('');
    const r = (c >> 16) & 255;
    const g = (c >> 8) & 255;
    const b = c & 255;
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

const TattooCanvas: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const { 
        setCanvas, addToHistory, selectedTool, isLoading, loadingMessage, canvas,
        selectedColor, brushSize, brushOpacity, updateLayers, setActiveObjectIds,
        fontFamily, fontSize, fontWeight, fontStyle, textAlign
    } = useStore();
    const [zoom, setZoom] = useState(100);
    const [showGrid, setShowGrid] = useState(false);
    const previousColorRef = useRef(selectedColor);
    
    useEffect(() => {
        if (!canvasRef.current) return;

        // @ts-ignore
        fabric.Object.prototype.toObject = (function (toObject) {
            return function (propertiesToInclude) {
                propertiesToInclude = (propertiesToInclude || []).concat(['id']);
                return toObject.call(this, propertiesToInclude);
            };
        })(fabric.Object.prototype.toObject);

        const fabricCanvas = new fabric.Canvas(canvasRef.current, {
            width: CONFIG.CANVAS.WIDTH,
            height: CONFIG.CANVAS.HEIGHT,
            backgroundColor: '#ffffff',
            preserveObjectStacking: true
        });
        
        const handleModified = () => {
            addToHistory();
            updateLayers();
        };
        const handleSelection = () => {
            const { setActiveObjectType, setFontFamily, setFontSize, setFontWeight, setFontStyle, setTextAlign } = useStore.getState();
            const activeObjects = fabricCanvas.getActiveObjects();
            const ids = activeObjects.map(obj => (obj as any).id || '');
            setActiveObjectIds(ids.filter(Boolean));

            if (activeObjects.length === 1) {
                const activeObject = activeObjects[0];
                setActiveObjectType(activeObject.type || null);
                if (activeObject.isType('i-text')) {
                    const textObject = activeObject as fabric.IText;
                    setFontFamily(textObject.fontFamily || 'Inter');
                    setFontSize(textObject.fontSize || 28);
                    setFontWeight(textObject.fontWeight === 'bold' ? 'bold' : 'normal');
                    setFontStyle(textObject.fontStyle === 'italic' ? 'italic' : 'normal');
                    setTextAlign((textObject.textAlign as 'left' | 'center' | 'right' | 'justify') || 'left');
                }
            } else if (activeObjects.length > 1) {
                setActiveObjectType('activeSelection');
            } else {
                setActiveObjectType(null);
            }
        }
        
        fabricCanvas.on('object:added', (e) => {
            if(e.target) (e.target as any).id = (e.target as any).id || `fabric_${Date.now()}`;
            handleModified();
        });
        fabricCanvas.on('object:removed', handleModified);
        fabricCanvas.on('object:modified', handleModified);
        fabricCanvas.on('path:created', handleModified);

        fabricCanvas.on('selection:created', handleSelection);
        fabricCanvas.on('selection:updated', handleSelection);
        fabricCanvas.on('selection:cleared', handleSelection);
        
        setCanvas(fabricCanvas);
        addToHistory();
        updateLayers();

        return () => {
            fabricCanvas.off();
            fabricCanvas.dispose();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const updateTool = useCallback((tool: Tool, currentCanvas: fabric.Canvas) => {
        currentCanvas.isDrawingMode = false;
        currentCanvas.selection = tool === 'select' || tool === 'text'; // Allow selection for text tool
        currentCanvas.defaultCursor = 'default';
        currentCanvas.off('mouse:down');

        if (tool === 'draw') {
            currentCanvas.isDrawingMode = true;
            currentCanvas.freeDrawingBrush = new fabric.PencilBrush(currentCanvas);
            currentCanvas.freeDrawingBrush.width = brushSize;
            currentCanvas.freeDrawingBrush.color = hexToRgba(selectedColor, brushOpacity);
        } else if (tool === 'eraser') {
            currentCanvas.isDrawingMode = true;
            currentCanvas.freeDrawingBrush = new fabric.PencilBrush(currentCanvas);
            currentCanvas.freeDrawingBrush.width = brushSize;
            currentCanvas.freeDrawingBrush.color = '#ffffff'; // Use white to simulate erasing
        } else if (tool === 'text') {
            currentCanvas.defaultCursor = 'text';
            currentCanvas.on('mouse:down', (o) => {
                if (o.target) return;
                const pointer = currentCanvas.getPointer(o.e);
                const { fontFamily, fontSize, fontWeight, fontStyle, textAlign, selectedColor } = useStore.getState();
                const text = new fabric.IText('Tap to edit', {
                    left: pointer.x,
                    top: pointer.y,
                    fontFamily,
                    fontSize,
                    fontWeight,
                    fontStyle,
                    textAlign,
                    fill: selectedColor,
                    id: `fabric_${Date.now()}`
                });
                currentCanvas.add(text);
                currentCanvas.setActiveObject(text);
                text.enterEditing();
                text.selectAll();
            });
        }
    }, [brushSize, brushOpacity, selectedColor]);

    useEffect(() => {
        if (canvas) {
            updateTool(selectedTool, canvas);
        }
    }, [canvas, selectedTool, updateTool]);

    useEffect(() => {
        if (canvas?.isDrawingMode) {
            if (selectedTool === 'draw') {
                canvas.freeDrawingBrush.width = brushSize;
                canvas.freeDrawingBrush.color = hexToRgba(selectedColor, brushOpacity);
            } else if (selectedTool === 'eraser') {
                canvas.freeDrawingBrush.width = brushSize;
                canvas.freeDrawingBrush.color = '#ffffff';
            }
        }
    }, [canvas, brushSize, brushOpacity, selectedColor, selectedTool]);
    
    useEffect(() => {
        if (canvas && selectedColor !== previousColorRef.current) {
            const activeObjects = canvas.getActiveObjects();
            if (activeObjects.length > 0) {
                 activeObjects.forEach(obj => {
                    if (obj.isType('path')) {
                       obj.set('stroke', selectedColor);
                    } else if(obj.isType('i-text')) {
                       obj.set('fill', selectedColor);
                    }
                 });
                canvas.renderAll();
                addToHistory();
                updateLayers();
            }
            previousColorRef.current = selectedColor;
        }
    }, [selectedColor, canvas, addToHistory, updateLayers]);

    useEffect(() => {
        if (!canvas) return;
        const activeObjects = canvas.getActiveObjects();
        if (activeObjects.length > 0) {
            let needsRender = false;
            activeObjects.forEach(obj => {
                if (obj.isType('i-text')) {
                    const textObject = obj as fabric.IText;
                    const newStyles: any = {};
                    if (textObject.fontFamily !== fontFamily) newStyles.fontFamily = fontFamily;
                    if (textObject.fontSize !== fontSize) newStyles.fontSize = fontSize;
                    if (textObject.fontWeight !== fontWeight) newStyles.fontWeight = fontWeight;
                    if (textObject.fontStyle !== fontStyle) newStyles.fontStyle = fontStyle;
                    if (textObject.textAlign !== textAlign) newStyles.textAlign = textAlign;

                    if (Object.keys(newStyles).length > 0) {
                        textObject.set(newStyles);
                        needsRender = true;
                    }
                }
            });

            if (needsRender) {
                canvas.requestRenderAll();
                addToHistory();
                updateLayers();
            }
        }
    }, [fontFamily, fontSize, fontWeight, fontStyle, textAlign, canvas, addToHistory, updateLayers]);


    const handleZoom = (delta: number) => {
        if (!canvas) return;
        const newZoom = Math.max(50, Math.min(200, zoom + delta));
        setZoom(newZoom);
        const center = new fabric.Point(canvas.getWidth() / 2, canvas.getHeight() / 2);
        canvas.zoomToPoint(center, newZoom / 100);
        canvas.renderAll();
    };

    const resetZoom = () => {
        if (!canvas) return;
        setZoom(100);
        const center = new fabric.Point(canvas.getWidth() / 2, canvas.getHeight() / 2);
        canvas.zoomToPoint(center, 1);
        canvas.renderAll();
    };

    const rotateCanvas = () => {
        const activeObject = canvas?.getActiveObject();
        if (activeObject) {
            activeObject.rotate((activeObject.angle || 0) + 90);
            canvas?.renderAll();
            addToHistory();
        }
    };
    
    return (
        <div className="relative w-full h-full flex items-center justify-center">
            <CanvasToolbar 
                zoom={zoom}
                showGrid={showGrid}
                onZoom={handleZoom}
                onResetZoom={resetZoom}
                onRotate={rotateCanvas}
                onToggleGrid={() => setShowGrid(!showGrid)}
            />
            <div className="bg-white rounded-lg shadow-2xl shadow-black/50">
                <canvas ref={canvasRef} />
            </div>
            <AnimatePresence>
                {isLoading && (
                    <motion.div 
                        className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center z-20"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <Loader2 className="animate-spin text-[#00e5ff]" size={48} />
                        <p className="mt-4 text-lg font-semibold">{loadingMessage}</p>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default TattooCanvas;