import React, { useEffect, useRef, useState, useCallback } from 'react';
import socket from '../socket';

// Text object structure
const createTextObject = (x, y, text = '', width = 200, height = 40) => ({
  id: `text-${Date.now()}-${Math.random()}`,
  x,
  y,
  text,
  width,
  height,
  fontSize: 16,
  color: '#000000',
  isEditing: false,
  isSelected: false,
});

const CanvasBoard = ({ activeTool, strokeColor, strokeWidth, zoom }) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const contextRef = useRef(null);
  const canvasDataRef = useRef(null);
  const shapeStartPos = useRef(null);
  const lastPos = useRef({ x: 0, y: 0 });

  // State management
  const [isDrawing, setIsDrawing] = useState(false);
  const [textObjects, setTextObjects] = useState([]);
  const [selectedTextId, setSelectedTextId] = useState(null);
  const [isDraggingText, setIsDraggingText] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isResizingText, setIsResizingText] = useState(false);
  const [resizeHandle, setResizeHandle] = useState('');

  // Refs for latest values
  const activeToolRef = useRef(activeTool);
  const strokeColorRef = useRef(strokeColor);
  const strokeWidthRef = useRef(strokeWidth);
  const zoomRef = useRef(zoom);

  useEffect(() => { activeToolRef.current = activeTool; }, [activeTool]);
  useEffect(() => { strokeColorRef.current = strokeColor; }, [strokeColor]);
  useEffect(() => { strokeWidthRef.current = strokeWidth; }, [strokeWidth]);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);

  // ─── Canvas drawing primitives ─────────────────────────────────────────────

  const applyGridBackground = useCallback((context, width, height) => {
    const gridSize = 20;
    context.strokeStyle = '#f0f0f0';
    context.lineWidth = 0.5;
    for (let x = 0; x <= width; x += gridSize) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, height);
      context.stroke();
    }
    for (let y = 0; y <= height; y += gridSize) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(width, y);
      context.stroke();
    }
  }, []);

  const saveCanvasData = useCallback(() => {
    const canvas = canvasRef.current;
    if (canvas && canvas.width > 0) {
      canvasDataRef.current = canvas.toDataURL();
    }
  }, []);

  const drawOnCanvas = useCallback((x1, y1, x2, y2, color = 'black', width = 2) => {
    if (!contextRef.current) return;
    const ctx = contextRef.current;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.closePath();
    saveCanvasData();
  }, [saveCanvasData]);

  const drawText = useCallback((textObj) => {
    if (!contextRef.current || !textObj.text) return;
    const ctx = contextRef.current;
    ctx.fillStyle = textObj.color;
    ctx.font = `${textObj.fontSize}px Arial`;
    
    // Wrap text if needed
    const words = textObj.text.split(' ');
    let line = '';
    let y = textObj.y + textObj.fontSize;
    
    for (let word of words) {
      const testLine = line + word + ' ';
      const metrics = ctx.measureText(testLine);
      const testWidth = metrics.width;
      
      if (testWidth > textObj.width && line !== '') {
        ctx.fillText(line, textObj.x, y);
        line = word + ' ';
        y += textObj.fontSize * 1.2;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, textObj.x, y);
    saveCanvasData();
  }, [saveCanvasData]);

  const applyShapePath = useCallback((ctx, startX, startY, endX, endY, shapeType) => {
    ctx.beginPath();
    switch (shapeType) {
      case 'rectangle':
        ctx.rect(startX, startY, endX - startX, endY - startY);
        break;
      case 'circle': {
        const radius = Math.sqrt(
          Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2)
        );
        ctx.arc(startX, startY, radius, 0, 2 * Math.PI);
        break;
      }
      case 'triangle':
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.lineTo(startX - (endX - startX), endY);
        ctx.closePath();
        break;
      case 'line':
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        break;
      case 'arrow': {
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        const angle = Math.atan2(endY - startY, endX - startX);
        const headLength = 15;
        ctx.moveTo(endX, endY);
        ctx.lineTo(
          endX - headLength * Math.cos(angle - Math.PI / 6),
          endY - headLength * Math.sin(angle - Math.PI / 6)
        );
        ctx.moveTo(endX, endY);
        ctx.lineTo(
          endX - headLength * Math.cos(angle + Math.PI / 6),
          endY - headLength * Math.sin(angle + Math.PI / 6)
        );
        break;
      }
      default:
        return false;
    }
    return true;
  }, []);

  const drawShape = useCallback((startX, startY, endX, endY, shapeType, color = 'black', width = 2) => {
    if (!contextRef.current) return;
    const ctx = contextRef.current;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    const drawn = applyShapePath(ctx, startX, startY, endX, endY, shapeType);
    if (!drawn) return;
    ctx.stroke();
    saveCanvasData();
  }, [applyShapePath, saveCanvasData]);

  // ─── Canvas initialization (only once on mount) ───────────────────────────────

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const containerRect = container.getBoundingClientRect();
    const scale = zoomRef.current / 100;

    // Set canvas resolution (higher for crisp rendering)
    canvas.width = containerRect.width * 2;
    canvas.height = containerRect.height * 2;
    
    // Set display size with zoom
    canvas.style.width = `${containerRect.width}px`;
    canvas.style.height = `${containerRect.height}px`;

    const ctx = canvas.getContext('2d');
    ctx.scale(2, 2); // For crisp rendering
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = strokeColorRef.current;
    ctx.lineWidth = strokeWidthRef.current;
    contextRef.current = ctx;

    applyGridBackground(ctx, canvas.width / 2, canvas.height / 2);
  }, [applyGridBackground]);

  // Initialize canvas only once
  useEffect(() => {
    initCanvas();
  }, [initCanvas]);

  // Handle zoom changes without reinitializing canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const containerRect = container.getBoundingClientRect();
    const scale = zoom / 100;

    // Only change display size, not canvas resolution
    canvas.style.width = `${containerRect.width * scale}px`;
    canvas.style.height = `${containerRect.height * scale}px`;
    
    // Update context properties
    if (contextRef.current) {
      contextRef.current.strokeStyle = strokeColor;
      contextRef.current.lineWidth = strokeWidth;
    }
  }, [zoom, strokeColor, strokeWidth]);

  // ─── Socket listeners ────────────────────────────────────────────────────────

  useEffect(() => {
    const handleDraw = (data) => {
      if (data.type === 'stroke') {
        const { data: s } = data;
        drawOnCanvas(s.x1, s.y1, s.x2, s.y2, s.color, s.width);
      } else if (data.type === 'shape') {
        drawShape(data.startX, data.startY, data.endX, data.endY, data.shapeType, data.color, data.width);
      } else if (data.type === 'text') {
        drawText(data.textObj);
      }
    };

    socket.on('draw', handleDraw);
    return () => socket.off('draw', handleDraw);
  }, [drawOnCanvas, drawShape, drawText]);

  // ─── Mouse helpers ────────────────────────────────────────────────────────

  const getMousePos = useCallback((e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX / 2,
      y: (e.clientY - rect.top) * scaleY / 2,
    };
  }, []);

  const getScreenPos = useCallback((canvasX, canvasY) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = rect.width / canvas.width;
    const scaleY = rect.height / canvas.height;
    return {
      x: canvasX * scaleX * 2,
      y: canvasY * scaleY * 2,
    };
  }, []);

  // ─── Text object management ─────────────────────────────────────────────────

  const addTextObject = useCallback((x, y) => {
    const newTextObj = createTextObject(x, y);
    setTextObjects(prev => [...prev, newTextObj]);
    setSelectedTextId(newTextObj.id);
    
    // Emit to socket
    socket.emit('draw', {
      type: 'text',
      textObj: newTextObj,
    });
  }, []);

  const updateTextObject = useCallback((id, updates) => {
    setTextObjects(prev => prev.map(obj => 
      obj.id === id ? { ...obj, ...updates } : obj
    ));
  }, []);

  const deleteTextObject = useCallback((id) => {
    setTextObjects(prev => prev.filter(obj => obj.id !== id));
    setSelectedTextId(null);
  }, []);

  // ─── Drawing event handlers ───────────────────────────────────────────────

  const handleMouseDown = useCallback((e) => {
    const tool = activeToolRef.current;
    const pos = getMousePos(e);

    if (tool === 'text') {
      addTextObject(pos.x, pos.y);
      return;
    }

    const isShapeTool = ['rectangle', 'circle', 'triangle', 'line', 'arrow'].includes(tool);
    const isDrawingTool = ['pen', 'eraser'].includes(tool);

    if (!isShapeTool && !isDrawingTool) return;

    setIsDrawing(true);

    if (isShapeTool) {
      shapeStartPos.current = pos;
      saveCanvasData();
    } else {
      lastPos.current = pos;
    }
  }, [getMousePos, addTextObject, saveCanvasData]);

  const handleMouseMove = useCallback((e) => {
    if (!isDrawing) return;

    const tool = activeToolRef.current;
    const isShapeTool = ['rectangle', 'circle', 'triangle', 'line', 'arrow'].includes(tool);
    const isDrawingTool = ['pen', 'eraser'].includes(tool);

    if (isShapeTool && shapeStartPos.current) {
      const currentPos = getMousePos(e);
      // Preview shape (implementation would go here)
      return;
    }

    if (!isDrawingTool) return;

    const currentPos = getMousePos(e);
    const { x: lastX, y: lastY } = lastPos.current;

    const color = tool === 'eraser' ? '#FFFFFF' : strokeColorRef.current;
    const width = tool === 'eraser' ? strokeWidthRef.current * 3 : strokeWidthRef.current;

    drawOnCanvas(lastX, lastY, currentPos.x, currentPos.y, color, width);
    socket.emit('draw', { 
      type: 'stroke', 
      data: { x1: lastX, y1: lastY, x2: currentPos.x, y2: currentPos.y, color, width }
    });

    lastPos.current = currentPos;
  }, [isDrawing, getMousePos, drawOnCanvas]);

  const handleMouseUp = useCallback((e) => {
    if (!isDrawing) return;

    setIsDrawing(false);

    const tool = activeToolRef.current;
    const isShapeTool = ['rectangle', 'circle', 'triangle', 'line', 'arrow'].includes(tool);

    if (isShapeTool && shapeStartPos.current) {
      const finalPos = getMousePos(e);
      const startPos = shapeStartPos.current;

      drawShape(startPos.x, startPos.y, finalPos.x, finalPos.y, tool, strokeColorRef.current, strokeWidthRef.current);

      socket.emit('draw', {
        type: 'shape',
        shapeType: tool,
        startX: startPos.x,
        startY: startPos.y,
        endX: finalPos.x,
        endY: finalPos.y,
        color: strokeColorRef.current,
        width: strokeWidthRef.current,
      });
    }

    shapeStartPos.current = null;
    saveCanvasData();
  }, [isDrawing, getMousePos, drawShape, saveCanvasData]);

  // ─── Text interaction handlers ───────────────────────────────────────────────

  const handleTextClick = useCallback((textObj, e) => {
    e.stopPropagation();
    setSelectedTextId(textObj.id);
  }, []);

  const handleTextDoubleClick = useCallback((textObj, e) => {
    e.stopPropagation();
    updateTextObject(textObj.id, { isEditing: true });
  }, [updateTextObject]);

  const handleTextChange = useCallback((textObj, value) => {
    updateTextObject(textObj.id, { text: value });
  }, [updateTextObject]);

  const handleTextBlur = useCallback((textObj) => {
    updateTextObject(textObj.id, { isEditing: false });
  }, [updateTextObject]);

  // ─── Cursor style ───────────────────────────────────────────────────────────

  const getCursorStyle = () => {
    switch (activeTool) {
      case 'pen': return 'crosshair';
      case 'eraser': return 'grab';
      case 'select': return 'move';
      case 'text': return 'text';
      default: return 'default';
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

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

      {/* Render text objects */}
      {textObjects.map(textObj => {
        const screenPos = getScreenPos(textObj.x, textObj.y);
        const isSelected = selectedTextId === textObj.id;
        
        return (
          <div
            key={textObj.id}
            className={`text-object ${isSelected ? 'selected' : ''}`}
            style={{
              position: 'absolute',
              left: screenPos.x,
              top: screenPos.y,
              width: textObj.width,
              height: textObj.height,
              border: isSelected ? '2px solid #1a73e8' : '1px solid transparent',
              borderRadius: '4px',
              padding: '4px',
              cursor: textObj.isEditing ? 'text' : 'move',
              backgroundColor: textObj.isEditing ? 'white' : 'transparent',
              zIndex: isSelected ? 1000 : 1,
            }}
            onClick={(e) => handleTextClick(textObj, e)}
            onDoubleClick={(e) => handleTextDoubleClick(textObj, e)}
          >
            {textObj.isEditing ? (
              <textarea
                value={textObj.text}
                onChange={(e) => handleTextChange(textObj, e.target.value)}
                onBlur={() => handleTextBlur(textObj)}
                autoFocus
                style={{
                  width: '100%',
                  height: '100%',
                  border: 'none',
                  outline: 'none',
                  resize: 'none',
                  fontSize: `${textObj.fontSize}px`,
                  fontFamily: 'Arial',
                  color: textObj.color,
                  backgroundColor: 'transparent',
                }}
              />
            ) : (
              <div
                style={{
                  fontSize: `${textObj.fontSize}px`,
                  fontFamily: 'Arial',
                  color: textObj.color,
                  whiteSpace: 'pre-wrap',
                  wordWrap: 'break-word',
                }}
              >
                {textObj.text || 'Click to edit'}
              </div>
            )}
            
            {/* Resize handles */}
            {isSelected && !textObj.isEditing && (
              <>
                <div className="resize-handle top-left" style={{ position: 'absolute', top: -4, left: -4, width: 8, height: 8, backgroundColor: '#1a73e8', cursor: 'nw-resize' }} />
                <div className="resize-handle top-right" style={{ position: 'absolute', top: -4, right: -4, width: 8, height: 8, backgroundColor: '#1a73e8', cursor: 'ne-resize' }} />
                <div className="resize-handle bottom-left" style={{ position: 'absolute', bottom: -4, left: -4, width: 8, height: 8, backgroundColor: '#1a73e8', cursor: 'sw-resize' }} />
                <div className="resize-handle bottom-right" style={{ position: 'absolute', bottom: -4, right: -4, width: 8, height: 8, backgroundColor: '#1a73e8', cursor: 'se-resize' }} />
              </>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default CanvasBoard;
