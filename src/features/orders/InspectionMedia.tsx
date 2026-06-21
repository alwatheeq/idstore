import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useMedia, useUploadMedia, useDeleteMedia } from "./hooks";
import { signedMediaUrl } from "./api";
import type { InspectionMedia as Media } from "./types";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

function MediaThumb({ item, onDelete }: { item: Media; onDelete: () => void }) {
  const { t } = useTranslation();
  const { data: url } = useQuery({
    queryKey: ["signed", item.storage_path],
    queryFn: () => signedMediaUrl(item.storage_path),
  });
  return (
    <div className="relative border rounded-lg overflow-hidden group">
      <div className="aspect-square bg-gray-100 flex items-center justify-center">
        {!url ? (
          <span className="opacity-40 text-xs">…</span>
        ) : item.media_type === "video" ? (
          <video src={url} controls className="w-full h-full object-cover" />
        ) : (
          <img src={url} alt={item.caption ?? ""} className="w-full h-full object-cover" />
        )}
      </div>
      <button
        type="button"
        onClick={onDelete}
        className="absolute top-1 end-1 bg-red-600 text-white text-xs rounded px-2 py-0.5 opacity-0 group-hover:opacity-100"
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
        <h3 className="text-lg font-semibold">{t("orders.media")}</h3>
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
        <p className="opacity-70">{t("orders.noMedia")}</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {media.map((m: Media) => (
            <MediaThumb
              key={m.id}
              item={m}
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
