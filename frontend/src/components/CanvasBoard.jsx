import React, { useEffect, useRef, useState } from 'react';
import socket from '../socket';

const CanvasBoard = ({ activeTool, strokeColor, strokeWidth, zoom }) => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const contextRef = useRef(null);
  const lastPos = useRef({ x: 0, y: 0 });
  const containerRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    
    if (!canvas || !container) return;

    // Set canvas size based on container and zoom
    const containerRect = container.getBoundingClientRect();
    const scale = zoom / 100;
    
    canvas.width = containerRect.width * 2 * scale;
    canvas.height = containerRect.height * 2 * scale;
    canvas.style.width = `${containerRect.width * scale}px`;
    canvas.style.height = `${containerRect.height * scale}px`;

    const context = canvas.getContext('2d');
    context.scale(2, 2);
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.strokeStyle = strokeColor;
    context.lineWidth = strokeWidth;
    contextRef.current = context;

    // Apply grid background
    applyGridBackground(context, canvas.width / 2, canvas.height / 2);

    // Receive strokes from other users
    // Gateway emits the raw stroke object; it may arrive as { type, data } or directly as stroke data
    socket.on('draw', (stroke) => {
      const data = stroke.data || stroke;
      drawOnCanvas(data.x1, data.y1, data.x2, data.y2, data.color, data.width);
    });

    return () => socket.off('draw');
  }, [zoom]);

  useEffect(() => {
    if (contextRef.current) {
      contextRef.current.strokeStyle = strokeColor;
      contextRef.current.lineWidth = strokeWidth;
    }
  }, [strokeColor, strokeWidth]);

  const applyGridBackground = (context, width, height) => {
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
  };

  const drawOnCanvas = (x1, y1, x2, y2, color = 'black', width = 2) => {
    if (!contextRef.current) return;
    
    contextRef.current.strokeStyle = color;
    contextRef.current.lineWidth = width;
    contextRef.current.beginPath();
    contextRef.current.moveTo(x1, y1);
    contextRef.current.lineTo(x2, y2);
    contextRef.current.stroke();
    contextRef.current.closePath();
  };

  const getMousePos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    return {
      x: (e.clientX - rect.left) * scaleX / 2,
      y: (e.clientY - rect.top) * scaleY / 2
    };
  };

  const startDrawing = (e) => {
    if (activeTool !== 'pen' && activeTool !== 'eraser') return;
    
    const pos = getMousePos(e.nativeEvent);
    setIsDrawing(true);
    lastPos.current = pos;

    // Set cursor based on tool
    const canvas = canvasRef.current;
    if (activeTool === 'eraser') {
      canvas.style.cursor = 'grab';
    } else {
      canvas.style.cursor = 'crosshair';
    }
  };

  const draw = (e) => {
    if (!isDrawing) return;
    if (activeTool !== 'pen' && activeTool !== 'eraser') return;

    const currentPos = getMousePos(e.nativeEvent);
    const { x: lastX, y: lastY } = lastPos.current;

    let color = strokeColor;
    let width = strokeWidth;

    if (activeTool === 'eraser') {
      color = '#FFFFFF';
      width = strokeWidth * 3;
    }

    const strokeData = {
      x1: lastX,
      y1: lastY,
      x2: currentPos.x,
      y2: currentPos.y,
      color: color,
      width: width
    };

    // Draw locally
    drawOnCanvas(strokeData.x1, strokeData.y1, strokeData.x2, strokeData.y2, strokeData.color, strokeData.width);

    // Send to server
    socket.emit('draw', { type: 'stroke', data: strokeData });

    lastPos.current = currentPos;
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    const canvas = canvasRef.current;
    canvas.style.cursor = 'default';
  };

  const getCursorStyle = () => {
    switch (activeTool) {
      case 'pen':
        return 'crosshair';
      case 'eraser':
        return 'grab';
      case 'select':
        return 'move';
      case 'text':
        return 'text';
      default:
        return 'default';
    }
  };

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
    </div>
  );
};

export default CanvasBoard;
