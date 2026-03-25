import React, { useState, useRef, useEffect } from 'react';
import { Project, ChartData } from '../lib/store';
import { Trash2, Palette, Maximize2, Minimize2, ZoomIn, ZoomOut, Pencil, PaintBucket, MousePointer2 } from 'lucide-react';
import { cn } from '../lib/utils';

interface Props {
  project: Project;
  onUpdate: (project: Project) => void;
  currentRow: number;
}

const DEFAULT_COLORS = ['#ffffff', '#000000', '#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7', '#f97316', '#ec4899', '#64748b'];

export const KNITTING_SYMBOLS = [
  { id: 'none', label: 'Clear Symbol', symbol: '', description: 'Remove symbol' },
  { id: 'knit', label: 'Knit', symbol: '｜', description: 'Knit stitch' },
  { id: 'purl', label: 'Purl', symbol: '—', description: 'Purl stitch' },
  { id: 'yo', label: 'Yarn Over', symbol: '○', description: 'Yarn over (increase)' },
  { id: 'k2tog', label: 'K2tog', symbol: '／', description: 'Knit 2 together (right-leaning decrease)' },
  { id: 'ssk', label: 'SSK', symbol: '＼', description: 'Slip, slip, knit (left-leaning decrease)' },
  { id: 'p2tog', label: 'P2tog', symbol: 'p2t', description: 'Purl 2 together (right-leaning purl decrease)' },
  { id: 'ssp', label: 'SSP', symbol: 'ssp', description: 'Slip, slip, purl (left-leaning purl decrease)' },
  { id: 'cdd', label: 'CDD', symbol: 'cdd', description: 'Centered double decrease (sl2, k1, p2sso)' },
  { id: 'k3tog', label: 'K3tog', symbol: 'k3t', description: 'Knit 3 together (right double decrease)' },
  { id: 'sssk', label: 'SSSK', symbol: 's3k', description: 'Slip, slip, slip, knit (left double decrease)' },
  { id: 'sl1', label: 'Sl 1', symbol: 'V', description: 'Slip 1 stitch' },
  { id: 'm1', label: 'M1', symbol: 'M', description: 'Make 1 stitch (increase)' },
  { id: 'm1l', label: 'M1L', symbol: 'M1L', description: 'Make 1 Left (left-leaning increase)' },
  { id: 'm1r', label: 'M1R', symbol: 'M1R', description: 'Make 1 Right (right-leaning increase)' },
  { id: 'cable', label: 'Cable', symbol: 'C', description: 'Cable stitch' },
];

