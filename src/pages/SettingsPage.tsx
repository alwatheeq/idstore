import { useTranslation } from "react-i18next";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button, buttonClasses } from "@/components/ui/Button";
import { VW_EV_MODELS, DEFAULT_MODEL_KEY } from "@/features/vehicles/models";
import {
  useModelImages,
  useUploadModelImage,
  useDeleteModelImage,
} from "@/features/vehicles/hooks";

export function SettingsPage() {
  const { t } = useTranslation();
  const { data: images } = useModelImages();
  const upload = useUploadModelImage();
  const remove = useDeleteModelImage();
  const map = images ?? {};

  const slots = [
    ...VW_EV_MODELS,
    { key: DEFAULT_MODEL_KEY, label: t("settings.defaultModel") },
  ];

  return (
    <div className="space-y-8">
      <PageHeader title={t("nav.settings")} eyebrow={t("nav.settings")} />

      <section className="space-y-4">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold tracking-tight text-ink">
            {t("settings.vehicleImages")}
          </h3>
          <p className="text-sm text-muted">{t("settings.vehicleImagesHint")}</p>
        </div>

        <ul className="grid gap-4 sm:grid-cols-2">
          {slots.map((s) => {
            const url = map[s.key];
            const pending = upload.isPending && upload.variables?.modelKey === s.key;
            return (
              <li key={s.key} className="card flex items-center gap-4 p-4">
                <div className="grid h-16 w-24 flex-shrink-0 place-items-center overflow-hidden rounded-xl border border-line bg-paper-2">
                  {url ? (
                    <img src={url} alt={s.label} className="h-full w-full object-contain" />
                  ) : (
                    <span className="micro">—</span>
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="font-medium text-ink">{s.label}</div>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className={`${buttonClasses("ghost")} cursor-pointer`}>
                      {pending
                        ? t("common.loading")
                        : url
                          ? t("settings.replaceImage")
                          : t("settings.uploadImage")}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        aria-label={`${t("settings.uploadImage")} — ${s.label}`}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) upload.mutate({ modelKey: s.key, file: f });
                          e.target.value = "";
                        }}
                      />
                    </label>
                    {url && (
                      <Button
                        variant="danger"
                        onClick={() => {
                          if (confirm(t("actions.confirmDelete"))) remove.mutate(s.key);
                        }}
                      >
                        {t("actions.delete")}
                      </Button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
