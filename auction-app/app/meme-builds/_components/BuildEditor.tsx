"use client";

import { formatListedPosition, listedPositionSortKey } from "@/lib/best-xi-display";
import { MAX_STARTING_XI, type MemeBuild, type MemeBuildPoolPlayer } from "@/lib/meme-builds/types";
import { PlayerPoolPicker } from "./PlayerPoolPicker";

interface BuildEditorProps {
  build: MemeBuild;
  pool: MemeBuildPoolPlayer[];
  poolById: Map<string, MemeBuildPoolPlayer>;
  onChange: (build: MemeBuild) => void;
  onDelete: () => void;
}

export function BuildEditor({ build, pool, poolById, onChange, onDelete }: BuildEditorProps) {
  const squadPlayerIds = new Set(build.players.map((p) => p.playerId));
  const xiCount = build.players.filter((p) => p.inXi).length;

  const sortedSquad = [...build.players].sort((a, b) => {
    const metaA = poolById.get(a.playerId);
    const metaB = poolById.get(b.playerId);
    const pa = listedPositionSortKey(metaA?.position);
    const pb = listedPositionSortKey(metaB?.position);
    if (pa !== pb) return pa - pb;
    return (metaA?.playerName ?? "").localeCompare(metaB?.playerName ?? "");
  });

  const handleRename = (name: string) => {
    onChange({ ...build, name });
  };

  const handleAdd = (playerId: string) => {
    if (squadPlayerIds.has(playerId)) return;
    onChange({
      ...build,
      players: [...build.players, { playerId, inXi: false }],
    });
  };

  const handleRemove = (playerId: string) => {
    onChange({
      ...build,
      players: build.players.filter((p) => p.playerId !== playerId),
    });
  };

  const handleToggleXi = (playerId: string) => {
    const target = build.players.find((p) => p.playerId === playerId);
    if (!target) return;

    if (!target.inXi && xiCount >= MAX_STARTING_XI) return;

    onChange({
      ...build,
      players: build.players.map((p) =>
        p.playerId === playerId ? { ...p, inXi: !p.inXi } : p,
      ),
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 flex-1">
          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Build name
          </label>
          <input
            type="text"
            value={build.name}
            onChange={(e) => handleRename(e.target.value)}
            className="mt-1 w-full max-w-md rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            placeholder="e.g. Man United & ex-United XI"
          />
        </div>
        <button
          type="button"
          onClick={onDelete}
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
        >
          Delete build
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-900">
            Squad ({build.players.length})
          </h3>
          <span className="text-xs text-slate-500">
            Starting XI: {xiCount}/{MAX_STARTING_XI}
          </span>
        </div>

        {sortedSquad.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500">
            No players yet — add some from the pool below.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {sortedSquad.map((sp) => {
              const meta = poolById.get(sp.playerId);
              const xiFull = !sp.inXi && xiCount >= MAX_STARTING_XI;
              return (
                <li
                  key={sp.playerId}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-slate-900">{meta?.playerName ?? "—"}</div>
                    <div className="text-xs text-slate-500">
                      {formatListedPosition(meta?.position) ?? "—"} · {meta?.country ?? "—"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <label
                      className={`flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium ${
                        sp.inXi
                          ? "border-sky-300 bg-sky-50 text-sky-800"
                          : xiFull
                            ? "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400"
                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                      title={xiFull ? `Maximum ${MAX_STARTING_XI} starters` : undefined}
                    >
                      <input
                        type="checkbox"
                        checked={sp.inXi}
                        disabled={xiFull}
                        onChange={() => handleToggleXi(sp.playerId)}
                        className="size-3.5 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                      />
                      XI
                    </label>
                    <button
                      type="button"
                      onClick={() => handleRemove(sp.playerId)}
                      className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                    >
                      Remove
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <PlayerPoolPicker pool={pool} squadPlayerIds={squadPlayerIds} onAdd={handleAdd} />
    </div>
  );
}