export function KnittingChart({ project, onUpdate, currentRow }: Props) {
  const chart: ChartData = project.chart || { width: 20, height: 20, cells: {} };
  const [paintMode, setPaintMode] = useState<'color' | 'symbol'>('color');
  const [activeColor, setActiveColor] = useState(DEFAULT_COLORS[1]);
  const [activeSymbol, setActiveSymbol] = useState('knit');
  const [customColor, setCustomColor] = useState('#14b8a6');
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState<'draw' | 'replace' | 'select'>('draw');
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
  const [selectionStart, setSelectionStart] = useState<{x: number, y: number} | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [cursorPos, setCursorPos] = useState<{x: number, y: number} | null>(null);
  const [longPressCell, setLongPressCell] = useState<string | null>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const stateRef = useRef({ cursorPos, selectionStart, selectedCells, chart, activeColor, activeSymbol, paintMode, tool });
  const updateChartRef = useRef((updates: Partial<ChartData>) => {});

  const updateChart = (updates: Partial<ChartData>) => {
    onUpdate({ ...project, chart: { ...chart, ...updates } });
  };

  useEffect(() => {
    stateRef.current = { cursorPos, selectionStart, selectedCells, chart, activeColor, activeSymbol, paintMode, tool };
    updateChartRef.current = updateChart;
  });

  const handleCellInteract = (x: number, y: number) => {
    const newCells = { ...chart.cells };
    const newSymbols = { ...(chart.symbols || {}) };

    if (paintMode === 'color') {
      if (activeColor === '#ffffff') {
        delete newCells[`${x},${y}`];
      } else {
        newCells[`${x},${y}`] = activeColor;
      }
    } else {
      if (activeSymbol === 'none') {
        delete newSymbols[`${x},${y}`];
      } else {
        newSymbols[`${x},${y}`] = activeSymbol;
      }
    }
    updateChart({ cells: newCells, symbols: newSymbols });
  };

  const handleColorSelect = (c: string) => {
    setActiveColor(c);
    setPaintMode('color');
    if (selectedCells.size > 0) {
      const newCells = { ...chart.cells };
      selectedCells.forEach(key => {
        if (c === '#ffffff') {
          delete newCells[key];
        } else {
          newCells[key] = c;
        }
      });
      updateChart({ cells: newCells });
    }
  };

  const handleSymbolChange = (x: number, y: number, symbolId: string) => {
    const newSymbols = { ...(chart.symbols || {}) };
    if (symbolId === 'none') {
      delete newSymbols[`${x},${y}`];
    } else {
      newSymbols[`${x},${y}`] = symbolId;
    }
    updateChart({ symbols: newSymbols });
  };

  const handleSymbolSelect = (s: string) => {
    setActiveSymbol(s);
    setPaintMode('symbol');
    if (selectedCells.size > 0) {
      const newSymbols = { ...(chart.symbols || {}) };
      selectedCells.forEach(key => {
        if (s === 'none') {
          delete newSymbols[key];
        } else {
          newSymbols[key] = s;
        }
      });
      updateChart({ symbols: newSymbols });
    }
  };

  const handlePointerDown = (x: number, y: number, e: React.PointerEvent) => {
    e.preventDefault();
    if (e.button !== 0) return; // Only handle primary click/touch

    setCursorPos({ x, y });
    
    const isSelectAction = tool === 'select' || e.shiftKey || e.ctrlKey || e.metaKey;
    
    if (isSelectAction) {
      setIsSelecting(true);
      if (!e.shiftKey) {
        setSelectionStart({ x, y });
      }
      
      setSelectedCells(prev => {
        const next = new Set(e.ctrlKey || e.metaKey || e.shiftKey ? prev : []);
        
        if (e.shiftKey && selectionStart) {
          const minX = Math.min(x, selectionStart.x);
          const maxX = Math.max(x, selectionStart.x);
          const minY = Math.min(y, selectionStart.y);
          const maxY = Math.max(y, selectionStart.y);
          for (let cy = minY; cy <= maxY; cy++) {
            for (let cx = minX; cx <= maxX; cx++) {
              next.add(`${cx},${cy}`);
            }
          }
        } else {
          const key = `${x},${y}`;
          if ((e.ctrlKey || e.metaKey) && prev.has(key)) {
            next.delete(key);
          } else {
            next.add(key);
          }
        }
        return next;
      });
      return;
    }

    if (selectedCells.size > 0) {
      setSelectedCells(new Set());
    }

    if (tool === 'replace') {
      if (paintMode === 'color') {
        const targetColor = chart.cells[`${x},${y}`] || '#ffffff';
        if (targetColor === activeColor) return;
        
        const newCells = { ...chart.cells };
        for (let cy = 0; cy < chart.height; cy++) {
          for (let cx = 0; cx < chart.width; cx++) {
            const cellColor = chart.cells[`${cx},${cy}`] || '#ffffff';
            if (cellColor === targetColor) {
              if (activeColor === '#ffffff') {
                delete newCells[`${cx},${cy}`];
              } else {
                newCells[`${cx},${cy}`] = activeColor;
              }
            }
          }
        }
        updateChart({ cells: newCells });
      } else {
        const targetSymbol = (chart.symbols || {})[`${x},${y}`] || 'none';
        if (targetSymbol === activeSymbol) return;
        
        const newSymbols = { ...(chart.symbols || {}) };
        for (let cy = 0; cy < chart.height; cy++) {
          for (let cx = 0; cx < chart.width; cx++) {
            const cellSymbol = (chart.symbols || {})[`${cx},${cy}`] || 'none';
            if (cellSymbol === targetSymbol) {
              if (activeSymbol === 'none') {
                delete newSymbols[`${cx},${cy}`];
              } else {
                newSymbols[`${cx},${cy}`] = activeSymbol;
              }
            }
          }
        }
        updateChart({ symbols: newSymbols });
      }
      return;
    }
    
    setIsDrawing(true);
    
    longPressTimer.current = setTimeout(() => {
      longPressTimer.current = null;
      setIsDrawing(false); // Cancel drawing
      setLongPressCell(`${x},${y}`);
    }, 500);
  };

  const handlePointerEnter = (x: number, y: number, e: React.PointerEvent) => {
    if (isSelecting) {
      setSelectedCells(prev => {
        const next = new Set(prev);
        next.add(`${x},${y}`);
        return next;
      });
      return;
    }
    if (isDrawing && tool === 'draw') {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
        if (cursorPos) handleCellInteract(cursorPos.x, cursorPos.y);
      }
      handleCellInteract(x, y);
    }
  };

  const handlePointerUpCell = (x: number, y: number, e: React.PointerEvent) => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
      if (isDrawing && tool === 'draw') {
        handleCellInteract(x, y);
      }
    }
  };

  useEffect(() => {
    const handlePointerUp = () => {
      setIsDrawing(false);
      setIsSelecting(false);
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
    };
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const state = stateRef.current;

      if (e.key === 'Escape') {
        setSelectedCells(new Set());
        setCursorPos(null);
        setLongPressCell(null);
        return;
      }

      if (!state.cursorPos) return;

      let newX = state.cursorPos.x;
      let newY = state.cursorPos.y;

      if (e.key === 'ArrowUp') newY = Math.min(state.chart.height - 1, state.cursorPos.y + 1);
      else if (e.key === 'ArrowDown') newY = Math.max(0, state.cursorPos.y - 1);
      else if (e.key === 'ArrowLeft') newX = Math.min(state.chart.width - 1, state.cursorPos.x + 1);
      else if (e.key === 'ArrowRight') newX = Math.max(0, state.cursorPos.x - 1);
      else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (state.selectedCells.size > 0) {
          if (state.paintMode === 'color') {
            const newCells = { ...state.chart.cells };
            state.selectedCells.forEach(key => {
              if (state.activeColor === '#ffffff') delete newCells[key];
              else newCells[key] = state.activeColor;
            });
            updateChartRef.current({ cells: newCells });
          } else {
            const newSymbols = { ...(state.chart.symbols || {}) };
            state.selectedCells.forEach(key => {
              if (state.activeSymbol === 'none') delete newSymbols[key];
              else newSymbols[key] = state.activeSymbol;
            });
            updateChartRef.current({ symbols: newSymbols });
          }
        } else {
          if (state.paintMode === 'color') {
            const newCells = { ...state.chart.cells };
            if (state.activeColor === '#ffffff') delete newCells[`${state.cursorPos.x},${state.cursorPos.y}`];
            else newCells[`${state.cursorPos.x},${state.cursorPos.y}`] = state.activeColor;
            updateChartRef.current({ cells: newCells });
          } else {
            const newSymbols = { ...(state.chart.symbols || {}) };
            if (state.activeSymbol === 'none') delete newSymbols[`${state.cursorPos.x},${state.cursorPos.y}`];
            else newSymbols[`${state.cursorPos.x},${state.cursorPos.y}`] = state.activeSymbol;
            updateChartRef.current({ symbols: newSymbols });
          }
        }
        return;
      }
      else return;

      e.preventDefault();
      setCursorPos({ x: newX, y: newY });

      if (e.shiftKey) {
        const start = state.selectionStart || state.cursorPos;
        if (!state.selectionStart) setSelectionStart(start);

        const next = new Set(e.ctrlKey || e.metaKey ? state.selectedCells : []);
        const minX = Math.min(newX, start.x);
        const maxX = Math.max(newX, start.x);
        const minY = Math.min(newY, start.y);
        const maxY = Math.max(newY, start.y);
        for (let cy = minY; cy <= maxY; cy++) {
          for (let cx = minX; cx <= maxX; cx++) {
            next.add(`${cx},${cy}`);
          }
        }
        setSelectedCells(next);
      } else {
        setSelectionStart({ x: newX, y: newY });
        setSelectedCells(new Set([`${newX},${newY}`]));
      }
    };

    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const clearChart = () => {
    if (confirm('Are you sure you want to clear the entire chart?')) {
      updateChart({ cells: {} });
    }
  };

  // Generate grid
  const rows = [];
  for (let y = chart.height - 1; y >= 0; y--) {
    const cols = [];
    for (let x = chart.width - 1; x >= 0; x--) {
      const color = chart.cells[`${x},${y}`] || '#ffffff';
      const symbolId = (chart.symbols || {})[`${x},${y}`];
      const symbolObj = symbolId && symbolId !== 'none' ? KNITTING_SYMBOLS.find(s => s.id === symbolId) : null;
      const isSelected = selectedCells.has(`${x},${y}`);
      const isCursor = cursorPos?.x === x && cursorPos?.y === y;
      const isLongPressed = longPressCell === `${x},${y}`;
      
      cols.push(
        <div
          key={`${x},${y}`}
          className={cn(
            "w-6 h-6 border-r border-b border-stone-300 select-none touch-none relative flex items-center justify-center font-bold",
            symbolObj && symbolObj.symbol.length > 2 ? "text-[9px]" : "text-xs"
          )}
          style={{ backgroundColor: color, color: color === '#000000' ? '#ffffff' : '#000000' }}
          onPointerDown={(e) => handlePointerDown(x, y, e)}
          onPointerEnter={(e) => handlePointerEnter(x, y, e)}
          onPointerUp={(e) => handlePointerUpCell(x, y, e)}
        >
          {symbolObj && symbolObj.symbol}
          {isSelected && <div className="absolute inset-0 bg-blue-500/30 border border-blue-500 pointer-events-none z-10" />}
          {isCursor && <div className="absolute inset-0 border-2 border-blue-600 pointer-events-none z-20 shadow-[0_0_4px_rgba(37,99,235,0.5)]" />}
          {isLongPressed && (
            <div 
              className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-[270px] bg-white border border-stone-200 rounded-xl p-3 shadow-2xl z-50 flex flex-col gap-2 cursor-default"
              onPointerDown={e => e.stopPropagation()}
            >
              <div className="text-xs font-medium text-stone-500 mb-1 border-b border-stone-100 pb-1 text-left">Select Symbol</div>
              <div className="flex flex-wrap gap-1">
                {KNITTING_SYMBOLS.map(s => (
                  <button
                    key={s.id}
                    className={cn(
                      "p-1.5 hover:bg-stone-100 rounded flex flex-col items-center gap-1 w-[46px] transition-colors",
                      (symbolId || 'none') === s.id ? "bg-stone-100 ring-1 ring-stone-300" : ""
                    )}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleSymbolChange(x, y, s.id);
                      setLongPressCell(null);
                    }}
                    title={s.description}
                  >
                    <span className={cn("font-bold", s.symbol.length > 2 ? "text-[10px]" : "text-sm", s.id === 'none' ? "text-red-500" : "text-stone-800")}>
                      {s.id === 'none' ? '✕' : s.symbol}
                    </span>
                    <span className="text-[9px] text-stone-500 text-center leading-tight w-full overflow-hidden text-ellipsis">{s.label}</span>
                  </button>
                ))}
              </div>
              <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-b border-r border-stone-200 rotate-45" />
            </div>
          )}
        </div>
      );
    }
    rows.push(
      <div key={y} className="flex">
        <div className={cn(
          "w-8 flex items-center justify-center text-xs font-medium border-r border-b border-stone-300 select-none",
          currentRow === y + 1 ? "bg-amber-200 text-amber-900" : "bg-stone-100 text-stone-500"
        )}>
          {y + 1}
        </div>
        {cols}
      </div>
    );
  }

  // Column numbers
  const colNumbers = [];
  for (let x = chart.width - 1; x >= 0; x--) {
    colNumbers.push(
      <div key={x} className="w-6 h-6 flex items-center justify-center text-[10px] text-stone-500 border-r border-stone-300 bg-stone-100 select-none">
        {x + 1}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-stone-50 w-full overflow-hidden relative">
      {longPressCell && (
        <div 
          className="fixed inset-0 z-40" 
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setLongPressCell(null);
          }} 
        />
      )}
      <div className="bg-white border-b border-stone-200 p-4 flex flex-wrap items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 border-r border-stone-200 pr-4">
            <button
              onClick={() => setTool('draw')}
              className={cn("p-1.5 rounded-lg transition-colors", tool === 'draw' ? "bg-stone-200 text-stone-800" : "text-stone-500 hover:bg-stone-100")}
              title="Draw"
            >
              <Pencil size={18} />
            </button>
            <button
              onClick={() => setTool('replace')}
              className={cn("p-1.5 rounded-lg transition-colors", tool === 'replace' ? "bg-stone-200 text-stone-800" : "text-stone-500 hover:bg-stone-100")}
              title="Replace Color"
            >
              <PaintBucket size={18} />
            </button>
            <button
              onClick={() => setTool('select')}
              className={cn("p-1.5 rounded-lg transition-colors", tool === 'select' ? "bg-stone-200 text-stone-800" : "text-stone-500 hover:bg-stone-100")}
              title="Select (Shift/Ctrl to multi-select)"
            >
              <MousePointer2 size={18} />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-stone-600">Width:</label>
            <input 
              type="number" 
              value={chart.width} 
              onChange={e => updateChart({ width: Math.max(1, Math.min(100, Number(e.target.value))) })}
              className="w-16 p-1 border border-stone-300 rounded text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-stone-600">Height:</label>
            <input 
              type="number" 
              value={chart.height} 
              onChange={e => updateChart({ height: Math.max(1, Math.min(200, Number(e.target.value))) })}
              className="w-16 p-1 border border-stone-300 rounded text-sm"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            {DEFAULT_COLORS.map(c => (
              <button
                key={c}
                onClick={() => handleColorSelect(c)}
                className={cn(
                  "w-8 h-8 rounded-full border-2 transition-transform",
                  paintMode === 'color' && activeColor === c ? "border-stone-800 scale-110" : "border-stone-200 hover:scale-105"
                )}
                style={{ backgroundColor: c }}
                title={c === '#ffffff' ? 'Eraser' : 'Color'}
              />
            ))}
            <div className="relative flex items-center justify-center w-8 h-8 rounded-full border-2 border-stone-200 overflow-hidden hover:scale-105 transition-transform" title="Custom Color">
              <input 
                type="color" 
                value={customColor}
                onChange={(e) => {
                  setCustomColor(e.target.value);
                  handleColorSelect(e.target.value);
                }}
                className="absolute inset-[-10px] w-[50px] h-[50px] cursor-pointer"
              />
            </div>
            {activeColor !== '#ffffff' && !DEFAULT_COLORS.includes(activeColor) && (
              <button
                onClick={() => handleColorSelect(customColor)}
                className={cn(
                  "w-8 h-8 rounded-full border-2 transition-transform",
                  paintMode === 'color' ? "border-stone-800 scale-110" : "border-stone-200 hover:scale-105"
                )}
                style={{ backgroundColor: activeColor }}
                title="Active Custom Color"
              />
            )}
          </div>
          
          <div className="flex items-center gap-2 flex-wrap">
            {KNITTING_SYMBOLS.map(s => (
              <button
                key={s.id}
                onClick={() => handleSymbolSelect(s.id)}
                className={cn(
                  "w-8 h-8 rounded border-2 transition-transform flex items-center justify-center font-bold",
                  s.symbol.length > 2 ? "text-[10px]" : "text-sm",
                  paintMode === 'symbol' && activeSymbol === s.id ? "border-stone-800 bg-stone-200 scale-110" : "border-stone-200 bg-white hover:scale-105",
                  s.id === 'none' ? "text-red-500" : "text-stone-800"
                )}
                title={s.label}
              >
                {s.id === 'none' ? '✕' : s.symbol}
              </button>
            ))}
          </div>
        </div>

        <button 
          onClick={clearChart}
          className="text-red-600 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
        >
          <Trash2 size={16} /> Clear
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4 sm:p-8 flex justify-center items-start">
        <div 
          className="bg-white shadow-lg border-t border-l border-stone-300"
          ref={containerRef}
        >
          {rows}
          <div className="flex">
            <div className="w-8 h-6 border-r border-stone-300 bg-stone-100" />
            {colNumbers}
          </div>
        </div>
      </div>
    </div>
  );
}

