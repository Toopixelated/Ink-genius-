import * as fabric from 'fabric';
import { create } from 'zustand';
import type { IDBPDatabase } from 'idb';

// === CONFIGURATION ===
export const CONFIG = {
  CANVAS: {
    WIDTH: 1024,
    HEIGHT: 768,
    MAX_HISTORY: 50,
  },
  STYLES: [
    'Traditional', 'Neo-Traditional', 'Realism', 'Watercolor',
    'Geometric', 'Minimalist', 'Blackwork', 'Japanese',
    'American Traditional', 'Tribal', 'Biomechanical', 'Dotwork'
  ],
  BODY_PARTS: [
    'Arm', 'Forearm', 'Shoulder', 'Back', 'Chest',
    'Leg', 'Thigh', 'Calf', 'Ankle', 'Wrist', 'Neck'
  ]
};

// === DATABASE SCHEMA ===
export interface InkGeniusDB extends IDBPDatabase {
    designs: {
        key: string;
        value: {
            id: string;
            canvas: string;
            thumbnail: string;
            name: string;
            style: string;
            timestamp: string;
        };
        indexes: { 'timestamp': string };
    };
}

// === STATE MANAGEMENT ===
export type Tool = 'select' | 'draw' | 'eraser' | 'text' | 'image' | 'ai' | 'layers';
type FontWeight = 'normal' | 'bold';
type FontStyle = 'normal' | 'italic';
type TextAlign = 'left' | 'center' | 'right' | 'justify';

export interface LayerData {
    id: string;
    name: string;
    type?: string;
    thumbnail: string;
    locked: boolean;
    visible: boolean;
}

export interface AppState {
  canvas: fabric.Canvas | null;
  history: string[];
  historyIndex: number;
  selectedTool: Tool;
  selectedStyle: string;
  isLoading: boolean;
  loadingMessage: string;
  isSaving: boolean;
  selectedColor: string;
  brushSize: number;
  brushOpacity: number;
  layers: LayerData[];
  activeObjectIds: string[];
  fontFamily: string;
  fontSize: number;
  fontWeight: FontWeight;
  fontStyle: FontStyle;
  textAlign: TextAlign;
  activeObjectType: string | null;
  setCanvas: (canvas: fabric.Canvas) => void;
  addToHistory: () => void;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
  setTool: (tool: Tool) => void;
  setStyle: (style: string) => void;
  setLoading: (loading: boolean, message?: string) => void;
  setSaving: (saving: boolean) => void;
  clearHistory: () => void;
  setSelectedColor: (color: string) => void;
  setBrushSize: (size: number) => void;
  setBrushOpacity: (opacity: number) => void;
  updateLayers: () => void;
  setActiveObjectIds: (ids: string[]) => void;
  reorderLayers: (newOrder: LayerData[]) => void;
  toggleLayerLock: (id: string) => void;
  toggleLayerVisibility: (id: string) => void;
  groupSelection: () => void;
  ungroupSelection: () => void;
  deleteSelection: () => void;
  toggleLayerSelection: (id: string) => void;
  setFontFamily: (family: string) => void;
  setFontSize: (size: number) => void;
  setFontWeight: (weight: FontWeight) => void;
  setFontStyle: (style: FontStyle) => void;
  setTextAlign: (align: TextAlign) => void;
  setActiveObjectType: (type: string | null) => void;
}

const getObjectName = (obj: fabric.Object): string => {
    if (obj.isType('i-text') && (obj as fabric.IText).text) {
        return (obj as fabric.IText).text!.substring(0, 20) || 'Text';
    }
    if (obj.type) {
       return obj.type.charAt(0).toUpperCase() + obj.type.slice(1);
    }
    return 'Object';
};

