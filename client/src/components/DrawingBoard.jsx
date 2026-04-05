import { useEffect, useMemo, useRef, useState } from 'react';

const DEFAULT_LAYERS = ['Layer 1', 'Layer 2', 'Layer 3'];

const getPoint = (event, canvas) => {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * canvas.width,
    y: ((event.clientY - rect.top) / rect.height) * canvas.height
  };
};

export default function DrawingBoard({ strokes = [], onStroke, disabled }) {
  const canvasRef = useRef(null);
  const [tool, setTool] = useState('brush');
  const [color, setColor] = useState('#ffffff');
  const [size, setSize] = useState(6);
  const [zoom, setZoom] = useState(1);
  const [currentLayer, setCurrentLayer] = useState(0);
  const [localStrokes, setLocalStrokes] = useState([]);
  const [drawing, setDrawing] = useState(false);
  const lastPointRef = useRef(null);

  const mergedStrokes = useMemo(() => [...strokes, ...localStrokes], [strokes, localStrokes]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (const stroke of mergedStrokes) {
      ctx.globalCompositeOperation = stroke.tool === 'eraser' ? 'destination-out' : 'source-over';
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.size;
      ctx.beginPath();
      ctx.moveTo(stroke.from.x, stroke.from.y);
      ctx.lineTo(stroke.to.x, stroke.to.y);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
  }, [mergedStrokes]);

  const startDraw = (event) => {
    if (disabled) return;
    setDrawing(true);
    lastPointRef.current = getPoint(event, canvasRef.current);
  };

  const moveDraw = (event) => {
    if (!drawing || disabled) return;
    const point = getPoint(event, canvasRef.current);
    const stroke = {
      from: lastPointRef.current,
      to: point,
      color,
      size,
      tool,
      layer: currentLayer,
      ts: Date.now()
    };
    setLocalStrokes((prev) => [...prev, stroke]);
    onStroke?.(stroke);
    lastPointRef.current = point;
  };

  const endDraw = () => {
    setDrawing(false);
    lastPointRef.current = null;
  };

  const undo = () => {
    setLocalStrokes((prev) => {
      const idx = [...prev].reverse().findIndex((s) => s.layer === currentLayer);
      if (idx === -1) return prev;
      const removeIndex = prev.length - 1 - idx;
      return prev.filter((_, i) => i !== removeIndex);
    });
  };

  return (
    <div className="panel p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button className={`btn ${tool === 'brush' ? 'bg-primary text-white' : 'bg-slate-700 text-slate-200'}`} onClick={() => setTool('brush')}>Brush</button>
        <button className={`btn ${tool === 'eraser' ? 'bg-primary text-white' : 'bg-slate-700 text-slate-200'}`} onClick={() => setTool('eraser')}>Erase</button>
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 w-10 rounded-md border border-slate-500 bg-transparent" />
        <label className="text-slate-200">Size {size}
          <input type="range" min="1" max="24" value={size} onChange={(e) => setSize(Number(e.target.value))} className="ml-2 align-middle" />
        </label>
        <button className="btn bg-slate-700 text-white" onClick={undo}>Undo</button>
        <label className="text-slate-200">Zoom
          <input type="range" min="0.6" max="2" step="0.1" value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="ml-2 align-middle" />
        </label>
        <select className="input max-w-40" value={currentLayer} onChange={(e) => setCurrentLayer(Number(e.target.value))}>
          {DEFAULT_LAYERS.map((layer, index) => (
            <option key={layer} value={index}>{layer}</option>
          ))}
        </select>
      </div>
      <div className="overflow-auto rounded-xl border border-slate-600 bg-slate-950 p-2">
        <canvas
          ref={canvasRef}
          width={1000}
          height={650}
          className="mx-auto max-h-[65vh] w-full touch-none rounded-xl"
          style={{ transform: `scale(${zoom})`, transformOrigin: 'center top' }}
          onPointerDown={startDraw}
          onPointerMove={moveDraw}
          onPointerUp={endDraw}
          onPointerLeave={endDraw}
        />
      </div>
    </div>
  );
}
