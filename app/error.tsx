"use client";
import { PageRecovery } from "@/components/page-recovery";

export default function ErrorPage({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <PageRecovery retry={retry} />;
}
