import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useMedia, useUploadMedia, useDeleteMedia } from "./hooks";
import { signedMediaUrl } from "./api";
import type { InspectionMedia as Media } from "./types";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

function MediaThumb({
  item,
  onDelete,
  isPendingDelete,
}: {
  item: Media;
  onDelete: () => void;
  isPendingDelete: boolean;
}) {
  const { t } = useTranslation();
  const { data: url } = useQuery({
    queryKey: ["signed", item.storage_path],
    queryFn: () => signedMediaUrl(item.storage_path),
  });
  return (
    <div className="group relative overflow-hidden rounded-xl border border-line">
      <div className="flex aspect-square items-center justify-center bg-paper-2">
        {!url ? (
          <span className="text-xs text-muted">…</span>
        ) : item.media_type === "video" ? (
          <video
            src={url}
            controls
            className="w-full h-full object-cover"
            aria-label={item.caption ?? t("orders.media")}
          />
        ) : (
          <img src={url} alt={item.caption ?? t("orders.media")} className="w-full h-full object-cover" />
        )}
      </div>
      <button
        type="button"
        onClick={onDelete}
        disabled={isPendingDelete}
        className="absolute top-1 end-1 rounded-lg bg-danger px-2 py-0.5 text-xs font-semibold text-surface opacity-0 transition-opacity group-hover:opacity-100 disabled:pointer-events-none disabled:opacity-50"
      >
        {t("actions.delete")}
      </button>
    </div>
  );
}

export function InspectionMedia({ orderId }: { orderId: string }) {
  const { t } = useTranslation();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const { data: media } = useMedia(orderId);
  const upload = useUploadMedia(orderId);
  const del = useDeleteMedia(orderId);
  const onErr = () => toast.show(t("errors.saveFailed"));

  const onFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((f) => upload.mutate(f, { onError: onErr }));
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold tracking-tight text-ink">{t("orders.media")}</h3>
        <span>
          <Button onClick={() => inputRef.current?.click()} disabled={upload.isPending}>
            {t("orders.upload")}
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            className="hidden"
            onChange={(e) => onFiles(e.target.files)}
          />
        </span>
      </div>
      {!media || media.length === 0 ? (
        <div className="card grid place-items-center p-10 text-sm text-muted">
          {t("orders.noMedia")}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {media.map((m: Media) => (
            <MediaThumb
              key={m.id}
              item={m}
              isPendingDelete={del.isPending}
              onDelete={() => {
                if (confirm(t("actions.confirmDelete"))) del.mutate(m, { onError: onErr });
              }}
            />
          ))}
        </div>
      )}
    </section>
  );
}
