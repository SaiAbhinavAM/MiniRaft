import React, { useEffect, useRef, useState } from 'react';
import socket from './socket';

const CanvasBoard = () => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const contextRef = useRef(null);
  const lastPos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    canvas.width = window.innerWidth * 2;
    canvas.height = window.innerHeight * 2;
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;

    const context = canvas.getContext('2d');
    context.scale(2, 2);
    context.lineCap = 'round';
    context.strokeStyle = 'black';
    context.lineWidth = 2;
    contextRef.current = context;

    // Receive strokes from other users
    socket.on('draw', (stroke) => {
      const { data } = stroke;
      drawOnCanvas(data.x1, data.y1, data.x2, data.y2, data.color);
    });

    return () => socket.off('draw');
  }, []);

  const drawOnCanvas = (x1, y1, x2, y2, color = 'black') => {
    if (!contextRef.current) return;
    contextRef.current.strokeStyle = color;
    contextRef.current.beginPath();
    contextRef.current.moveTo(x1, y1);
    contextRef.current.lineTo(x2, y2);
    contextRef.current.stroke();
    contextRef.current.closePath();
  };

  const startDrawing = ({ nativeEvent }) => {
    const { offsetX, offsetY } = nativeEvent;
    setIsDrawing(true);
    lastPos.current = { x: offsetX, y: offsetY };
  };

  const draw = ({ nativeEvent }) => {
    if (!isDrawing) return;
    const { offsetX, offsetY } = nativeEvent;
    const { x, y } = lastPos.current;

    const strokeData = {
      x1: x,
      y1: y,
      x2: offsetX,
      y2: offsetY,
      color: 'black'
    };

    // Draw locally
    drawOnCanvas(strokeData.x1, strokeData.y1, strokeData.x2, strokeData.y2, strokeData.color);

    // Send to server
    socket.emit('draw', { type: 'stroke', data: strokeData });

    lastPos.current = { x: offsetX, y: offsetY };
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  return (
    <canvas
      onMouseDown={startDrawing}
      onMouseMove={draw}
      onMouseUp={stopDrawing}
      onMouseLeave={stopDrawing}
      ref={canvasRef}
    />
  );
};

export default CanvasBoard;