export function TrackChart({ chart, currentRow, isPiP, setIsPiP, onUpdateChart }: { chart: ChartData, currentRow: number, isPiP: boolean, setIsPiP: (v: boolean) => void, onUpdateChart?: (updates: Partial<ChartData>) => void }) {
  const [zoom, setZoom] = useState(chart.zoom || 1);
  const [pipSize, setPipSize] = useState(chart.pipSize || { w: 320, h: 256 });
  const [pipPos, setPipPos] = useState(chart.pipPos || { 
    x: typeof window !== 'undefined' ? window.innerWidth - 340 : 0, 
    y: typeof window !== 'undefined' ? window.innerHeight - 280 : 0 
  });

  useEffect(() => {
    if (chart.zoom !== undefined) setZoom(chart.zoom);
    if (chart.pipSize !== undefined) setPipSize(chart.pipSize);
    if (chart.pipPos !== undefined) setPipPos(chart.pipPos);
  }, [chart.zoom, chart.pipSize, chart.pipPos]);

  const handleZoom = (newZoom: number) => {
    setZoom(newZoom);
    onUpdateChart?.({ zoom: newZoom });
  };
  
  if (!chart || Object.keys(chart.cells).length === 0) return null;

  const baseCellSize = 16;
  const cellSize = baseCellSize * zoom;

  const rows = [];
  for (let y = chart.height - 1; y >= 0; y--) {
    const cols = [];
    for (let x = chart.width - 1; x >= 0; x--) {
      const color = chart.cells[`${x},${y}`] || '#ffffff';
      const symbolId = (chart.symbols || {})[`${x},${y}`];
      const symbolObj = symbolId && symbolId !== 'none' ? KNITTING_SYMBOLS.find(s => s.id === symbolId) : null;
      cols.push(
        <div
          key={`${x},${y}`}
          className="border-r border-b border-stone-200 shrink-0 flex items-center justify-center font-bold"
          style={{ 
            backgroundColor: color, 
            width: cellSize, 
            height: cellSize,
            color: color === '#000000' ? '#ffffff' : '#000000',
            fontSize: symbolObj && symbolObj.symbol.length > 2 ? Math.max(6, cellSize * 0.4) : Math.max(8, cellSize * 0.6)
          }}
        >
          {symbolObj && symbolObj.symbol}
        </div>
      );
    }
    rows.push(
      <div key={y} className="flex">
        <div 
          className={cn(
            "flex items-center justify-center font-medium border-r border-b border-stone-200 shrink-0",
            currentRow === y + 1 ? "bg-amber-200 text-amber-900" : "bg-stone-50 text-stone-400"
          )}
          style={{ width: cellSize * 1.5, height: cellSize, fontSize: Math.max(8, cellSize * 0.5) }}
        >
          {y + 1}
        </div>
        {cols}
      </div>
    );
  }

  const content = (
    <div className="flex flex-col h-full bg-white w-full relative">
      <div 
        className={cn("flex items-center justify-between p-2 border-b border-stone-200 bg-stone-50 shrink-0", isPiP ? "cursor-move" : "")}
        onPointerDown={isPiP ? (e) => {
          if ((e.target as HTMLElement).closest('button')) return;
          e.preventDefault();
          const startX = e.clientX;
          const startY = e.clientY;
          const startPos = pipPos;
          
          const onMove = (me: any) => {
            setPipPos({
              x: startPos.x + (me.clientX - startX),
              y: startPos.y + (me.clientY - startY)
            });
          };
          
          const onUp = (me: any) => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            onUpdateChart?.({
              pipPos: {
                x: startPos.x + (me.clientX - startX),
                y: startPos.y + (me.clientY - startY)
              }
            });
          };
          
          window.addEventListener('pointermove', onMove);
          window.addEventListener('pointerup', onUp);
        } : undefined}
      >
        <div className="flex items-center gap-2">
          <button onClick={() => handleZoom(Math.max(0.5, zoom - 0.2))} className="p-1 hover:bg-stone-200 rounded text-stone-600"><ZoomOut size={16}/></button>
          <span className="text-xs font-medium text-stone-500 w-10 text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={() => handleZoom(Math.min(3, zoom + 0.2))} className="p-1 hover:bg-stone-200 rounded text-stone-600"><ZoomIn size={16}/></button>
        </div>
        <button onClick={() => setIsPiP(!isPiP)} className="p-1 hover:bg-stone-200 rounded text-stone-600" title={isPiP ? "Dock to Track view" : "Picture in Picture"}>
          {isPiP ? <Minimize2 size={16}/> : <Maximize2 size={16}/>}
        </button>
      </div>
      <div className="flex-1 overflow-auto p-4 bg-stone-100/50 flex justify-center items-start">
        <div className="inline-block border-t border-l border-stone-200 shadow-sm bg-white">
          {rows}
        </div>
      </div>
      {isPiP && (
        <div 
          className="absolute bottom-0 right-0 w-6 h-6 cursor-nwse-resize z-50 flex items-end justify-end p-1.5 group"
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const startX = e.clientX;
            const startY = e.clientY;
            const startW = pipSize.w;
            const startH = pipSize.h;
            
            const onMove = (me: any) => {
              setPipSize({
                w: Math.max(200, startW + (me.clientX - startX)),
                h: Math.max(150, startH + (me.clientY - startY))
              });
            };
            
            const onUp = (me: any) => {
              window.removeEventListener('pointermove', onMove);
              window.removeEventListener('pointerup', onUp);
              onUpdateChart?.({
                pipSize: {
                  w: Math.max(200, startW + (me.clientX - startX)),
                  h: Math.max(150, startH + (me.clientY - startY))
                }
              });
            };
            
            window.addEventListener('pointermove', onMove);
            window.addEventListener('pointerup', onUp);
          }}
        >
          <div className="w-2.5 h-2.5 border-b-2 border-r-2 border-stone-400 rounded-br-[2px] group-hover:border-stone-600 transition-colors" />
        </div>
      )}
    </div>
  );

  if (isPiP) {
    return (
      <div 
        className="fixed bg-white rounded-xl shadow-2xl border border-stone-300 z-50 overflow-hidden flex flex-col" 
        style={{ left: pipPos.x, top: pipPos.y, width: pipSize.w, height: pipSize.h, minWidth: '200px', minHeight: '150px' }}
      >
        {content}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-stone-200 overflow-hidden resize-y flex flex-col" style={{ minHeight: '200px', height: '300px' }}>
      {content}
    </div>
  );
}
