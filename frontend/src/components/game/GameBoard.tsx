import { useMemo } from 'react';
import type { TileData } from './levelGenerator';
import GameTile from './GameTile';

const GRID_COLS = 8;
const GRID_ROWS = 6;
const CELL = 84;

interface GameBoardProps {
  tiles: TileData[];
  inDegree: Record<string, number>;
  onTileClick: (tileId: string) => void;
}

export default function GameBoard({ tiles, inDegree, onTileClick }: GameBoardProps) {
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

  const boardHeight = useMemo(() => {
    const gridHeight = GRID_ROWS * CELL + (GRID_ROWS - 1) * 3;
    return gridHeight + byLayer.maxLayer * 16;
  }, [byLayer]);

  if (tiles.length === 0) return null;

  return (
    <div className="relative w-full mx-auto flex items-start justify-center" style={{ height: boardHeight }}>
      {layers.map(layer => {
        const layerTiles = byLayer.gridMap.get(layer);
        if (!layerTiles || layerTiles.size === 0) return null;
        return (
          <div
            key={layer}
            className="absolute pointer-events-none"
            style={{ zIndex: 0, marginLeft: `${layer * 16}px`, marginTop: `${layer * 16}px` }}
          >
            <div
              className="grid pointer-events-none"
              style={{
                gridTemplateColumns: `repeat(${GRID_COLS}, ${CELL}px)`,
                gridTemplateRows: `repeat(${GRID_ROWS}, ${CELL}px)`,
                gap: '3px',
              }}
            >
              {Array.from({ length: GRID_ROWS * GRID_COLS }, (_, idx) => {
                const r = Math.floor(idx / GRID_COLS);
                const c = idx % GRID_COLS;
                const key = `${r},${c}`;
                const tile = layerTiles.get(key) ?? null;
                const clickable = tile ? (inDegree[tile.id] ?? 1) === 0 : false;
                // Only render a cell wrapper when there's a tile — empty cells must NOT have
                // pointer-events-auto or they'd swallow clicks meant for lower layers.
                if (!tile) return <div key={key} className="pointer-events-none" />;
                return (
                  <div key={key} className="pointer-events-auto" style={{ width: CELL, height: CELL }}>
                    <GameTile
                      word={tile.word}
                      emoji={tile.emoji}
                      inDegree={inDegree[tile.id] ?? 0}
                      isClickable={clickable}
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
