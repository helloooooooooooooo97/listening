import { useMemo, useRef, useState, useEffect } from 'react';
import type { TileData } from './levelGenerator';
import GameTile from './GameTile';

const GRID_COLS = 8;
const GRID_ROWS = 6;
const CELL_MAX = 84;
const CELL_MIN = 48;
const GAP = 3;
const LAYER_OFFSET = 16;

interface GameBoardProps {
  tiles: TileData[];
  inDegree: Record<string, number>;
  onTileClick: (tileId: string) => void;
}

export default function GameBoard({ tiles, inDegree, onTileClick }: GameBoardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [cellSize, setCellSize] = useState(CELL_MAX);

  const byLayer = useMemo(() => {
    const map = new Map<number, Map<string, TileData>>();
    let maxLayer = 0;
    for (const t of tiles) {
      maxLayer = Math.max(maxLayer, t.layer);
      const grid = map.get(t.layer) || new Map();
      grid.set(`${t.row},${t.col}`, t);
      map.set(t.layer, grid);
    }
    return { gridMap: map, maxLayer };
  }, [tiles]);

  const layers = useMemo(() => {
    const result: number[] = [];
    for (let l = 0; l <= byLayer.maxLayer; l++) result.push(l);
    return result;
  }, [byLayer]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      const layerPad = byLayer.maxLayer * LAYER_OFFSET;
      const available = w - layerPad;
      const raw = Math.floor((available - (GRID_COLS - 1) * GAP) / GRID_COLS);
      setCellSize(Math.max(CELL_MIN, Math.min(CELL_MAX, raw)));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [byLayer.maxLayer]);

  const boardHeight = useMemo(() => {
    const gridHeight = GRID_ROWS * cellSize + (GRID_ROWS - 1) * GAP;
    return gridHeight + byLayer.maxLayer * LAYER_OFFSET;
  }, [byLayer.maxLayer, cellSize]);

  if (tiles.length === 0) return null;

  return (
    <div ref={containerRef} className="relative w-full mx-auto flex items-start justify-center" style={{ height: boardHeight }}>
      {layers.map(layer => {
        const layerTiles = byLayer.gridMap.get(layer);
        if (!layerTiles || layerTiles.size === 0) return null;
        return (
          <div
            key={layer}
            className="absolute pointer-events-none"
            style={{ zIndex: 0, marginLeft: `${layer * LAYER_OFFSET}px`, marginTop: `${layer * LAYER_OFFSET}px` }}
          >
            <div
              className="grid pointer-events-none"
              style={{
                gridTemplateColumns: `repeat(${GRID_COLS}, ${cellSize}px)`,
                gridTemplateRows: `repeat(${GRID_ROWS}, ${cellSize}px)`,
                gap: `${GAP}px`,
              }}
            >
              {Array.from({ length: GRID_ROWS * GRID_COLS }, (_, idx) => {
                const r = Math.floor(idx / GRID_COLS);
                const c = idx % GRID_COLS;
                const key = `${r},${c}`;
                const tile = layerTiles.get(key) ?? null;
                const clickable = tile ? (inDegree[tile.id] ?? 1) === 0 : false;
                if (!tile) return <div key={key} className="pointer-events-none" />;
                return (
                  <div key={key} className="pointer-events-auto" style={{ width: cellSize, height: cellSize }}>
                    <GameTile
                      word={tile.word}
                      emoji={tile.emoji}
                      inDegree={inDegree[tile.id] ?? 0}
                      isClickable={clickable}
                      cellSize={cellSize}
                      onClick={() => onTileClick(tile.id)}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
