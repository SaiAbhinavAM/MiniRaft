import React, { useEffect, useRef, useState, useCallback } from 'react';
import socket from '../socket';

const CanvasBoard = ({ activeTool, strokeColor, strokeWidth, zoom }) => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const contextRef = useRef(null);
  const lastPos = useRef({ x: 0, y: 0 });
  const containerRef = useRef(null);
  const canvasDataRef = useRef(null);
  const shapeStartPos = useRef(null);
  const [isTyping, setIsTyping] = useState(false);
  const [textPosition, setTextPosition] = useState(null);
  const [currentText, setCurrentText] = useState('');
  const textInputRef = useRef(null);

  // Track current tool/color/width in refs so socket handlers always have latest values
  // without needing to be re-registered
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

  const drawText = useCallback((x, y, text, color = 'black', fontSize = 16) => {
    if (!contextRef.current || !text) return;
    const ctx = contextRef.current;
    ctx.fillStyle = color;
    ctx.font = `${fontSize}px Arial`;
    ctx.fillText(text, x, y);
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

  // Preview draws on top of saved canvas snapshot — no state changes involved
  const drawShapePreview = useCallback((startX, startY, endX, endY, shapeType, color = 'black', width = 2) => {
    const canvas = canvasRef.current;
    const ctx = contextRef.current;
    if (!ctx || !canvas) return;

    const savedData = canvasDataRef.current;
    if (!savedData) return;

    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);

      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.globalAlpha = 0.7;
      applyShapePath(ctx, startX, startY, endX, endY, shapeType);
      ctx.stroke();
      ctx.restore();
    };
    img.src = savedData;
  }, [applyShapePath]);

  // ─── Canvas initialisation / resize (only zoom drives this) ───────────────

  const initCanvas = useCallback((currentZoom) => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const prevData = canvasDataRef.current;

    const containerRect = container.getBoundingClientRect();
    const scale = currentZoom / 100;

    canvas.width = containerRect.width * 2 * scale;
    canvas.height = containerRect.height * 2 * scale;
    canvas.style.width = `${containerRect.width * scale}px`;
    canvas.style.height = `${containerRect.height * scale}px`;

    const ctx = canvas.getContext('2d');
    ctx.scale(2, 2);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = strokeColorRef.current;
    ctx.lineWidth = strokeWidthRef.current;
    contextRef.current = ctx;

    if (prevData) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0);
        applyGridBackground(ctx, canvas.width / 2, canvas.height / 2);
      };
      img.src = prevData;
    } else {
      applyGridBackground(ctx, canvas.width / 2, canvas.height / 2);
    }
  }, [applyGridBackground]);

  // Run only when zoom changes — drawing operations must NOT trigger this
  useEffect(() => {
    initCanvas(zoom);
  }, [zoom]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Socket listeners (registered once, use refs for latest values) ────────

  useEffect(() => {
    const handleDraw = (data) => {
      if (data.type === 'stroke') {
        const { data: s } = data;
        drawOnCanvas(s.x1, s.y1, s.x2, s.y2, s.color, s.width);
      } else if (data.type === 'shape') {
        drawShape(data.startX, data.startY, data.endX, data.endY, data.shapeType, data.color, data.width);
      } else if (data.type === 'text') {
        drawText(data.x, data.y, data.text, data.color, data.fontSize);
      }
    };

    socket.on('draw', handleDraw);
    return () => socket.off('draw', handleDraw);
  }, [drawOnCanvas, drawShape, drawText]);

  // ─── Keep context style in sync ───────────────────────────────────────────

  useEffect(() => {
    if (contextRef.current) {
      contextRef.current.strokeStyle = strokeColor;
      contextRef.current.lineWidth = strokeWidth;
    }
  }, [strokeColor, strokeWidth]);

  // ─── Mouse helpers ────────────────────────────────────────────────────────

  const getMousePos = useCallback((e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX / 2,
      y: (e.clientY - rect.top) * scaleY / 2,

  // ─── Drawing event handlers ───────────────────────────────────────────────

  const startDrawing = useCallback((e) => {
    // Prevent drawing when typing
    if (isTyping) return;
    
    const tool = activeToolRef.current;
    const isShapeTool = ['rectangle', 'circle', 'triangle', 'line', 'arrow'].includes(tool);
    const isDrawingTool = ['pen', 'eraser'].includes(tool);
    const isTextTool = tool === 'text';

    if (isTextTool) {
      const pos = getMousePos(e.nativeEvent);
      setTextPosition(pos);
      setIsTyping(true);
      setCurrentText('');
      return;
    }

    if (!isShapeTool && !isDrawingTool) return;

    const pos = getMousePos(e.nativeEvent);
    setIsDrawing(true);

    if (isShapeTool) {
      shapeStartPos.current = pos;
      // Snapshot canvas before shape preview starts
      saveCanvasData();
    } else {
      lastPos.current = pos;
    }
  }, [getMousePos, saveCanvasData]);

  const draw = useCallback((e) => {
    if (!isDrawing) return;

    const tool = activeToolRef.current;
    const isShapeTool = ['rectangle', 'circle', 'triangle', 'line', 'arrow'].includes(tool);
    const isDrawingTool = ['pen', 'eraser'].includes(tool);

    if (isShapeTool) {
      if (shapeStartPos.current) {
        const currentPos = getMousePos(e.nativeEvent);
        drawShapePreview(
          shapeStartPos.current.x,
          shapeStartPos.current.y,
          currentPos.x,
          currentPos.y,
          tool,
          strokeColorRef.current,
          strokeWidthRef.current
        );
      }
      return;
    }

    if (!isDrawingTool) return;

    const currentPos = getMousePos(e.nativeEvent);
    const { x: lastX, y: lastY } = lastPos.current;

    const color = tool === 'eraser' ? '#FFFFFF' : strokeColorRef.current;
    const width = tool === 'eraser' ? strokeWidthRef.current * 3 : strokeWidthRef.current;

    const strokeData = { x1: lastX, y1: lastY, x2: currentPos.x, y2: currentPos.y, color, width };
    drawOnCanvas(strokeData.x1, strokeData.y1, strokeData.x2, strokeData.y2, strokeData.color, strokeData.width);
    socket.emit('draw', { type: 'stroke', data: strokeData });

    lastPos.current = currentPos;
  }, [isDrawing, getMousePos, drawShapePreview, drawOnCanvas]);

  const stopDrawing = useCallback((e) => {
    if (!isDrawing) return;

    setIsDrawing(false);

    const tool = activeToolRef.current;
    const isShapeTool = ['rectangle', 'circle', 'triangle', 'line', 'arrow'].includes(tool);

    if (isShapeTool && shapeStartPos.current && e) {
      const finalPos = getMousePos(e.nativeEvent ?? e);
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

  // ─── Text handlers ────────────────────────────────────────────────────────

  const handleTextSubmit = useCallback(() => {
    if (currentText.trim() && textPosition) {
      const fontSize = strokeWidthRef.current * 8;
      drawText(textPosition.x, textPosition.y, currentText, strokeColorRef.current, fontSize);
      socket.emit('draw', {
        type: 'text',
        x: textPosition.x,
        y: textPosition.y,
        text: currentText,
        color: strokeColorRef.current,
        fontSize,
      });
    }
    setIsTyping(false);
    setTextPosition(null);
    setCurrentText('');
  }, [currentText, textPosition, drawText]);

  const handleTextCancel = useCallback(() => {
    setIsTyping(false);
    setTextPosition(null);
    setCurrentText('');
  }, []);

  const handleTextKeyDown = useCallback((e) => {
    if (e.key === 'Enter') { e.preventDefault(); handleTextSubmit(); }
    else if (e.key === 'Escape') { e.preventDefault(); handleTextCancel(); }
  }, [handleTextSubmit, handleTextCancel]);

  // ─── Cursor ───────────────────────────────────────────────────────────────

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
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        ref={canvasRef}
        style={{ cursor: getCursorStyle() }}
      />

      {isTyping && textPosition && (
        <div
          className="text-input-overlay"
          style={{
            position: 'absolute',
            left: textPosition.x,
            top: textPosition.y,
            zIndex: 1000,
            transform: 'translate(-50%, -50%)',
          }}
        >
          <input
            ref={textInputRef}
            type="text"
            value={currentText}
            onChange={(e) => setCurrentText(e.target.value)}
            onKeyDown={handleTextKeyDown}
            onBlur={handleTextSubmit}
            className="text-input"
            placeholder="Type text..."
            autoFocus
            style={{
              padding: '4px 8px',
              border: '2px solid #1a73e8',
              borderRadius: '4px',
              fontSize: `${strokeWidth * 8}px`,
              fontFamily: 'Arial',
              color: strokeColor,
              backgroundColor: 'white',
              minWidth: '200px',
              outline: 'none',
            }}
          />
          <div
            className="text-input-hint"
            style={{ fontSize: '12px', color: '#666', marginTop: '4px', textAlign: 'center' }}
          >
            Press Enter to submit, Escape to cancel
          </div>
        </div>
      )}
    </div>
  );
};

export default CanvasBoard;