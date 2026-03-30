import React, { useEffect, useRef, useState } from 'react';
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

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    
    if (!canvas || !container) return;

    // Save current canvas content before resizing
    if (canvasDataRef.current === null && canvas.width > 0) {
      canvasDataRef.current = canvas.toDataURL();
    }

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

    // Restore canvas content if it exists
    if (canvasDataRef.current) {
      const img = new Image();
      img.onload = () => {
        context.drawImage(img, 0, 0);
        // Re-apply grid background on top
        applyGridBackground(context, canvas.width / 2, canvas.height / 2);
      };
      img.src = canvasDataRef.current;
    } else {
      // Apply grid background only for initial load
      applyGridBackground(context, canvas.width / 2, canvas.height / 2);
    }

    // Receive strokes from other users
    socket.on('draw', (data) => {
      if (data.type === 'stroke') {
        const { data: strokeData } = data;
        drawOnCanvas(strokeData.x1, strokeData.y1, strokeData.x2, strokeData.y2, strokeData.color, strokeData.width);
      } else if (data.type === 'shape') {
        drawShape(
          data.startX,
          data.startY,
          data.endX,
          data.endY,
          data.shapeType,
          data.color,
          data.width
        );
      } else if (data.type === 'text') {
        drawText(data.x, data.y, data.text, data.color, data.fontSize);
      }
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
    
    // Save canvas data after drawing
    const canvas = canvasRef.current;
    if (canvas && canvas.width > 0) {
      canvasDataRef.current = canvas.toDataURL();
    }
  };

  const drawText = (x, y, text, color = 'black', fontSize = 16, fontFamily = 'Arial') => {
    if (!contextRef.current || !text) return;
    
    const context = contextRef.current;
    context.fillStyle = color;
    context.font = `${fontSize}px ${fontFamily}`;
    context.fillText(text, x, y);
    
    // Save canvas data after drawing text
    const canvas = canvasRef.current;
    if (canvas && canvas.width > 0) {
      canvasDataRef.current = canvas.toDataURL();
    }
  };

  const drawShape = (startX, startY, endX, endY, shapeType, color = 'black', width = 2) => {
    if (!contextRef.current) return;
    
    const context = contextRef.current;
    context.strokeStyle = color;
    context.lineWidth = width;
    context.beginPath();

    switch (shapeType) {
      case 'rectangle':
        context.rect(startX, startY, endX - startX, endY - startY);
        break;
      case 'circle':
        const radius = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
        context.arc(startX, startY, radius, 0, 2 * Math.PI);
        break;
      case 'triangle':
        context.moveTo(startX, startY);
        context.lineTo(endX, endY);
        context.lineTo(startX - (endX - startX), endY);
        context.closePath();
        break;
      case 'line':
        context.moveTo(startX, startY);
        context.lineTo(endX, endY);
        break;
      case 'arrow':
        context.moveTo(startX, startY);
        context.lineTo(endX, endY);
        // Draw arrowhead
        const angle = Math.atan2(endY - startY, endX - startX);
        const headLength = 15;
        context.moveTo(endX, endY);
        context.lineTo(
          endX - headLength * Math.cos(angle - Math.PI / 6),
          endY - headLength * Math.sin(angle - Math.PI / 6)
        );
        context.moveTo(endX, endY);
        context.lineTo(
          endX - headLength * Math.cos(angle + Math.PI / 6),
          endY - headLength * Math.sin(angle + Math.PI / 6)
        );
        break;
      default:
        return;
    }
    
    context.stroke();
    if (shapeType !== 'line' && shapeType !== 'arrow') {
      context.closePath();
    }
    
    // Save canvas data after drawing
    const canvas = canvasRef.current;
    if (canvas && canvas.width > 0) {
      canvasDataRef.current = canvas.toDataURL();
    }
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
    const isShapeTool = ['rectangle', 'circle', 'triangle', 'line', 'arrow'].includes(activeTool);
    const isDrawingTool = ['pen', 'eraser'].includes(activeTool);
    const isTextTool = activeTool === 'text';
    
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
      // Save canvas state before drawing shape for preview
      const canvas = canvasRef.current;
      if (canvas && canvas.width > 0) {
        canvasDataRef.current = canvas.toDataURL();
      }
    } else {
      lastPos.current = pos;
    }

    // Set cursor based on tool
    const canvas = canvasRef.current;
    if (activeTool === 'eraser') {
      canvas.style.cursor = 'grab';
    } else if (isShapeTool || isTextTool) {
      canvas.style.cursor = 'crosshair';
    } else {
      canvas.style.cursor = 'crosshair';
    }
  };

  const draw = (e) => {
    if (!isDrawing) return;
    
    const currentPos = getMousePos(e.nativeEvent);
    const isShapeTool = ['rectangle', 'circle', 'triangle', 'line', 'arrow'].includes(activeTool);
    const isDrawingTool = ['pen', 'eraser'].includes(activeTool);
    
    if (isShapeTool) {
      // For shapes, restore canvas and draw preview
      if (canvasDataRef.current && shapeStartPos.current) {
        const canvas = canvasRef.current;
        const context = contextRef.current;
        const startPos = shapeStartPos.current; // Store reference to avoid null issues
        
        // Restore canvas to state before shape started
        const img = new Image();
        img.onload = () => {
          // Double-check that we still have a valid start position
          if (startPos && context && canvas) {
            context.clearRect(0, 0, canvas.width, canvas.height);
            context.drawImage(img, 0, 0);
            
            // Draw shape preview
            drawShape(
              startPos.x,
              startPos.y,
              currentPos.x,
              currentPos.y,
              activeTool,
              strokeColor,
              strokeWidth
            );
          }
        };
        img.src = canvasDataRef.current;
      }
      return;
    }
    
    if (!isDrawingTool) return;

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

  const stopDrawing = (e) => {
    if (!isDrawing) return;
    
    setIsDrawing(false);
    const canvas = canvasRef.current;
    canvas.style.cursor = 'default';
    
    const isShapeTool = ['rectangle', 'circle', 'triangle', 'line', 'arrow'].includes(activeTool);
    
    if (isShapeTool && shapeStartPos.current && e) {
      // Get final position for shape
      const finalPos = getMousePos(e);
      const startPos = shapeStartPos.current; // Store reference
      
      // Draw the final shape
      drawShape(
        startPos.x,
        startPos.y,
        finalPos.x,
        finalPos.y,
        activeTool,
        strokeColor,
        strokeWidth
      );
      
      // Send shape data to server
      const shapeData = {
        type: 'shape',
        shapeType: activeTool,
        startX: startPos.x,
        startY: startPos.y,
        endX: finalPos.x,
        endY: finalPos.y,
        color: strokeColor,
        width: strokeWidth
      };
      
      socket.emit('draw', shapeData);
    }
    
    // Save canvas data after drawing stops
    if (canvas && canvas.width > 0) {
      canvasDataRef.current = canvas.toDataURL();
    }
    
    shapeStartPos.current = null;
  };

  const handleTextSubmit = () => {
    if (currentText.trim() && textPosition) {
      const pos = textPosition; // Store reference
      drawText(pos.x, pos.y, currentText, strokeColor, strokeWidth * 8);
      
      // Send text data to server
      const textData = {
        type: 'text',
        x: pos.x,
        y: pos.y,
        text: currentText,
        color: strokeColor,
        fontSize: strokeWidth * 8
      };
      
      socket.emit('draw', textData);
    }
    
    setIsTyping(false);
    setTextPosition(null);
    setCurrentText('');
  };

  const handleTextCancel = () => {
    setIsTyping(false);
    setTextPosition(null);
    setCurrentText('');
  };

  const handleTextKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleTextSubmit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleTextCancel();
    }
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
      
      {isTyping && textPosition && (
        <div
          className="text-input-overlay"
          style={{
            position: 'absolute',
            left: textPosition.x,
            top: textPosition.y,
            zIndex: 1000,
            transform: 'translate(-50%, -50%)'
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
              outline: 'none'
            }}
          />
          <div className="text-input-hint" style={{
            fontSize: '12px',
            color: '#666',
            marginTop: '4px',
            textAlign: 'center'
          }}>
            Press Enter to submit, Escape to cancel
          </div>
        </div>
      )}
    </div>
  );
};

export default CanvasBoard;
