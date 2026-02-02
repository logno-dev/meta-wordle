"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { SCRABBLE_SCORES } from "@/lib/letters";

type Tile = {
  x: number;
  y: number;
  letter: string;
  direction: "horizontal" | "vertical";
  word_id?: number;
};

type LetterEntry = {
  letter: string;
  quantity: number;
  updated_at?: string | null;
};

type BoardSceneProps = {
  tiles: Tile[];
  letters: LetterEntry[];
  loggedIn: boolean;
  totalScore: number;
  boardId: number;
};

const TILE_SIZE = 56;
const PLANE_SIZE = 4200;
const KEYBOARD_ESTIMATE = 260;
const MIN_SCALE = 0.3;
const MAX_SCALE = 1.5;

const KEY_ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];

export default function BoardScene({
  tiles,
  letters,
  loggedIn,
  totalScore,
  boardId,
}: BoardSceneProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [dragging, setDragging] = useState(false);
  const [selected, setSelected] = useState<Tile | null>(null);
  const [typedWord, setTypedWord] = useState("");
  const [anchorOccurrence, setAnchorOccurrence] = useState(0);
  const [directionMode, setDirectionMode] = useState<"perpendicular" | "straight">(
    "perpendicular",
  );
  const [directionHint, setDirectionHint] = useState<{
    x: number;
    y: number;
    direction: "horizontal" | "vertical";
  } | null>(null);
  const [wordStatus, setWordStatus] = useState<
    "idle" | "checking" | "valid" | "invalid"
  >("idle");
  const [placeStatus, setPlaceStatus] = useState<
    "idle" | "placing" | "success" | "error"
  >("idle");
  const [placeMessage, setPlaceMessage] = useState<string | null>(null);
  const [boardTiles, setBoardTiles] = useState<Tile[]>(tiles);
  const [inventory, setInventory] = useState<LetterEntry[]>(letters);
  const [score, setScore] = useState(totalScore);
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null);
  const dragMovedRef = useRef(false);
  const activePointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pointerDownTileRef = useRef<{ x: number; y: number } | null>(null);
  const pointerDownPosRef = useRef<{ x: number; y: number } | null>(null);
  const skipNextTileClickRef = useRef(false);
  const pinchRef = useRef<{
    startDistance: number;
    startScale: number;
    startOffset: { x: number; y: number };
    startCenter: { x: number; y: number };
  } | null>(null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showInventory, setShowInventory] = useState(false);
  const [leaderboard, setLeaderboard] = useState<
    Array<{ username: string; total_score: number }>
  >([]);
  const [leaderboardStatus, setLeaderboardStatus] = useState<
    "idle" | "loading" | "error"
  >("idle");
  const [showGifts, setShowGifts] = useState(false);
  const [gifts, setGifts] = useState<Array<Record<string, unknown>>>([]);
  const [giftStatus, setGiftStatus] = useState<"idle" | "loading" | "error">(
    "idle",
  );
  const [ledgerEntries, setLedgerEntries] = useState<
    Array<{
      letter: string;
      quantity: number;
      source: string;
      source_id: string | null;
      source_label: string | null;
      created_at: string;
    }>
  >([]);
  const [ledgerStatus, setLedgerStatus] = useState<"idle" | "loading" | "error">(
    "idle",
  );
  const [inventoryView, setInventoryView] = useState<"inventory" | "ledger">(
    "inventory",
  );
  const [lastBoardUpdate, setLastBoardUpdate] = useState<string | null>(null);
  const [highlightWordId, setHighlightWordId] = useState<number | null>(null);
  const [boardNotice, setBoardNotice] = useState<string | null>(null);
  const [hoveredTile, setHoveredTile] = useState<
    | { x: number; y: number; entries: Array<{ word: string; username: string }> }
    | null
  >(null);
  const tileInfoCache = useRef(new Map<string, Array<{ word: string; username: string }>>());
  const [hasCentered, setHasCentered] = useState(false);
  const lastLetterUpdateRef = useRef<string | null>(null);
  const lastInventoryTotalRef = useRef<number | null>(null);
  const skipNextBoardClickRef = useRef(false);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const previousHtmlOverflow = html.style.overflow;
    const previousBodyOverflow = body.style.overflow;
    const previousHtmlOverscroll = html.style.overscrollBehavior;
    const previousBodyOverscroll = body.style.overscrollBehavior;

    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    html.style.overscrollBehavior = "none";
    body.style.overscrollBehavior = "none";

    return () => {
      html.style.overflow = previousHtmlOverflow;
      body.style.overflow = previousBodyOverflow;
      html.style.overscrollBehavior = previousHtmlOverscroll;
      body.style.overscrollBehavior = previousBodyOverscroll;
    };
  }, []);

  const letterInventory = useMemo(() => {
    const map = new Map<string, number>();
    inventory.forEach((entry) => map.set(entry.letter, entry.quantity));
    return map;
  }, [inventory]);

  const boardTileMap = useMemo(() => {
    const map = new Map<string, string>();
    boardTiles.forEach((tile) => {
      map.set(`${tile.x},${tile.y}`, tile.letter);
    });
    return map;
  }, [boardTiles]);

  const boardTileLookup = useMemo(() => {
    const map = new Map<string, Tile>();
    boardTiles.forEach((tile) => {
      map.set(`${tile.x},${tile.y}`, tile);
    });
    return map;
  }, [boardTiles]);

  const placementDirection = selected
    ? directionMode === "straight"
      ? selected.direction
      : selected.direction === "horizontal"
        ? "vertical"
        : "horizontal"
    : "horizontal";

  const getPlacementDirection = (
    tile: Tile,
    mode: "perpendicular" | "straight",
  ) =>
    mode === "straight"
      ? tile.direction
      : tile.direction === "horizontal"
        ? "vertical"
        : "horizontal";

  const anchorIndexes = useMemo(() => {
    if (!selected) {
      return [] as number[];
    }
    return typedWord
      .split("")
      .map((letter, index) => (letter === selected.letter ? index : -1))
      .filter((index) => index >= 0);
  }, [selected, typedWord]);

  const anchorIndex =
    anchorIndexes.length > 0
      ? anchorIndexes[Math.min(anchorOccurrence, anchorIndexes.length - 1)]
      : typedWord.length;
  const hasAnchorInDraft = selected ? typedWord.includes(selected.letter) : false;

  const getPositionForIndex = (index: number, anchorOverride?: number) => {
    if (!selected) {
      return null;
    }
    const anchorValue = anchorOverride ?? anchorIndex;
    const startX =
      placementDirection === "horizontal" ? selected.x - anchorValue : selected.x;
    const startY =
      placementDirection === "vertical" ? selected.y - anchorValue : selected.y;
    return {
      x: placementDirection === "horizontal" ? startX + index : startX,
      y: placementDirection === "vertical" ? startY + index : startY,
    };
  };

  const draftUsage = useMemo(() => {
    const usage = new Map<string, number>();
    if (!selected) {
      return usage;
    }
    typedWord.split("").forEach((draftLetter, index) => {
      const position = getPositionForIndex(index);
      if (!position) {
        return;
      }
      const boardLetter = boardTileMap.get(`${position.x},${position.y}`);
      if (boardLetter) {
        return;
      }
      if (position.x === selected.x && position.y === selected.y) {
        return;
      }
      usage.set(draftLetter, (usage.get(draftLetter) ?? 0) + 1);
    });
    return usage;
  }, [boardTileMap, getPositionForIndex, selected, typedWord]);

  const canUseLetter = (letter: string) => {
    if (!selected) {
      return false;
    }
    const nextIndex = typedWord.length;
    const anchorForNext = hasAnchorInDraft
      ? anchorIndex
      : letter === selected.letter
        ? typedWord.length
        : typedWord.length + 1;
    const position = getPositionForIndex(nextIndex, anchorForNext);
    if (!position) {
      return false;
    }
    if (letter === selected.letter && position.x === selected.x && position.y === selected.y) {
      return true;
    }
    const boardLetter = boardTileMap.get(`${position.x},${position.y}`);
    if (boardLetter) {
      return boardLetter === letter;
    }
    const available = letterInventory.get(letter) ?? 0;
    const used = draftUsage.get(letter) ?? 0;
    return available > used;
  };

  const appendLetter = (letter: string) => {
    if (!selected) {
      return;
    }
    if (!canUseLetter(letter)) {
      return;
    }
    setTypedWord((value) => value + letter.toLowerCase());
  };

  useEffect(() => {
    if (anchorIndexes.length === 0) {
      setAnchorOccurrence(0);
      return;
    }
    if (anchorOccurrence >= anchorIndexes.length) {
      setAnchorOccurrence(0);
    }
  }, [anchorIndexes.length, anchorOccurrence]);

  useEffect(() => {
    if (!directionHint) {
      return;
    }
    const timer = window.setTimeout(() => {
      setDirectionHint(null);
    }, 900);
    return () => window.clearTimeout(timer);
  }, [directionHint]);

  useEffect(() => {
    if (!placeMessage) {
      return;
    }
    const timer = window.setTimeout(() => {
      setPlaceMessage(null);
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [placeMessage]);

  const computeCenterOffset = () => {
    if (!containerRef.current) {
      return null;
    }
    const { offsetWidth, offsetHeight } = containerRef.current;
    const seedWordId = boardTiles.reduce<number | null>((minId, tile) => {
      if (!tile.word_id) {
        return minId;
      }
      if (minId === null || tile.word_id < minId) {
        return tile.word_id;
      }
      return minId;
    }, null);
    const seedTiles = seedWordId
      ? boardTiles.filter((tile) => tile.word_id === seedWordId)
      : [];
    const centerX =
      seedTiles.length > 0
        ? seedTiles.reduce((sum, tile) => sum + tile.x, 0) / seedTiles.length
        : 0;
    const centerY =
      seedTiles.length > 0
        ? seedTiles.reduce((sum, tile) => sum + tile.y, 0) / seedTiles.length
        : 0;
    const boardHeight = Math.max(0, offsetHeight - KEYBOARD_ESTIMATE);
    return {
      x: offsetWidth / 2 - centerX * TILE_SIZE * scale,
      y: boardHeight / 2 - centerY * TILE_SIZE * scale,
    };
  };

  useEffect(() => {
    if (hasCentered) {
      return;
    }
    const nextOffset = computeCenterOffset();
    if (!nextOffset) {
      return;
    }
    setOffset(nextOffset);
    setHasCentered(true);
  }, [boardTiles, hasCentered, scale]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!selected) {
        return;
      }
      if (event.key === "Backspace") {
        setTypedWord((value) => value.slice(0, -1));
        return;
      }
      if (event.key === "Enter") {
        if (wordStatus === "valid" && typedWord.length > 0) {
          handlePlace();
        }
        return;
      }
      if (event.key === "Shift") {
        if (anchorIndexes.length > 1) {
          setAnchorOccurrence((value) => (value + 1) % anchorIndexes.length);
        }
        return;
      }
      if (!/^[a-zA-Z]$/.test(event.key)) {
        return;
      }
      const next = event.key.toLowerCase();
      appendLetter(next);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [anchorIndexes.length, boardTileMap, letterInventory, selected, typedWord, wordStatus]);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    dragMovedRef.current = false;
    pointerDownPosRef.current = { x: event.clientX, y: event.clientY };
    const target = event.target as HTMLElement | null;
    const tileButton = target?.closest("button[data-tile]") as HTMLButtonElement | null;
    if (tileButton) {
      const x = Number(tileButton.dataset.x ?? "");
      const y = Number(tileButton.dataset.y ?? "");
      if (Number.isFinite(x) && Number.isFinite(y)) {
        pointerDownTileRef.current = { x, y };
      }
    } else {
      pointerDownTileRef.current = null;
    }
    activePointersRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    if (activePointersRef.current.size === 1) {
      setDragging(true);
      lastPointerRef.current = { x: event.clientX, y: event.clientY };
      pinchRef.current = null;
      return;
    }
    if (activePointersRef.current.size === 2) {
      setDragging(false);
      lastPointerRef.current = null;
      if (!containerRef.current) {
        return;
      }
      const points = Array.from(activePointersRef.current.values());
      const dx = points[0].x - points[1].x;
      const dy = points[0].y - points[1].y;
      const rect = containerRef.current.getBoundingClientRect();
      const center = {
        x: (points[0].x + points[1].x) / 2 - rect.left,
        y: (points[0].y + points[1].y) / 2 - rect.top,
      };
      pinchRef.current = {
        startDistance: Math.hypot(dx, dy),
        startScale: scale,
        startOffset: offset,
        startCenter: center,
      };
    }
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    activePointersRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    if (pinchRef.current && activePointersRef.current.size >= 2) {
      if (!containerRef.current) {
        return;
      }
      const points = Array.from(activePointersRef.current.values());
      const dx = points[0].x - points[1].x;
      const dy = points[0].y - points[1].y;
      const distance = Math.hypot(dx, dy);
      const nextScale = Math.min(
        MAX_SCALE,
        Math.max(MIN_SCALE, (pinchRef.current.startScale * distance) / pinchRef.current.startDistance),
      );
      const rect = containerRef.current.getBoundingClientRect();
      const center = {
        x: (points[0].x + points[1].x) / 2 - rect.left,
        y: (points[0].y + points[1].y) / 2 - rect.top,
      };
      const world = {
        x: (pinchRef.current.startCenter.x - pinchRef.current.startOffset.x) / pinchRef.current.startScale,
        y: (pinchRef.current.startCenter.y - pinchRef.current.startOffset.y) / pinchRef.current.startScale,
      };
      setScale(nextScale);
      setOffset({
        x: center.x - world.x * nextScale,
        y: center.y - world.y * nextScale,
      });
      return;
    }
    if (!dragging) {
      return;
    }
    const last = lastPointerRef.current;
    if (!last) {
      lastPointerRef.current = { x: event.clientX, y: event.clientY };
      return;
    }
    const deltaX = event.clientX - last.x;
    const deltaY = event.clientY - last.y;
    if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) {
      dragMovedRef.current = true;
    }
    lastPointerRef.current = { x: event.clientX, y: event.clientY };
    setOffset((prev) => ({
      x: prev.x + deltaX,
      y: prev.y + deltaY,
    }));
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    activePointersRef.current.delete(event.pointerId);
    pinchRef.current = null;
    if (activePointersRef.current.size === 1) {
      const remaining = Array.from(activePointersRef.current.values())[0];
      setDragging(true);
      lastPointerRef.current = { x: remaining.x, y: remaining.y };
    } else {
      setDragging(false);
      lastPointerRef.current = null;
    }
    const pointerStart = pointerDownPosRef.current;
    const tapDistance = pointerStart
      ? Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y)
      : null;
    const isTap = tapDistance !== null && tapDistance <= 6;
    if ((isTap || !dragMovedRef.current) && pointerDownTileRef.current) {
      const { x, y } = pointerDownTileRef.current;
      const tile = boardTileLookup.get(`${x},${y}`);
      if (tile) {
        skipNextBoardClickRef.current = true;
        skipNextTileClickRef.current = true;
        handleSelectTile(tile, true);
      }
    }
    pointerDownTileRef.current = null;
    pointerDownPosRef.current = null;
    (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
  };

  const handlePointerCancel = (event: React.PointerEvent<HTMLDivElement>) => {
    activePointersRef.current.delete(event.pointerId);
    pinchRef.current = null;
    setDragging(false);
    lastPointerRef.current = null;
    pointerDownTileRef.current = null;
    pointerDownPosRef.current = null;
    (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
  };

  const resetDraftState = () => {
    setTypedWord("");
    setAnchorOccurrence(0);
    setWordStatus("idle");
    setPlaceStatus("idle");
    setPlaceMessage(null);
  };

  const clearSelection = () => {
    setSelected(null);
    setDirectionMode("perpendicular");
    resetDraftState();
    setHoveredTile(null);
  };

  const toggleDirection = (tile: Tile) => {
    const nextMode = directionMode === "perpendicular" ? "straight" : "perpendicular";
    const nextDirection = getPlacementDirection(tile, nextMode);
    resetDraftState();
    setDirectionMode(nextMode);
    setDirectionHint({ x: tile.x, y: tile.y, direction: nextDirection });
  };

  const handleBoardClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (skipNextBoardClickRef.current) {
      skipNextBoardClickRef.current = false;
      return;
    }
    if (dragMovedRef.current) {
      return;
    }
    const target = event.target as HTMLElement | null;
    if (target?.closest("button[data-tile]")) {
      return;
    }
    if (selected) {
      clearSelection();
    }
  };

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if (!containerRef.current) {
      return;
    }
    event.preventDefault();
    const rect = containerRef.current.getBoundingClientRect();
    const pointer = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
    const intensity = event.deltaY;
    if (intensity === 0) {
      return;
    }
    const nextScale = Math.min(
      MAX_SCALE,
      Math.max(MIN_SCALE, scale * (1 - intensity * 0.001)),
    );
    const world = {
      x: (pointer.x - offset.x) / scale,
      y: (pointer.y - offset.y) / scale,
    };
    setScale(nextScale);
    setOffset({
      x: pointer.x - world.x * nextScale,
      y: pointer.y - world.y * nextScale,
    });
  };

  const handleCenterBoard = () => {
    const nextOffset = computeCenterOffset();
    if (!nextOffset) {
      return;
    }
    setOffset(nextOffset);
  };

  const handleSelectTile = (tile: Tile, force = false) => {
    if (!force && dragMovedRef.current) {
      return;
    }
    if (selected && selected.x === tile.x && selected.y === tile.y) {
      toggleDirection(tile);
      return;
    }
    setSelected(tile);
    resetDraftState();
    setDirectionMode("perpendicular");
    setDirectionHint({
      x: tile.x,
      y: tile.y,
      direction: getPlacementDirection(tile, "perpendicular"),
    });
    fetchTileInfo(tile, true);
  };

  useEffect(() => {
    if (!showLeaderboard) {
      return;
    }
    setLeaderboardStatus("loading");
    fetch(`/api/board/leaderboard?board_id=${boardId}`)
      .then(async (response) => {
        const data = (await response.json()) as {
          players?: Array<{ username: string; total_score: number }>;
        };
        if (!response.ok) {
          throw new Error("Unable to load leaderboard.");
        }
        setLeaderboard(data.players ?? []);
        setLeaderboardStatus("idle");
      })
      .catch(() => {
        setLeaderboardStatus("error");
      });
  }, [boardId, showLeaderboard]);

  const loadGifts = async () => {
    if (!loggedIn) {
      return;
    }
    setGiftStatus("loading");
    try {
      const response = await fetch(`/api/gifts/available?board_id=${boardId}`);
      const data = (await response.json()) as { gifts?: Array<Record<string, unknown>> };
      if (!response.ok) {
        setGiftStatus("error");
        return;
      }
      setGifts(data.gifts ?? []);
      setGiftStatus("idle");
    } catch (error) {
      setGiftStatus("error");
    }
  };

  const loadLedger = async () => {
    if (!loggedIn) {
      return;
    }
    setLedgerStatus("loading");
    try {
      const response = await fetch(`/api/letters/ledger?board_id=${boardId}&limit=80`);
      const data = (await response.json()) as {
        entries?: Array<{
          letter: string;
          quantity: number;
          source: string;
          source_id?: string | null;
          source_label?: string | null;
          created_at: string;
        }>;
      };
      if (!response.ok) {
        setLedgerStatus("error");
        return;
      }
      const nextEntries = (data.entries ?? []).map((entry) => ({
        letter: entry.letter,
        quantity: entry.quantity,
        source: entry.source,
        source_id: entry.source_id ?? null,
        source_label: entry.source_label ?? null,
        created_at: entry.created_at,
      }));
      setLedgerEntries(nextEntries);
      setLedgerStatus("idle");
    } catch (error) {
      setLedgerStatus("error");
    }
  };

  useEffect(() => {
    if (!loggedIn) {
      return;
    }
    loadGifts();
  }, [boardId, loggedIn]);

  useEffect(() => {
    if (!showGifts) {
      return;
    }
    loadGifts();
  }, [boardId, showGifts]);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    const pollUpdate = async () => {
      try {
        const response = await fetch(`/api/board/updated?board_id=${boardId}`);
        if (!response.ok) {
          return;
        }
        const data = (await response.json()) as { updated_at?: string | null };
        const updatedAt = data.updated_at ?? null;
        if (!updatedAt || updatedAt === lastBoardUpdate) {
          if (!lastBoardUpdate && updatedAt) {
            setLastBoardUpdate(updatedAt);
          }
          return;
        }

        setLastBoardUpdate(updatedAt);
        const boardResponse = await fetch(`/api/board/state?board_id=${boardId}`);
        if (boardResponse.ok) {
          const boardData = (await boardResponse.json()) as {
            tiles?: Array<Record<string, unknown>>;
            latest_word_id?: number | null;
          };
          const nextTiles: Tile[] = (boardData.tiles ?? []).map((row) => ({
            x: Number(row.x ?? 0),
            y: Number(row.y ?? 0),
            letter: String(row.letter ?? ""),
            direction: row.direction === "vertical" ? "vertical" : "horizontal",
            word_id: Number(row.word_id ?? 0),
          }));
          setBoardTiles(nextTiles);
          tileInfoCache.current.clear();
          if (boardData.latest_word_id) {
            setHighlightWordId(boardData.latest_word_id);
            window.setTimeout(() => setHighlightWordId(null), 3000);
          }
        }

        if (typedWord.length > 0) {
          setTypedWord("");
          setSelected(null);
          setWordStatus("idle");
          setPlaceStatus("idle");
          setBoardNotice("Board updated. Draft cleared.");
          window.setTimeout(() => setBoardNotice(null), 3000);
        }
      } catch (error) {
        return;
      }
    };

    pollUpdate();
    timer = setInterval(pollUpdate, 4000);
    return () => {
      if (timer) {
        clearInterval(timer);
      }
    };
  }, [boardId, lastBoardUpdate, typedWord.length]);

  const fetchTileInfo = async (tile: Tile, force?: boolean) => {
    const key = `${tile.x},${tile.y}`;
    const cached = tileInfoCache.current.get(key);
    if (cached) {
      setHoveredTile({ x: tile.x, y: tile.y, entries: cached });
      return;
    }
    try {
      const response = await fetch(
        `/api/board/tile?board_id=${boardId}&x=${tile.x}&y=${tile.y}`,
      );
      if (!response.ok) {
        return;
      }
      const data = (await response.json()) as {
        entries?: Array<{ word: string; username: string }>;
      };
      const entries = (data.entries ?? []).map((entry) => ({
        word: String((entry as Record<string, unknown>).word ?? ""),
        username: String((entry as Record<string, unknown>).username ?? ""),
      }));
      tileInfoCache.current.set(key, entries);
      setHoveredTile({ x: tile.x, y: tile.y, entries });
    } catch (error) {
      return;
    }
  };

  const handleHoverTile = async (tile: Tile) => {
    if (window.matchMedia("(hover: none)").matches) {
      return;
    }
    await fetchTileInfo(tile);
  };

  const handleLeaveTile = () => {
    setHoveredTile(null);
  };

  useEffect(() => {
    if (!loggedIn) {
      return;
    }
    const refreshInventory = async () => {
      try {
        const response = await fetch(`/api/letters?board_id=${boardId}`);
        if (!response.ok) {
          return;
        }
        const data = (await response.json()) as {
          letters?: LetterEntry[];
          user?: { total_score?: number };
        };
        setInventory(data.letters ?? []);
        if (typeof data.user?.total_score === "number") {
          setScore(data.user.total_score);
        }
        const currentTotal = (data.letters ?? []).reduce(
          (sum, entry) => sum + (entry.quantity ?? 0),
          0,
        );
        if (lastInventoryTotalRef.current === null) {
          if (currentTotal > 0) {
            setBoardNotice("Letters ready to use.");
            window.setTimeout(() => setBoardNotice(null), 3000);
          }
        } else if (currentTotal > lastInventoryTotalRef.current) {
          setBoardNotice("New letters received.");
          window.setTimeout(() => setBoardNotice(null), 3000);
        }
        lastInventoryTotalRef.current = currentTotal;
        const newestUpdate = (data.letters ?? []).reduce<string | null>(
          (latest, entry) => {
            if (!entry.updated_at) {
              return latest;
            }
            if (!latest || entry.updated_at > latest) {
              return entry.updated_at;
            }
            return latest;
          },
          null,
        );
        if (newestUpdate && lastLetterUpdateRef.current) {
          if (newestUpdate > lastLetterUpdateRef.current) {
            setBoardNotice("New letters received.");
            window.setTimeout(() => setBoardNotice(null), 3000);
          }
        }
        if (newestUpdate) {
          lastLetterUpdateRef.current = newestUpdate;
        }
      } catch (error) {
        return;
      }
    };

    if (showInventory) {
      refreshInventory();
      if (inventoryView === "ledger") {
        loadLedger();
      }
      return;
    }

    refreshInventory();
  }, [boardId, loggedIn, showInventory, inventoryView]);

  const ghostTiles = useMemo(() => {
    if (!selected || typedWord.length === 0) {
      return [] as Tile[];
    }
    return typedWord.split("").map((letter, index) => ({
      letter,
      direction: placementDirection,
      x:
        placementDirection === "horizontal"
          ? selected.x + index - anchorIndex
          : selected.x,
      y:
        placementDirection === "vertical"
          ? selected.y + index - anchorIndex
          : selected.y,
    }));
  }, [anchorIndex, placementDirection, selected, typedWord]);

  useEffect(() => {
    if (!selected || typedWord.length < 2) {
      setWordStatus("idle");
      return;
    }
    const hasAnchorLetter = typedWord.includes(selected.letter);
    if (!hasAnchorLetter) {
      setWordStatus("idle");
      return;
    }
    setWordStatus("checking");
    const handle = window.setTimeout(() => {
      fetch(`/api/words/validate?word=${encodeURIComponent(typedWord)}`)
        .then(async (response) => {
          const data = (await response.json()) as { valid?: boolean };
          if (!response.ok) {
            setWordStatus("invalid");
            return;
          }
          setWordStatus(data.valid ? "valid" : "invalid");
        })
        .catch(() => setWordStatus("invalid"));
    }, 400);
    return () => window.clearTimeout(handle);
  }, [selected, typedWord]);

  const handlePlace = async () => {
    if (!selected || !typedWord || !loggedIn) {
      return;
    }
    if (!typedWord.includes(selected.letter)) {
      setPlaceStatus("error");
      setPlaceMessage("Word must include the anchor letter.");
      return;
    }
    const activeAnchorIndex =
      anchorIndexes.length > 0
        ? anchorIndexes[Math.min(anchorOccurrence, anchorIndexes.length - 1)]
        : null;
    if (activeAnchorIndex === null) {
      setPlaceStatus("error");
      setPlaceMessage("Anchor letter missing.");
      return;
    }
    if (wordStatus === "invalid" || wordStatus === "checking") {
      return;
    }

    setPlaceStatus("placing");
    setPlaceMessage(null);
    try {
      const response = await fetch("/api/board/place", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          board_id: boardId,
          word: typedWord,
          anchor_x: selected.x,
          anchor_y: selected.y,
          anchor_index: activeAnchorIndex,
          direction: placementDirection,
        }),
      });
      const data = (await response.json()) as { error?: string; score?: number };
      if (!response.ok) {
        setPlaceStatus("error");
        setPlaceMessage(data?.error || "Unable to place word.");
        return;
      }
      setPlaceStatus("success");
      setPlaceMessage("Word placed.");
      const scoreDelta = typeof data.score === "number" ? data.score : 0;
      if (scoreDelta > 0) {
        setScore((value) => value + scoreDelta);
      }
      setTypedWord("");
      setAnchorOccurrence(0);
      setWordStatus("idle");

      const [lettersResponse, boardResponse] = await Promise.all([
        fetch(`/api/letters?board_id=${boardId}`),
        fetch(`/api/board/state?board_id=${boardId}`),
      ]);
      if (lettersResponse.ok) {
        const lettersData = (await lettersResponse.json()) as {
          letters?: LetterEntry[];
          user?: { total_score?: number };
        };
        setInventory(lettersData.letters ?? []);
        if (typeof lettersData.user?.total_score === "number") {
          setScore(lettersData.user.total_score);
        }
      }
      loadGifts();
      if (boardResponse.ok) {
        const boardData = (await boardResponse.json()) as {
          tiles?: Array<Record<string, unknown>>;
          latest_word_id?: number | null;
        };
        const nextTiles: Tile[] = (boardData.tiles ?? []).map((row) => ({
          x: Number(row.x ?? 0),
          y: Number(row.y ?? 0),
          letter: String(row.letter ?? ""),
          direction:
            row.direction === "vertical" ? "vertical" : "horizontal",
          word_id: Number(row.word_id ?? 0),
        }));
        setBoardTiles(nextTiles);
        tileInfoCache.current.clear();
        if (boardData.latest_word_id) {
          setHighlightWordId(boardData.latest_word_id);
          window.setTimeout(() => setHighlightWordId(null), 3000);
        }
      }
    } catch (error) {
      setPlaceStatus("error");
      setPlaceMessage(
        error instanceof Error ? error.message : "Unable to place word.",
      );
    }
  };

  const handleClaimGift = async (giftId: number) => {
    try {
      const response = await fetch("/api/gifts/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gift_id: giftId, board_id: boardId }),
      });
      if (!response.ok) {
        return;
      }
      await loadGifts();
      const lettersResponse = await fetch(`/api/letters?board_id=${boardId}`);
      if (lettersResponse.ok) {
        const lettersData = (await lettersResponse.json()) as {
          letters?: LetterEntry[];
          user?: { total_score?: number };
        };
        setInventory(lettersData.letters ?? []);
        if (typeof lettersData.user?.total_score === "number") {
          setScore(lettersData.user.total_score);
        }
      }
    } catch (error) {
      return;
    }
  };

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#efe7dc]">
      <div
        ref={containerRef}
        className="absolute inset-0 cursor-grab active:cursor-grabbing touch-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onWheel={handleWheel}
        onClick={handleBoardClick}
      >
        <div
          className="board-plane absolute rounded-[48px] border border-black/10"
          style={{
            width: PLANE_SIZE,
            height: PLANE_SIZE,
            transform: `translate(${offset.x - PLANE_SIZE / 2}px, ${offset.y - PLANE_SIZE / 2
              }px) scale(${scale})`,
            transformOrigin: "center center",
            "--board-grid-size": `${TILE_SIZE}px`,
          } as React.CSSProperties}
        >
          {directionHint ? (
            <div
              className={`direction-hint pointer-events-none absolute z-30 flex h-8 w-8 items-center justify-center text-[#d76f4b] ${directionHint.direction === "horizontal"
                ? "direction-hint-horizontal"
                : "direction-hint-vertical"
                }`}
              style={{
                left:
                  PLANE_SIZE / 2 +
                  directionHint.x * TILE_SIZE +
                  (directionHint.direction === "horizontal" ? TILE_SIZE : TILE_SIZE / 2),
                top:
                  PLANE_SIZE / 2 +
                  directionHint.y * TILE_SIZE +
                  (directionHint.direction === "vertical" ? TILE_SIZE : TILE_SIZE / 2),
              }}
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 48 48"
                className="h-7 w-7"
                style={{
                  transform:
                    directionHint.direction === "vertical" ? "rotate(90deg)" : "none",
                }}
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M8 24h28" />
                <path d="M30 16l8 8-8 8" />
              </svg>
            </div>
          ) : null}
          {ghostTiles.map((tile, index) => (
            <div
              key={`ghost-${index}`}
              className="absolute flex h-12 w-12 items-center justify-center rounded-2xl border border-dashed border-black/30 bg-white/40 text-xs font-semibold uppercase text-[#6b4b3d]"
              style={{
                left: PLANE_SIZE / 2 + tile.x * TILE_SIZE,
                top: PLANE_SIZE / 2 + tile.y * TILE_SIZE,
              }}
            >
              {tile.letter}
            </div>
          ))}
          {boardTiles.map((tile) => (
            <button
              key={`${tile.x}-${tile.y}`}
              type="button"
              onClick={() => {
                if (skipNextTileClickRef.current) {
                  skipNextTileClickRef.current = false;
                  return;
                }
                handleSelectTile(tile);
              }}
              onMouseEnter={() => handleHoverTile(tile)}
              onMouseLeave={handleLeaveTile}
              data-tile
              data-x={tile.x}
              data-y={tile.y}
              className={`absolute flex h-12 w-12 items-center justify-center rounded-2xl border text-base font-semibold uppercase transition ${selected?.x === tile.x && selected?.y === tile.y
                ? "border-[#d76f4b] bg-[#fff1e7] text-[#b45231]"
                : highlightWordId && tile.word_id === highlightWordId
                  ? "border-[#6fd3a5] bg-[#e7fff2] text-[#2f6b4f]"
                  : "border-black/10 bg-white text-[#241c15]"
                }`}
              style={{
                left: PLANE_SIZE / 2 + tile.x * TILE_SIZE,
                top: PLANE_SIZE / 2 + tile.y * TILE_SIZE,
              }}
            >
              {tile.letter}
              <span className="pointer-events-none absolute right-1 top-1 text-[10px] font-semibold text-[#8a7466]">
                {SCRABBLE_SCORES[tile.letter] ?? 1}
              </span>
            </button>
          ))}
          {hoveredTile ? (
            <div
              className="absolute rounded-2xl border border-black/10 bg-white/90 px-3 py-2 text-[10px] text-[#5a4d43] shadow-lg shadow-black/10"
              style={{
                left: PLANE_SIZE / 2 + hoveredTile.x * TILE_SIZE + 56,
                top: PLANE_SIZE / 2 + hoveredTile.y * TILE_SIZE - 8,
              }}
            >
              {hoveredTile.entries.length === 0 ? (
                <div>No data</div>
              ) : (
                hoveredTile.entries.map((entry, index) => (
                  <div key={`${entry.word}-${entry.username}-${index}`}>
                    {entry.word} · {entry.username}
                  </div>
                ))
              )}
            </div>
          ) : null}
        </div>
      </div>

      {!selected ? (
        <div className="pointer-events-none absolute inset-x-0 top-6 flex justify-center">
          <div className="pointer-events-auto rounded-full border border-black/10 bg-white/80 px-6 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-[#6b4b3d] shadow-lg shadow-black/5">
            Select a tile to start
          </div>
        </div>
      ) : null}
      {boardNotice ? (
        <div className="pointer-events-none absolute inset-x-0 top-16 flex justify-center">
          <div className="pointer-events-auto rounded-full border border-[#6fd3a5]/60 bg-[#e7fff2] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#2f6b4f] shadow-lg shadow-black/5">
            {boardNotice}
          </div>
        </div>
      ) : null}
      {placeMessage ? (
        <div className="pointer-events-none absolute inset-x-0 top-24 flex justify-center">
          <div
            className={`pointer-events-auto rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] shadow-lg shadow-black/5 ${placeStatus === "error"
              ? "border-[#d76f4b]/60 bg-[#fff1e7] text-[#b45231]"
              : "border-[#6fd3a5]/60 bg-[#e7fff2] text-[#2f6b4f]"
              }`}
          >
            {placeMessage}
          </div>
        </div>
      ) : null}

      <div className="pointer-events-none absolute left-4 top-20 flex flex-col items-start gap-3 sm:left-6 sm:top-6">
        <a
          href="/boards"
          className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-2xl border border-black/10 bg-white/80 text-[#6b4b3d] shadow-lg shadow-black/5"
          aria-label="Home"
          title="Home"
        >
          <span className="sr-only">Home</span>
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 10.5L12 3l9 7.5" />
            <path d="M5 10.5V21h14V10.5" />
            <path d="M9 21v-6h6v6" />
          </svg>
        </a>
        {loggedIn ? (
          <button
            type="button"
            onClick={() => setShowGifts((value) => !value)}
            className="pointer-events-auto relative flex h-10 w-10 items-center justify-center rounded-2xl border border-black/10 bg-white/80 text-[#6b4b3d] shadow-lg shadow-black/5"
            aria-label="Gifts"
            title="Gifts"
          >
            <span className="sr-only">Gifts</span>
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 9h18v4H3z" />
              <path d="M3 13h18v8H3z" />
              <path d="M12 9v12" />
              <path d="M8.5 5.5c0-1.2 1-2.5 2.5-2.5 1.5 0 2.5 1.3 2.5 2.5S12.5 8 11 8c-1.5 0-2.5-1.3-2.5-2.5Z" />
              <path d="M12.5 5.5c0-1.2 1-2.5 2.5-2.5 1.5 0 2.5 1.3 2.5 2.5S16.5 8 15 8c-1.5 0-2.5-1.3-2.5-2.5Z" />
            </svg>
            {gifts.length > 0 ? (
              <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#d76f4b] text-[10px] font-semibold text-white">
                {gifts.length}
              </span>
            ) : null}
          </button>
        ) : null}
      </div>

      <div className="pointer-events-none absolute right-4 top-20 flex flex-col items-end gap-3 sm:right-6 sm:top-6">
        <button
          type="button"
          onClick={() => setShowLeaderboard((value) => !value)}
          className="pointer-events-auto rounded-2xl border border-black/10 bg-white/80 px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#6b4b3d] shadow-lg shadow-black/5"
        >
          Score: {score}
        </button>
        <button
          type="button"
          onClick={handleCenterBoard}
          className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-2xl border border-black/10 bg-white/80 text-[#6b4b3d] shadow-lg shadow-black/5"
          aria-label="Center board"
          title="Center board"
        >
          <span className="sr-only">Center board</span>
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="6.5" />
            <circle cx="12" cy="12" r="2" />
            <path d="M12 3v3" />
            <path d="M12 18v3" />
            <path d="M3 12h3" />
            <path d="M18 12h3" />
          </svg>
        </button>
        {selected ? (
          <button
            type="button"
            onClick={() => toggleDirection(selected)}
            className="pointer-events-auto rounded-2xl border border-black/10 bg-white/80 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#6b4b3d] shadow-lg shadow-black/5"
          >
            {directionMode === "perpendicular" ? "Cross" : "Straight"}
          </button>
        ) : null}
        {selected && anchorIndexes.length > 1 ? (
          <button
            type="button"
            onClick={() =>
              setAnchorOccurrence((value) => (value + 1) % anchorIndexes.length)
            }
            className="pointer-events-auto rounded-2xl border border-black/10 bg-white/80 px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#6b4b3d] shadow-lg shadow-black/5"
          >
            Shift anchor
          </button>
        ) : null}
      </div>

      {showLeaderboard ? (
        <div className="pointer-events-none absolute right-6 top-24 w-64">
          <div className="pointer-events-auto rounded-3xl border border-black/10 bg-white/90 p-4 text-xs text-[#5a4d43] shadow-2xl shadow-black/10">
            <div className="flex items-center justify-between font-semibold uppercase tracking-[0.2em] text-[#6b4b3d]">
              <span>Leaderboard</span>
              <button
                type="button"
                onClick={() => setShowLeaderboard(false)}
                className="text-[10px] text-[#a38b7a]"
              >
                Close
              </button>
            </div>
            <div className="mt-3 space-y-2">
              {leaderboardStatus === "loading" ? (
                <div>Loading...</div>
              ) : null}
              {leaderboardStatus === "error" ? (
                <div>Unable to load scores.</div>
              ) : null}
              {leaderboardStatus === "idle" && leaderboard.length === 0 ? (
                <div>No scores yet.</div>
              ) : null}
              {leaderboard.map((player, index) => (
                <div
                  key={`${player.username}-${index}`}
                  className="flex items-center justify-between rounded-2xl border border-black/5 bg-[#fff7ef] px-3 py-2"
                >
                  <span>{player.username}</span>
                  <span className="font-semibold text-[#241c15]">
                    {player.total_score}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {showGifts ? (
        <div className="pointer-events-none absolute right-6 top-24 w-72">
          <div className="pointer-events-auto rounded-3xl border border-black/10 bg-white/90 p-4 text-xs text-[#5a4d43] shadow-2xl shadow-black/10">
            <div className="flex items-center justify-between font-semibold uppercase tracking-[0.2em] text-[#6b4b3d]">
              <span>Gifts</span>
              <button
                type="button"
                onClick={() => setShowGifts(false)}
                className="text-[10px] text-[#a38b7a]"
              >
                Close
              </button>
            </div>
            <div className="mt-3 space-y-2">
              {giftStatus === "loading" ? <div>Loading gifts...</div> : null}
              {giftStatus === "error" ? <div>Unable to load gifts.</div> : null}
              {giftStatus === "idle" && gifts.length === 0 ? (
                <div>No gifts available.</div>
              ) : null}
              {gifts.map((gift) => {
                let lettersPreview = "";
                try {
                  const parsed = JSON.parse(String(gift.letters_json ?? "[]"));
                  if (Array.isArray(parsed)) {
                    lettersPreview = parsed
                      .map((entry) => `${entry.letter}x${entry.quantity}`)
                      .join(", ");
                  }
                } catch (error) {
                  lettersPreview = "";
                }
                return (
                  <div
                    key={String(gift.id)}
                    className="rounded-2xl border border-black/5 bg-[#fff7ef] px-3 py-3"
                  >
                    <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.2em] text-[#6b4b3d]">
                      <span>{String(gift.title ?? "Gift")}</span>
                      <button
                        type="button"
                        onClick={() => handleClaimGift(Number(gift.id))}
                        className="rounded-full bg-[#d76f4b] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-white"
                      >
                        Claim
                      </button>
                    </div>
                    {lettersPreview ? (
                      <div className="mt-2 text-[11px] text-[#5a4d43]">
                        {lettersPreview}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      <div
        className="pointer-events-none fixed left-1/2 w-[min(720px,92vw)] -translate-x-1/2"
        style={{ bottom: "max(16px, env(safe-area-inset-bottom))" }}
      >
        <div className="pointer-events-auto mb-3 flex min-h-[20px] flex-wrap items-center justify-between gap-3 text-xs text-[#5a4d43]">
          <span>
            {selected && typedWord.length > 0
              ? `Draft: ${typedWord.toUpperCase()}`
              : ""}
          </span>
          {selected ? (
            <span className="uppercase tracking-[0.2em] text-[#6b4b3d]">
              {wordStatus === "checking"
                ? "Checking..."
                : wordStatus === "valid"
                  ? "Valid"
                  : wordStatus === "invalid"
                    ? "Not a word"
                    : ""}
            </span>
          ) : null}
        </div>
        <div className="pointer-events-auto rounded-3xl border border-black/10 bg-white/90 p-4 shadow-2xl shadow-black/10">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#6b4b3d]">
            {loggedIn ? "" : "Log in to play"}
          </div>
          <div className="mt-3 space-y-2">
            {KEY_ROWS.map((row) => (
              <div key={row} className="flex justify-center gap-1">
                {row.split("").map((letter) => {
                  const isAnchorLetter = selected?.letter === letter;
                  const availableCount = letterInventory.get(letter) ?? 0;
                  const isEnabled = selected
                    ? loggedIn && canUseLetter(letter)
                    : loggedIn && availableCount > 0;
                  const disabled = !isEnabled && !isAnchorLetter;
                  const letterScore = SCRABBLE_SCORES[letter] ?? 1;
                  return (
                    <button
                      key={letter}
                      type="button"
                      disabled={disabled}
                      onClick={() => appendLetter(letter)}
                      className={`relative flex h-10 w-10 items-center justify-center rounded-xl text-sm font-semibold uppercase transition ${disabled
                        ? "border border-black/5 bg-black/5 text-[#a38b7a]"
                        : isAnchorLetter
                          ? "border border-[#d76f4b] bg-[#fff1e7] text-[#b45231]"
                          : "border border-black/10 bg-white text-[#241c15] hover:border-[#d76f4b]"
                        }`}
                    >
                      {letter}
                      {availableCount > 0 ? (
                        <span
                          className="pointer-events-none absolute flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#d76f4b]/70 px-1 text-[9px] font-semibold text-[#fff8f1]"
                          style={{ left: -4, top: -4 }}
                        >
                          {availableCount}
                        </span>
                      ) : null}
                      <span className="pointer-events-none absolute right-1 top-1 text-[9px] font-semibold text-[#8a7466]">
                        {letterScore}
                      </span>
                    </button>
                  );
                })}
                {row === KEY_ROWS[KEY_ROWS.length - 1] ? (
                  <button
                    type="button"
                    onClick={() => setTypedWord((value) => value.slice(0, -1))}
                    className="relative flex h-10 w-12 items-center justify-center rounded-xl border border-black/10 bg-white text-[#241c15] transition hover:border-[#d76f4b]"
                    aria-label="Backspace"
                  >
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M21 5H9l-6 7 6 7h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Z" />
                      <path d="M14.5 9.5 10 14" />
                      <path d="M10 9.5 14.5 14" />
                    </svg>
                  </button>
                ) : null}
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setShowInventory((value) => !value)}
              className="inline-flex h-10 items-center justify-center rounded-full border border-black/10 bg-white px-4 text-xs font-semibold uppercase tracking-[0.2em] text-[#6b4b3d] shadow-sm shadow-black/5"
            >
              {showInventory ? "Hide inventory" : "Inventory"}
            </button>
            {selected ? (
              <button
                type="button"
                disabled={
                  !loggedIn ||
                  !typedWord ||
                  wordStatus !== "valid" ||
                  placeStatus === "placing"
                }
                onClick={handlePlace}
                className="inline-flex h-10 items-center justify-center rounded-full bg-[#d76f4b] px-5 text-xs font-semibold uppercase tracking-[0.2em] text-white shadow-lg shadow-orange-200/70 transition hover:bg-[#b45231] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {placeStatus === "placing" ? "Placing..." : "Place word"}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {showInventory ? (
        <div className="pointer-events-none fixed inset-0 flex items-center justify-center px-4">
          <div className="pointer-events-auto w-[min(720px,92vw)] rounded-3xl border border-black/10 bg-white/95 p-4 text-xs text-[#5a4d43] shadow-2xl shadow-black/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#6b4b3d]">
                <button
                  type="button"
                  onClick={() => setInventoryView("inventory")}
                  className={`rounded-full px-3 py-1 transition ${inventoryView === "inventory"
                    ? "bg-[#fff1e7] text-[#b45231]"
                    : "text-[#6b4b3d]"
                    }`}
                >
                  Inventory
                </button>
                <button
                  type="button"
                  onClick={() => setInventoryView("ledger")}
                  className={`rounded-full px-3 py-1 transition ${inventoryView === "ledger"
                    ? "bg-[#fff1e7] text-[#b45231]"
                    : "text-[#6b4b3d]"
                    }`}
                >
                  Ledger
                </button>
              </div>
              <button
                type="button"
                onClick={() => setShowInventory(false)}
                className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#a38b7a]"
              >
                Close
              </button>
            </div>
            {inventoryView === "inventory" ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {inventory.filter((entry) => entry.quantity > 0).length === 0 ? (
                  <div>No letters yet.</div>
                ) : (
                  inventory
                    .filter((entry) => entry.quantity > 0)
                    .map((entry) => (
                      <div
                        key={entry.letter}
                        className="flex h-9 items-center gap-2 rounded-2xl border border-black/5 bg-[#fff7ef] px-3 text-xs font-semibold uppercase text-[#241c15]"
                      >
                        <span>{entry.letter}</span>
                        <span className="text-[10px] text-[#6b4b3d]">x{entry.quantity}</span>
                      </div>
                    ))
                )}
              </div>
            ) : (
              <div className="mt-3 max-h-[320px] space-y-2 overflow-auto pr-1">
                {ledgerStatus === "loading" ? <div>Loading ledger...</div> : null}
                {ledgerStatus === "error" ? <div>Unable to load ledger.</div> : null}
                {ledgerStatus === "idle" && ledgerEntries.length === 0 ? (
                  <div>No ledger entries yet.</div>
                ) : null}
                {ledgerEntries.map((entry, index) => (
                  <div
                    key={`${entry.created_at}-${entry.letter}-${index}`}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-black/5 bg-[#fff7ef] px-3 py-2"
                  >
                    <div>
                      <div className="text-[11px] font-semibold uppercase text-[#241c15]">
                        {entry.letter} {entry.quantity >= 0 ? "+" : ""}{entry.quantity}
                      </div>
                      <div className="text-[10px] text-[#6b4b3d]">
                        {entry.source_label || entry.source}
                      </div>
                    </div>
                    <div className="text-[10px] text-[#a38b7a]">
                      {entry.created_at ? new Date(entry.created_at).toLocaleString() : ""}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
