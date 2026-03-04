import { QueryErrorResetBoundary } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import type { FallbackProps } from "react-error-boundary";

import { LoadingSpinner } from "./loading-spinner";

function DefaultError({ error, resetErrorBoundary }: FallbackProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20">
      <p className="text-zinc-400">
        {error instanceof Error ? error.message : "Something went wrong"}
      </p>
      <button
        onClick={resetErrorBoundary}
        className="rounded-lg border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-800"
      >
        Try again
      </button>
    </div>
  );
}

export function AsyncBoundary({
  children,
  pendingFallback,
  errorFallback,
}: {
  children: ReactNode;
  pendingFallback?: ReactNode;
  errorFallback?: React.ComponentType<FallbackProps>;
}) {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <ErrorBoundary onReset={reset} FallbackComponent={errorFallback ?? DefaultError}>
          <Suspense fallback={pendingFallback ?? <LoadingSpinner />}>{children}</Suspense>
        </ErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  );
}
