"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { SCRABBLE_SCORES } from "@/lib/letters";

type Tile = {
  x: number;
  y: number;
  letter: string;
  direction: "horizontal" | "vertical";
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
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboard, setLeaderboard] = useState<
    Array<{ username: string; total_score: number }>
  >([]);
  const [leaderboardStatus, setLeaderboardStatus] = useState<
    "idle" | "loading" | "error"
  >("idle");

  const letterInventory = useMemo(() => {
    const map = new Map<string, number>();
    inventory.forEach((entry) => map.set(entry.letter, entry.quantity));
    return map;
  }, [inventory]);

  const placementDirection = selected
    ? selected.direction === "horizontal"
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
    if (!containerRef.current) {
      return;
    }
    const { offsetWidth, offsetHeight } = containerRef.current;
    setOffset({ x: offsetWidth / 2, y: offsetHeight / 2 });
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!selected) {
        return;
      }
      if (event.key === "Backspace") {
        setTypedWord((value) => value.slice(0, -1));
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
      const available = letterInventory.get(next) ?? 0;
      if (available <= 0 && next !== selected?.letter) {
        return;
      }
      setTypedWord((value) => value + next);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [anchorIndexes.length, letterInventory, selected]);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest("button[data-tile]")) {
      return;
    }
    setDragging(true);
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) {
      return;
    }
    setOffset((prev) => ({
      x: prev.x + event.movementX,
      y: prev.y + event.movementY,
    }));
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    setDragging(false);
    (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
  };

  const handleCenterBoard = () => {
    if (!containerRef.current) {
      return;
    }
    const { offsetWidth, offsetHeight } = containerRef.current;
    setOffset({ x: offsetWidth / 2, y: offsetHeight / 2 });
  };

  const handleSelectTile = (tile: Tile) => {
    setSelected(tile);
    setTypedWord("");
    setAnchorOccurrence(0);
    setWordStatus("idle");
    setPlaceStatus("idle");
    setPlaceMessage(null);
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
      setPlaceStatus("error");
      setPlaceMessage("Word is not valid yet.");
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
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setPlaceStatus("error");
        setPlaceMessage(data?.error || "Unable to place word.");
        return;
      }
      setPlaceStatus("success");
      setPlaceMessage("Word placed.");
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
      if (boardResponse.ok) {
        const boardData = (await boardResponse.json()) as {
          tiles?: Array<Record<string, unknown>>;
        };
        const nextTiles = (boardData.tiles ?? []).map((row) => ({
          x: Number(row.x ?? 0),
          y: Number(row.y ?? 0),
          letter: String(row.letter ?? ""),
          direction: row.direction === "vertical" ? "vertical" : "horizontal",
        }));
        setBoardTiles(nextTiles);
      }
    } catch (error) {
      setPlaceStatus("error");
      setPlaceMessage(
        error instanceof Error ? error.message : "Unable to place word.",
      );
    }
  };

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#efe7dc]">
      <div
        ref={containerRef}
        className="absolute inset-0 cursor-grab active:cursor-grabbing"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
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
              data-tile
              className={`absolute flex h-12 w-12 items-center justify-center rounded-2xl border text-base font-semibold uppercase transition ${
                selected?.x === tile.x && selected?.y === tile.y
                  ? "border-[#d76f4b] bg-[#fff1e7] text-[#b45231]"
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
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-6 flex justify-center">
        <div className="pointer-events-auto rounded-full border border-black/10 bg-white/80 px-6 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-[#6b4b3d] shadow-lg shadow-black/5">
          {selected
            ? `Anchor ${selected.letter.toUpperCase()} · ${placementDirection}`
            : "Select a tile to start"}
        </div>
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

      <div className="pointer-events-none absolute bottom-6 left-1/2 w-[min(720px,92vw)] -translate-x-1/2">
        <div className="pointer-events-auto rounded-3xl border border-black/10 bg-white/90 p-4 shadow-2xl shadow-black/10">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.2em] text-[#6b4b3d]">
            <span>Inventory Keyboard</span>
            <span className="text-[#a38b7a]">
              {loggedIn ? "Ready" : "Log in to play"}
            </span>
          </div>
          <div className="mt-3 space-y-2">
            {KEY_ROWS.map((row) => (
              <div key={row} className="flex justify-center gap-1">
                {row.split("").map((letter) => {
                  const available = letterInventory.get(letter) ?? 0;
                  const isAnchorLetter = selected?.letter === letter;
                  const disabled =
                    (!loggedIn || !selected || available <= 0) && !isAnchorLetter;
                  const letterScore = SCRABBLE_SCORES[letter] ?? 1;
                  return (
                    <button
                      key={letter}
                      type="button"
                      disabled={disabled}
                      onClick={() =>
                        setTypedWord((value) => value + letter.toLowerCase())
                      }
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
              </div>
            ))}
          </div>
          <div className="mt-3 rounded-2xl border border-dashed border-black/10 bg-[#fff7ef] px-4 py-2 text-xs text-[#5a4d43]">
            {selected
              ? typedWord.length > 0
                ? `Draft: ${typedWord.toUpperCase()}`
                : "Start typing to preview the next word."
              : "Pick a tile to anchor a new word."}
          </div>
          {selected ? (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={!loggedIn || wordStatus === "checking" || !typedWord}
                onClick={handlePlace}
                className="inline-flex h-10 items-center justify-center rounded-full bg-[#d76f4b] px-5 text-xs font-semibold uppercase tracking-[0.2em] text-white shadow-lg shadow-orange-200/70 transition hover:bg-[#b45231] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {placeStatus === "placing" ? "Placing..." : "Place word"}
              </button>
              <span className="text-xs uppercase tracking-[0.2em] text-[#6b4b3d]">
                {wordStatus === "checking"
                  ? "Checking..."
                  : wordStatus === "valid"
                    ? "Valid"
                    : wordStatus === "invalid"
                      ? "Not a word"
                      : ""}
              </span>
              {placeMessage ? (
                <span className="text-xs text-[#b45231]">{placeMessage}</span>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
