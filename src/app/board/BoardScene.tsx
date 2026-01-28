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
};

type BoardSceneProps = {
  tiles: Tile[];
  letters: LetterEntry[];
  loggedIn: boolean;
  totalScore: number;
};

const TILE_SIZE = 56;
const PLANE_SIZE = 4200;
const KEYBOARD_ESTIMATE = 260;

const KEY_ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];

export default function BoardScene({
  tiles,
  letters,
  loggedIn,
  totalScore,
}: BoardSceneProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [selected, setSelected] = useState<Tile | null>(null);
  const [typedWord, setTypedWord] = useState("");
  const [anchorOccurrence, setAnchorOccurrence] = useState(0);
  const [directionMode, setDirectionMode] = useState<"perpendicular" | "straight">(
    "perpendicular",
  );
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

  const placementDirection = selected
    ? directionMode === "straight"
      ? selected.direction
      : selected.direction === "horizontal"
        ? "vertical"
        : "horizontal"
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
      x: offsetWidth / 2 - centerX * TILE_SIZE,
      y: boardHeight / 2 - centerY * TILE_SIZE,
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
  }, [boardTiles, hasCentered]);

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
    const target = event.target as HTMLElement | null;
    if (target?.closest("button[data-tile]")) {
      return;
    }
    setDragging(true);
    lastPointerRef.current = { x: event.clientX, y: event.clientY };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
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
    lastPointerRef.current = { x: event.clientX, y: event.clientY };
    setOffset((prev) => ({
      x: prev.x + deltaX,
      y: prev.y + deltaY,
    }));
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    setDragging(false);
    lastPointerRef.current = null;
    (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
  };

  const handlePointerCancel = (event: React.PointerEvent<HTMLDivElement>) => {
    setDragging(false);
    lastPointerRef.current = null;
    (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
  };

  const handleCenterBoard = () => {
    const nextOffset = computeCenterOffset();
    if (!nextOffset) {
      return;
    }
    setOffset(nextOffset);
  };

  const handleSelectTile = (tile: Tile) => {
    setSelected(tile);
    setTypedWord("");
    setAnchorOccurrence(0);
    setDirectionMode("perpendicular");
    setWordStatus("idle");
    setPlaceStatus("idle");
    setPlaceMessage(null);
    fetchTileInfo(tile, true);
  };

  useEffect(() => {
    if (!showLeaderboard) {
      return;
    }
    setLeaderboardStatus("loading");
    fetch("/api/board/leaderboard")
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
  }, [showLeaderboard]);

  const loadGifts = async () => {
    if (!loggedIn) {
      return;
    }
    setGiftStatus("loading");
    try {
      const response = await fetch("/api/gifts/available");
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

  useEffect(() => {
    if (!loggedIn) {
      return;
    }
    loadGifts();
  }, [loggedIn]);

  useEffect(() => {
    if (!showGifts) {
      return;
    }
    loadGifts();
  }, [showGifts]);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    const pollUpdate = async () => {
      try {
        const response = await fetch("/api/board/updated");
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
        const boardResponse = await fetch("/api/board/state");
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
  }, [lastBoardUpdate, typedWord.length]);

  const fetchTileInfo = async (tile: Tile, force?: boolean) => {
    const key = `${tile.x},${tile.y}`;
    const cached = tileInfoCache.current.get(key);
    if (cached) {
      setHoveredTile({ x: tile.x, y: tile.y, entries: cached });
      return;
    }
    try {
      const response = await fetch(`/api/board/tile?x=${tile.x}&y=${tile.y}`);
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
        const response = await fetch("/api/letters");
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
      return;
    }

    refreshInventory();
  }, [loggedIn, showInventory]);

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
        fetch("/api/letters"),
        fetch("/api/board/state"),
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
        body: JSON.stringify({ gift_id: giftId }),
      });
      if (!response.ok) {
        return;
      }
      await loadGifts();
      const lettersResponse = await fetch("/api/letters");
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
      >
        <div
          className="absolute rounded-[48px] border border-black/10 bg-[radial-gradient(circle_at_top,#fff8ee_0%,#f3eadd_55%,#e9dfd1_100%)]"
          style={{
            width: PLANE_SIZE,
            height: PLANE_SIZE,
            transform: `translate(${offset.x - PLANE_SIZE / 2}px, ${
              offset.y - PLANE_SIZE / 2
            }px)`,
            backgroundSize: `${TILE_SIZE}px ${TILE_SIZE}px`,
            backgroundImage:
              "linear-gradient(to right, rgba(0,0,0,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.05) 1px, transparent 1px)",
          }}
        >
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
              onClick={() => handleSelectTile(tile)}
              onMouseEnter={() => handleHoverTile(tile)}
              onMouseLeave={handleLeaveTile}
              data-tile
              className={`absolute flex h-12 w-12 items-center justify-center rounded-2xl border text-base font-semibold uppercase transition ${
                selected?.x === tile.x && selected?.y === tile.y
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

      <div className="pointer-events-none absolute inset-x-0 top-6 flex justify-center">
        <div className="pointer-events-auto rounded-full border border-black/10 bg-white/80 px-6 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-[#6b4b3d] shadow-lg shadow-black/5">
          {selected
            ? `Anchor ${selected.letter.toUpperCase()} · ${placementDirection}`
            : "Select a tile to start"}
        </div>
      </div>
      {boardNotice ? (
        <div className="pointer-events-none absolute inset-x-0 top-16 flex justify-center">
          <div className="pointer-events-auto rounded-full border border-[#6fd3a5]/60 bg-[#e7fff2] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#2f6b4f] shadow-lg shadow-black/5">
            {boardNotice}
          </div>
        </div>
      ) : null}

      <div className="pointer-events-none absolute left-4 top-20 flex flex-col items-start gap-3 sm:left-6 sm:top-6">
        <a
          href="/"
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
            onClick={() =>
              setDirectionMode((value) => {
                setTypedWord("");
                setAnchorOccurrence(0);
                setWordStatus("idle");
                setPlaceStatus("idle");
                setPlaceMessage(null);
                return value === "perpendicular" ? "straight" : "perpendicular";
              })
            }
            className="pointer-events-auto rounded-2xl border border-black/10 bg-white/80 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#6b4b3d] shadow-lg shadow-black/5"
          >
            {directionMode === "perpendicular" ? "Straight" : "Cross"}
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
                  const isEnabled = loggedIn && selected && canUseLetter(letter);
                  const disabled = !isEnabled && !isAnchorLetter;
                  const letterScore = SCRABBLE_SCORES[letter] ?? 1;
                  return (
                    <button
                      key={letter}
                      type="button"
                      disabled={disabled}
                      onClick={() => appendLetter(letter)}
                      className={`relative flex h-10 w-10 items-center justify-center rounded-xl text-sm font-semibold uppercase transition ${
                        disabled
                          ? "border border-black/5 bg-black/5 text-[#a38b7a]"
                          : isAnchorLetter
                            ? "border border-[#d76f4b] bg-[#fff1e7] text-[#b45231]"
                            : "border border-black/10 bg-white text-[#241c15] hover:border-[#d76f4b]"
                      }`}
                    >
                      {letter}
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
              className="inline-flex h-9 items-center justify-center rounded-full border border-black/10 bg-white px-4 text-xs font-semibold uppercase tracking-[0.2em] text-[#6b4b3d] shadow-sm shadow-black/5"
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
          {selected && placeMessage ? (
            <div className="mt-2 text-xs text-[#b45231]">{placeMessage}</div>
          ) : null}
        </div>
      </div>

      {showInventory ? (
        <div className="pointer-events-none absolute left-1/2 w-[min(720px,92vw)] -translate-x-1/2" style={{ bottom: "calc(180px + env(safe-area-inset-bottom))" }}>
          <div className="pointer-events-auto rounded-3xl border border-black/10 bg-white/95 p-4 text-xs text-[#5a4d43] shadow-2xl shadow-black/10">
            <div className="flex items-center justify-between font-semibold uppercase tracking-[0.2em] text-[#6b4b3d]">
              <span>Inventory</span>
              <button
                type="button"
                onClick={() => setShowInventory(false)}
                className="text-[10px] text-[#a38b7a]"
              >
                Close
              </button>
            </div>
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
          </div>
        </div>
      ) : null}
    </div>
  );
}
