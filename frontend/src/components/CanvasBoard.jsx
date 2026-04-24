import React, { useEffect, useRef, useState, useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import socket from '../socket';
import StickyNote, { STICKY_COLORS } from './StickyNote';
import { Plus } from 'lucide-react';

const createTextObject = (x, y, text = '', width = 200, height = 40) => ({
  id: `text-${Date.now()}-${Math.random()}`,
  x, y, text, width, height,
  fontSize: 16, color: '#000000', isEditing: false, isSelected: false,
});

const CanvasBoard = ({ activeTool, strokeColor, strokeWidth, zoom, historyRef, activeFrame }) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const contextRef = useRef(null);
  const canvasDataRef = useRef(null);
  const shapeStartPos = useRef(null);
  const lastPos = useRef({ x: 0, y: 0 });
  const undoStack = useRef([]);
  const redoStack = useRef([]);

  const [isDrawing, setIsDrawing] = useState(false);
  const [textObjects, setTextObjects] = useState([]);
  const [selectedTextId, setSelectedTextId] = useState(null);

  // ── Sticky Notes ─────────────────────────────────────────────────────────
  const [stickyNotes, setStickyNotes] = useState([]);
  const [selectedStickyId, setSelectedStickyId] = useState(null);

  // ── Per-frame state store ────────────────────────────────────────────────
  // Stores { canvasDataURL, textObjects, stickyNotes, undoStack, redoStack } per frame ID.
  const frameDataRef = useRef({});
  const prevFrameRef = useRef(activeFrame);

  const activeToolRef = useRef(activeTool);
  const strokeColorRef = useRef(strokeColor);
  const strokeWidthRef = useRef(strokeWidth);
  const zoomRef = useRef(zoom);
  const activeFrameRef = useRef(activeFrame);

  useEffect(() => { activeToolRef.current = activeTool; }, [activeTool]);
  useEffect(() => { strokeColorRef.current = strokeColor; }, [strokeColor]);
  useEffect(() => { strokeWidthRef.current = strokeWidth; }, [strokeWidth]);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { activeFrameRef.current = activeFrame; }, [activeFrame]);

  // ─── History ───────────────────────────────────────────────────────────────

  const pushToHistory = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || canvas.width === 0) return;
    undoStack.current.push(canvas.toDataURL());
    if (undoStack.current.length > 50) undoStack.current.shift();
    redoStack.current = [];
  }, []);

  const restoreFromDataURL = useCallback((dataURL) => {
    const canvas = canvasRef.current;
    const ctx = contextRef.current;
    if (!canvas || !ctx) return;
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width / 2, canvas.height / 2);
      ctx.drawImage(img, 0, 0, canvas.width / 2, canvas.height / 2);
      canvasDataRef.current = dataURL;
    };
    img.src = dataURL;
  }, []);

  const handleUndo = useCallback(() => {
    if (undoStack.current.length === 0) return;
    redoStack.current.push(canvasRef.current.toDataURL());
    restoreFromDataURL(undoStack.current.pop());
  }, [restoreFromDataURL]);

  const handleRedo = useCallback(() => {
    if (redoStack.current.length === 0) return;
    undoStack.current.push(canvasRef.current.toDataURL());
    restoreFromDataURL(redoStack.current.pop());
  }, [restoreFromDataURL]);

  // Expose to parent via ref
  useEffect(() => {
    if (historyRef) {
      historyRef.current = { undo: handleUndo, redo: handleRedo };
    }
  }, [historyRef, handleUndo, handleRedo]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.key === 'z') { e.preventDefault(); handleUndo(); }
      if (e.ctrlKey && e.key === 'y') { e.preventDefault(); handleRedo(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  // ─── Drawing primitives ────────────────────────────────────────────────────

  const applyGridBackground = useCallback((context, width, height) => {
    const gridSize = 20;
    context.strokeStyle = '#f0f0f0';
    context.lineWidth = 0.5;
    for (let x = 0; x <= width; x += gridSize) {
      context.beginPath(); context.moveTo(x, 0); context.lineTo(x, height); context.stroke();
    }
    for (let y = 0; y <= height; y += gridSize) {
      context.beginPath(); context.moveTo(0, y); context.lineTo(width, y); context.stroke();
    }
  }, []);

  const saveCanvasData = useCallback(() => {
    const canvas = canvasRef.current;
    if (canvas && canvas.width > 0) canvasDataRef.current = canvas.toDataURL();
  }, []);

  const drawOnCanvas = useCallback((x1, y1, x2, y2, color = 'black', width = 2) => {
    if (!contextRef.current) return;
    const ctx = contextRef.current;
    ctx.strokeStyle = color; ctx.lineWidth = width;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.closePath();
    saveCanvasData();
  }, [saveCanvasData]);

  const drawText = useCallback((textObj) => {
    if (!contextRef.current || !textObj.text) return;
    const ctx = contextRef.current;
    ctx.fillStyle = textObj.color;
    ctx.font = `${textObj.fontSize}px Arial`;
    const words = textObj.text.split(' ');
    let line = '', y = textObj.y + textObj.fontSize;
    for (let word of words) {
      const testLine = line + word + ' ';
      if (ctx.measureText(testLine).width > textObj.width && line !== '') {
        ctx.fillText(line, textObj.x, y); line = word + ' '; y += textObj.fontSize * 1.2;
      } else { line = testLine; }
    }
    ctx.fillText(line, textObj.x, y);
    saveCanvasData();
  }, [saveCanvasData]);

  const applyShapePath = useCallback((ctx, startX, startY, endX, endY, shapeType) => {
    ctx.beginPath();
    switch (shapeType) {
      case 'rectangle': ctx.rect(startX, startY, endX - startX, endY - startY); break;
      case 'circle': {
        const r = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
        ctx.arc(startX, startY, r, 0, 2 * Math.PI); break;
      }
      case 'triangle':
        ctx.moveTo(startX, startY); ctx.lineTo(endX, endY);
        ctx.lineTo(startX - (endX - startX), endY); ctx.closePath(); break;
      case 'line': ctx.moveTo(startX, startY); ctx.lineTo(endX, endY); break;
      case 'arrow': {
        ctx.moveTo(startX, startY); ctx.lineTo(endX, endY);
        const angle = Math.atan2(endY - startY, endX - startX), hl = 15;
        ctx.moveTo(endX, endY);
        ctx.lineTo(endX - hl * Math.cos(angle - Math.PI/6), endY - hl * Math.sin(angle - Math.PI/6));
        ctx.moveTo(endX, endY);
        ctx.lineTo(endX - hl * Math.cos(angle + Math.PI/6), endY - hl * Math.sin(angle + Math.PI/6));
        break;
      }
      default: return false;
    }
    return true;
  }, []);

  const drawShape = useCallback((startX, startY, endX, endY, shapeType, color = 'black', width = 2) => {
    if (!contextRef.current) return;
    const ctx = contextRef.current;
    ctx.strokeStyle = color; ctx.lineWidth = width;
    if (applyShapePath(ctx, startX, startY, endX, endY, shapeType)) ctx.stroke();
    saveCanvasData();
  }, [applyShapePath, saveCanvasData]);

  // ─── Init ──────────────────────────────────────────────────────────────────

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const rect = container.getBoundingClientRect();
    const ctx = contextRef.current;
    if (ctx) {
      ctx.clearRect(0, 0, rect.width, rect.height);
      applyGridBackground(ctx, rect.width, rect.height);
    }
    canvasDataRef.current = null;
  }, [applyGridBackground]);

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width * 2; canvas.height = rect.height * 2;
    canvas.style.width = `${rect.width}px`; canvas.style.height = `${rect.height}px`;
    const ctx = canvas.getContext('2d');
    ctx.scale(2, 2); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = strokeColorRef.current; ctx.lineWidth = strokeWidthRef.current;
    contextRef.current = ctx;
    applyGridBackground(ctx, rect.width, rect.height);
    undoStack.current = []; redoStack.current = [];
  }, [applyGridBackground]);

  useEffect(() => { initCanvas(); }, [initCanvas]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const rect = container.getBoundingClientRect();
    const scale = zoom / 100;
    canvas.style.width = `${rect.width * scale}px`;
    canvas.style.height = `${rect.height * scale}px`;
    if (contextRef.current) {
      contextRef.current.strokeStyle = strokeColor;
      contextRef.current.lineWidth = strokeWidth;
    }
  }, [zoom, strokeColor, strokeWidth]);

  // ─── Frame switch: save / restore per-frame state ─────────────────────────

  useEffect(() => {
    const oldFrame = prevFrameRef.current;
    const newFrame = activeFrame;

    if (oldFrame === newFrame) return;

    // --- Save current frame ---
    const canvas = canvasRef.current;
    frameDataRef.current[oldFrame] = {
      canvasDataURL: canvas && canvas.width > 0 ? canvas.toDataURL() : null,
      textObjects: [...(textObjects || [])],
      stickyNotes: [...(stickyNotes || [])],
      undoStack: [...undoStack.current],
      redoStack: [...redoStack.current],
    };

    // --- Restore new frame ---
    const saved = frameDataRef.current[newFrame];

    // Clear canvas to fresh grid
    clearCanvas();

    if (saved) {
      // Restore canvas drawing
      if (saved.canvasDataURL) {
        restoreFromDataURL(saved.canvasDataURL);
      }
      setTextObjects(saved.textObjects || []);
      setStickyNotes(saved.stickyNotes || []);
      undoStack.current = saved.undoStack || [];
      redoStack.current = saved.redoStack || [];
    } else {
      setTextObjects([]);
      setStickyNotes([]);
      undoStack.current = [];
      redoStack.current = [];
    }

    setSelectedTextId(null);
    setSelectedStickyId(null);

    // --- Socket room: join new frame ---
    socket.emit('join-frame', { frameId: newFrame });

    prevFrameRef.current = newFrame;
  }, [activeFrame]);

  // Join initial frame room on mount
  useEffect(() => {
    socket.emit('join-frame', { frameId: activeFrame });
  }, []);

  // ─── Socket ────────────────────────────────────────────────────────────────

  useEffect(() => {
    const handleDraw = (data) => {
      // Only apply events that match the current active frame
      if (data.frameId !== undefined && data.frameId !== activeFrameRef.current) return;

      if (data.type === 'stroke') {
        const s = data.data;
        drawOnCanvas(s.x1, s.y1, s.x2, s.y2, s.color, s.width);
      } else if (data.type === 'shape') {
        drawShape(data.startX, data.startY, data.endX, data.endY, data.shapeType, data.color, data.width);
      } else if (data.type === 'text') {
        drawText(data.textObj);
      } else if (data.type === 'sticky-add') {
        setStickyNotes(prev => {
          if (prev.find(n => n.id === data.note.id)) return prev;
          return [...prev, data.note];
        });
      } else if (data.type === 'sticky-update') {
        setStickyNotes(prev => prev.map(n => n.id === data.id ? { ...n, ...data.updates } : n));
      } else if (data.type === 'sticky-delete') {
        setStickyNotes(prev => prev.filter(n => n.id !== data.id));
      }
    };
    socket.on('draw', handleDraw);
    return () => socket.off('draw', handleDraw);
  }, [drawOnCanvas, drawShape, drawText]);

  // ─── Mouse helpers ─────────────────────────────────────────────────────────

  const getMousePos = useCallback((e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width) / 2,
      y: (e.clientY - rect.top) * (canvas.height / rect.height) / 2,
    };
  }, []);

  const getScreenPos = useCallback((canvasX, canvasY) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return {
      x: canvasX * (rect.width / canvas.width) * 2,
      y: canvasY * (rect.height / canvas.height) * 2,
    };
  }, []);

  // ─── Text ──────────────────────────────────────────────────────────────────

  const addTextObject = useCallback((x, y) => {
    const obj = createTextObject(x, y);
    setTextObjects(prev => [...prev, obj]);
    setSelectedTextId(obj.id);
    socket.emit('draw', { type: 'text', textObj: obj, frameId: activeFrameRef.current });
  }, []);

  const updateTextObject = useCallback((id, updates) => {
    setTextObjects(prev => prev.map(o => o.id === id ? { ...o, ...updates } : o));
  }, []);

  // ─── Sticky Notes helpers ─────────────────────────────────────────────────

  const createStickyNote = useCallback((x, y) => {
    const colorNames = STICKY_COLORS.map(c => c.name);
    const note = {
      id: `sticky-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      x, y,
      width: 220, height: 200,
      text: '',
      color: colorNames[Math.floor(Math.random() * colorNames.length)],
    };
    setStickyNotes(prev => [...prev, note]);
    setSelectedStickyId(note.id);
    socket.emit('draw', { type: 'sticky-add', note, frameId: activeFrameRef.current });
  }, []);

  const updateStickyNote = useCallback((id, updates) => {
    setStickyNotes(prev => prev.map(n => n.id === id ? { ...n, ...updates } : n));
    socket.emit('draw', { type: 'sticky-update', id, updates, frameId: activeFrameRef.current });
  }, []);

  const deleteStickyNote = useCallback((id) => {
    setStickyNotes(prev => prev.filter(n => n.id !== id));
    if (selectedStickyId === id) setSelectedStickyId(null);
    socket.emit('draw', { type: 'sticky-delete', id, frameId: activeFrameRef.current });
  }, [selectedStickyId]);

  const addStickyFromButton = useCallback(() => {
    createStickyNote(120 + Math.random() * 300, 80 + Math.random() * 200);
  }, [createStickyNote]);

  // ─── Mouse events ──────────────────────────────────────────────────────────

  const handleMouseDown = useCallback((e) => {
    const tool = activeToolRef.current;
    const pos = getMousePos(e);
    if (tool === 'text') { addTextObject(pos.x, pos.y); return; }
    if (tool === 'sticky') {
      // Convert canvas coords to screen-relative coords for sticky notes
      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      createStickyNote(sx - 110, sy - 20);
      return;
    }
    const isShape = ['rectangle','circle','triangle','line','arrow'].includes(tool);
    const isDraw = ['pen','eraser'].includes(tool);
    if (!isShape && !isDraw) return;
    pushToHistory();
    setIsDrawing(true);
    if (isShape) { shapeStartPos.current = pos; saveCanvasData(); }
    else { lastPos.current = pos; }
  }, [getMousePos, addTextObject, createStickyNote, saveCanvasData, pushToHistory]);

  const handleMouseMove = useCallback((e) => {
    if (!isDrawing) return;
    const tool = activeToolRef.current;
    if (['rectangle','circle','triangle','line','arrow'].includes(tool)) return;
    if (!['pen','eraser'].includes(tool)) return;
    const pos = getMousePos(e);
    const color = tool === 'eraser' ? '#FFFFFF' : strokeColorRef.current;
    const width = tool === 'eraser' ? strokeWidthRef.current * 3 : strokeWidthRef.current;
    drawOnCanvas(lastPos.current.x, lastPos.current.y, pos.x, pos.y, color, width);
    socket.emit('draw', { type: 'stroke', data: { x1: lastPos.current.x, y1: lastPos.current.y, x2: pos.x, y2: pos.y, color, width }, frameId: activeFrameRef.current });
    lastPos.current = pos;
  }, [isDrawing, getMousePos, drawOnCanvas]);

  const handleMouseUp = useCallback((e) => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const tool = activeToolRef.current;
    if (['rectangle','circle','triangle','line','arrow'].includes(tool) && shapeStartPos.current) {
      const end = getMousePos(e);
      const start = shapeStartPos.current;
      drawShape(start.x, start.y, end.x, end.y, tool, strokeColorRef.current, strokeWidthRef.current);
      socket.emit('draw', { type: 'shape', shapeType: tool, startX: start.x, startY: start.y, endX: end.x, endY: end.y, color: strokeColorRef.current, width: strokeWidthRef.current, frameId: activeFrameRef.current });
    }
    shapeStartPos.current = null;
    saveCanvasData();
  }, [isDrawing, getMousePos, drawShape, saveCanvasData]);

  const getCursorStyle = () => {
    switch (activeTool) {
      case 'pen': return 'crosshair';
      case 'eraser': return 'grab';
      case 'select': return 'move';
      case 'text': return 'text';
      case 'sticky': return 'copy';
      default: return 'default';
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="canvas-container" ref={containerRef}>
      <canvas
        className="drawing-canvas"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        ref={canvasRef}
        style={{ cursor: getCursorStyle() }}
      />

      {/* Text objects */}
      {textObjects.map(textObj => {
        const sp = getScreenPos(textObj.x, textObj.y);
        const isSel = selectedTextId === textObj.id;
        return (
          <div key={textObj.id}
            style={{ position:'absolute', left:sp.x, top:sp.y, width:textObj.width, height:textObj.height,
              border: isSel ? '2px solid #1a73e8' : '1px solid transparent',
              borderRadius:'4px', padding:'4px',
              cursor: textObj.isEditing ? 'text' : 'move',
              backgroundColor: textObj.isEditing ? 'white' : 'transparent',
              zIndex: isSel ? 1000 : 1 }}
            onClick={(e) => { e.stopPropagation(); setSelectedTextId(textObj.id); }}
            onDoubleClick={(e) => { e.stopPropagation(); updateTextObject(textObj.id, { isEditing: true }); }}
          >
            {textObj.isEditing ? (
              <textarea value={textObj.text}
                onChange={(e) => updateTextObject(textObj.id, { text: e.target.value })}
                onBlur={() => updateTextObject(textObj.id, { isEditing: false })}
                autoFocus
                style={{ width:'100%', height:'100%', border:'none', outline:'none', resize:'none',
                  fontSize:`${textObj.fontSize}px`, fontFamily:'Arial', color:textObj.color, backgroundColor:'transparent' }}
              />
            ) : (
              <div style={{ fontSize:`${textObj.fontSize}px`, fontFamily:'Arial', color:textObj.color, whiteSpace:'pre-wrap', wordWrap:'break-word' }}>
                {textObj.text || 'Click to edit'}
              </div>
            )}
            {isSel && !textObj.isEditing && (
              <>
                <div style={{ position:'absolute', top:-4, left:-4, width:8, height:8, backgroundColor:'#1a73e8', cursor:'nw-resize' }} />
                <div style={{ position:'absolute', top:-4, right:-4, width:8, height:8, backgroundColor:'#1a73e8', cursor:'ne-resize' }} />
                <div style={{ position:'absolute', bottom:-4, left:-4, width:8, height:8, backgroundColor:'#1a73e8', cursor:'sw-resize' }} />
                <div style={{ position:'absolute', bottom:-4, right:-4, width:8, height:8, backgroundColor:'#1a73e8', cursor:'se-resize' }} />
              </>
            )}
          </div>
        );
      })}

      {/* Sticky Notes */}
      <AnimatePresence>
        {stickyNotes.map(note => (
          <StickyNote
            key={note.id}
            note={note}
            isSelected={selectedStickyId === note.id}
            onSelect={setSelectedStickyId}
            onUpdate={updateStickyNote}
            onDelete={deleteStickyNote}
          />
        ))}
      </AnimatePresence>

      {/* Floating "+" button when sticky tool is active */}
      {activeTool === 'sticky' && (
        <button
          className="sticky-add-fab"
          onClick={addStickyFromButton}
          title="Add sticky note"
        >
          <Plus size={22} />
        </button>
      )}
    </div>
  );
};

export default CanvasBoard;