export const useStore = create<AppState>((set, get) => ({
  canvas: null,
  history: [],
  historyIndex: -1,
  selectedTool: 'ai',
  selectedStyle: 'Traditional',
  isLoading: false,
  loadingMessage: 'AI is thinking...',
  isSaving: false,
  selectedColor: '#000000',
  brushSize: 5,
  brushOpacity: 1,
  layers: [],
  activeObjectIds: [],
  fontFamily: 'Inter',
  fontSize: 28,
  fontWeight: 'normal',
  fontStyle: 'normal',
  textAlign: 'left',
  activeObjectType: null,
  
  setCanvas: (canvas) => set({ canvas }),
  
  addToHistory: () => {
    const canvas = get().canvas;
    if (!canvas) return;
    // FIX: canvas.toJSON() doesn't accept arguments. The custom 'id' property is
    // handled by a monkey-patch in TattooCanvas.tsx.
    const state = JSON.stringify(canvas.toJSON());
    set((prev) => {
      if (prev.history[prev.historyIndex] === state) return {};
      const newHistory = prev.history.slice(0, prev.historyIndex + 1);
      newHistory.push(state);
      if (newHistory.length > CONFIG.CANVAS.MAX_HISTORY) newHistory.shift();
      return { 
        history: newHistory, 
        historyIndex: newHistory.length - 1 
      };
    });
  },
  
  undo: async () => {
    const { canvas, history, historyIndex } = get();
    if (canvas && historyIndex > 0) {
      const newIndex = historyIndex - 1;
      await new Promise<void>((resolve) => {
        canvas.loadFromJSON(JSON.parse(history[newIndex]), () => {
          canvas.renderAll();
          resolve();
        });
      });
      get().updateLayers();
      set({ historyIndex: newIndex });
    }
  },
  
  redo: async () => {
    const { canvas, history, historyIndex } = get();
    if (canvas && historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      await new Promise<void>((resolve) => {
        canvas.loadFromJSON(JSON.parse(history[newIndex]), () => {
            canvas.renderAll();
            resolve();
        });
      });
      get().updateLayers();
      set({ historyIndex: newIndex });
    }
  },
  
  setTool: (tool) => set({ selectedTool: tool }),
  setStyle: (style) => set({ selectedStyle: style }),
  setLoading: (loading, message = 'AI is thinking...') => set({ isLoading: loading, loadingMessage: message }),
  setSaving: (saving) => set({ isSaving: saving }),
  clearHistory: () => set({ history: [], historyIndex: -1 }),
  setSelectedColor: (color) => set({ selectedColor: color }),
  setBrushSize: (size) => set({ brushSize: size }),
  setBrushOpacity: (opacity) => set({ brushOpacity: opacity }),
  setFontFamily: (family) => set({ fontFamily: family }),
  setFontSize: (size) => set({ fontSize: size }),
  setFontWeight: (weight) => set({ fontWeight: weight }),
  setFontStyle: (style) => set({ fontStyle: style }),
  setTextAlign: (align) => set({ textAlign: align }),
  setActiveObjectType: (type) => set({ activeObjectType: type }),

  updateLayers: () => {
      const canvas = get().canvas;
      if (!canvas) return;
      const objects = canvas.getObjects();
      const newLayers: LayerData[] = objects.map(obj => ({
          id: (obj as any).id!,
          name: getObjectName(obj),
          type: obj.type,
          thumbnail: obj.toDataURL({ format: 'png', withoutTransform: true, width: 40, height: 40 }),
          locked: !obj.selectable,
          visible: obj.visible || false,
      })).filter(layer => layer.id);
      set({ layers: newLayers });
  },

  setActiveObjectIds: (ids) => set({ activeObjectIds: ids }),
  
  reorderLayers: (newOrder: LayerData[]) => {
      const { canvas, updateLayers, addToHistory } = get();
      if (!canvas) return;
      const newCanvasOrder = [...newOrder].reverse();
      newCanvasOrder.forEach(layer => {
          const obj = canvas.getObjects().find(o => (o as any).id === layer.id);
          if (obj) {
              canvas.remove(obj);
              canvas.add(obj);
          }
      });
      canvas.renderAll();
      addToHistory();
      updateLayers();
  },
  
  toggleLayerLock: (id: string) => {
      const { canvas, updateLayers, addToHistory } = get();
      if (!canvas) return;
      const obj = canvas.getObjects().find(o => (o as any).id === id);
      if (obj) {
          obj.set({
              selectable: !obj.selectable,
              evented: !obj.evented,
          });
          canvas.renderAll();
          addToHistory();
          updateLayers();
      }
  },
  
  toggleLayerVisibility: (id: string) => {
      const { canvas, updateLayers, addToHistory } = get();
      if (!canvas) return;
      const obj = canvas.getObjects().find(o => (o as any).id === id);
      if (obj) {
          obj.set({ visible: !obj.visible });
          canvas.renderAll();
          addToHistory();
          updateLayers();
      }
  },

  groupSelection: () => {
      const { canvas, updateLayers, addToHistory } = get();
      if (!canvas) return;
      const activeObject = canvas.getActiveObject();
      if (!activeObject || activeObject.type !== 'activeSelection') return;

      const group = (activeObject as any).toGroup();
      (group as any).id = `fabric_${Date.now()}`;
      canvas.requestRenderAll();
      addToHistory();
      updateLayers();
  },

  ungroupSelection: () => {
      const { canvas, updateLayers, addToHistory } = get();
      if (!canvas) return;
      const activeObject = canvas.getActiveObject();
      if (!activeObject || activeObject.type !== 'group') return;
      
      const group = activeObject as fabric.Group;
      // FIX: Cast to 'any' to access toActiveSelection on a group, which might be
      // a type definition issue with fabric.js. This is a functional workaround.
      (group as any).toActiveSelection();
      canvas.requestRenderAll();
      addToHistory();
      updateLayers();
  },
  
  deleteSelection: () => {
      const { canvas, updateLayers, addToHistory } = get();
      if (!canvas) return;
      canvas.getActiveObjects().forEach(obj => canvas.remove(obj));
      canvas.discardActiveObject();
      canvas.requestRenderAll();
      addToHistory();
      updateLayers();
  },

  toggleLayerSelection: (id: string) => {
    const { canvas, activeObjectIds } = get();
    if (!canvas) return;

    const currentSelection = new Set(activeObjectIds);
    if (currentSelection.has(id)) {
        currentSelection.delete(id);
    } else {
        currentSelection.add(id);
    }
    const newActiveIds = Array.from(currentSelection);

    const selectedObjects = canvas.getObjects().filter(obj => newActiveIds.includes((obj as any).id));

    canvas.discardActiveObject();
    if (selectedObjects.length === 1) {
        canvas.setActiveObject(selectedObjects[0]);
    } else if (selectedObjects.length > 1) {
        const sel = new fabric.ActiveSelection(selectedObjects, { canvas: canvas });
        canvas.setActiveObject(sel);
    }
    canvas.requestRenderAll();
  }
}));