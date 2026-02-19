import type { tracks } from "@listen/db";
import { createFileRoute, Link } from "@tanstack/react-router";
import type { InferSelectModel } from "drizzle-orm";
import { ArrowLeft, Plus, Save, Trash2 } from "lucide-react";
import { useState } from "react";

import {
  useCreateTrack,
  useDeleteTrack,
  useHealth,
  useTracks,
  useUpdateTrack,
} from "../lib/queries";
import { formatTimestamp } from "../lib/utils";

type Track = InferSelectModel<typeof tracks>;

export const Route = createFileRoute("/tracks/$id")({
  component: TracksPage,
});

function TracksPage() {
  const { id } = Route.useParams();
  const { data: tracks, isLoading } = useTracks(id);
  const { data: health } = useHealth();
  const createTrack = useCreateTrack();
  const [editingTrack, setEditingTrack] = useState<number | undefined>(undefined);

  const isLive = health?.recording && health.currentSessionId === id;

  const handleAddTrack = () => {
    const position = (tracks?.length ?? 0) + 1;
    const timestampSeconds = health?.recordingDuration ?? 0;

    createTrack.mutate({
      sessionId: id,
      position,
      timestampSeconds,
      title: "New Track",
    });
  };

  if (isLoading) {
    return <div className="text-zinc-500">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          to="/rec/$id"
          params={{ id }}
          className="flex items-center gap-1 text-zinc-400 hover:text-zinc-100"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to session
        </Link>
      </div>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Edit Tracks - {id}</h1>
        <button
          onClick={handleAddTrack}
          disabled={createTrack.isPending}
          className="flex items-center gap-2 rounded-lg bg-zinc-800 px-4 py-2 hover:bg-zinc-700 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          Add Track {isLive && `@ ${formatTimestamp(health?.recordingDuration ?? 0)}`}
        </button>
      </div>

      {/* Tracks List */}
      {tracks?.length === 0 ? (
        <div className="text-zinc-500">No tracks yet. Add one to get started.</div>
      ) : (
        <div className="space-y-2">
          {tracks?.map((track) => (
            <TrackRow
              key={track.id}
              track={track}
              sessionId={id}
              isEditing={editingTrack === track.id}
              onEdit={() => setEditingTrack(track.id)}
              onCancel={() => setEditingTrack(undefined)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TrackRow({
  track,
  sessionId,
  isEditing,
  onEdit,
  onCancel,
}: {
  track: Track;
  sessionId: string;
  isEditing: boolean;
  onEdit: () => void;
  onCancel: () => void;
}) {
  const updateTrack = useUpdateTrack();
  const deleteTrack = useDeleteTrack();

  const [formData, setFormData] = useState({
    position: track.position,
    timestampSeconds: track.timestampSeconds,
    artist: track.artist ?? "",
    title: track.title,
    label: track.label ?? "",
  });

  const handleSave = () => {
    updateTrack.mutate(
      {
        sessionId,
        trackId: track.id,
        position: formData.position,
        timestampSeconds: formData.timestampSeconds,
        artist: formData.artist || undefined,
        title: formData.title,
        label: formData.label || undefined,
      },
      {
        onSuccess: onCancel,
      },
    );
  };

  const handleDelete = () => {
    if (confirm("Delete this track?")) {
      deleteTrack.mutate({ sessionId, trackId: track.id });
    }
  };

  if (isEditing) {
    return (
      <div className="space-y-3 rounded-lg border border-zinc-700 bg-zinc-900 p-4">
        <div className="grid grid-cols-4 gap-3">
          <div>
            <label htmlFor={`position-${track.id}`} className="text-xs text-zinc-500">
              #
            </label>
            <input
              id={`position-${track.id}`}
              type="number"
              value={formData.position}
              onChange={(e) =>
                setFormData({ ...formData, position: parseInt(e.target.value) || 0 })
              }
              className="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm"
            />
          </div>
          <div>
            <label htmlFor={`timestamp-${track.id}`} className="text-xs text-zinc-500">
              Timestamp (sec)
            </label>
            <input
              id={`timestamp-${track.id}`}
              type="number"
              value={formData.timestampSeconds}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  timestampSeconds: parseInt(e.target.value) || 0,
                })
              }
              className="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm"
            />
          </div>
          <div className="col-span-2">
            <label htmlFor={`artist-${track.id}`} className="text-xs text-zinc-500">
              Artist
            </label>
            <input
              id={`artist-${track.id}`}
              type="text"
              value={formData.artist}
              onChange={(e) => setFormData({ ...formData, artist: e.target.value })}
              className="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm"
              placeholder="Artist name"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor={`title-${track.id}`} className="text-xs text-zinc-500">
              Title
            </label>
            <input
              id={`title-${track.id}`}
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm"
              placeholder="Track title"
            />
          </div>
          <div>
            <label htmlFor={`label-${track.id}`} className="text-xs text-zinc-500">
              Label
            </label>
            <input
              id={`label-${track.id}`}
              type="text"
              value={formData.label}
              onChange={(e) => setFormData({ ...formData, label: e.target.value })}
              className="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm"
              placeholder="Record label"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded px-3 py-1 text-sm text-zinc-400 hover:text-zinc-100"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={updateTrack.isPending}
            className="flex items-center gap-1 rounded bg-green-600 px-3 py-1 text-sm hover:bg-green-700 disabled:opacity-50"
          >
            <Save className="h-3 w-3" />
            Save
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3">
      <button
        type="button"
        onClick={onEdit}
        className="flex flex-1 cursor-pointer items-center gap-4 text-left hover:opacity-80"
      >
        <span className="w-8 text-zinc-500">{track.position}</span>
        <span className="w-16 text-zinc-500">{formatTimestamp(track.timestampSeconds)}</span>
        <div className="flex-1">
          {track.artist && <span className="text-zinc-400">{track.artist} - </span>}
          <span>{track.title}</span>
        </div>
        {track.label && <span className="text-zinc-500">[{track.label}]</span>}
      </button>
      <button
        type="button"
        onClick={handleDelete}
        disabled={deleteTrack.isPending}
        className="text-zinc-500 hover:text-red-400 disabled:opacity-50"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
