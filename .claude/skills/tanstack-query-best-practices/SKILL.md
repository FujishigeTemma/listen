---
name: tanstack-query-best-practices
description: >
  Comprehensive best practices for writing TanStack Query (React Query) v5 code,
  based on all 31 posts from TkDodo's Practical React Query blog series. Covers
  query key factories with queryOptions, mutations and invalidation strategies,
  TypeScript type inference, error handling, data transformations with select,
  status checks, testing, optimistic updates, and architectural patterns.
  Use this skill whenever writing, reviewing, or refactoring code that uses
  TanStack Query — including useQuery, useMutation, queryOptions, queryClient,
  invalidation, prefetching, or any @tanstack/react-query import. Also use when
  the user asks about React Query patterns, caching strategies, or server state
  management. This applies even for small changes like adding a single query hook.
---

# TanStack Query Best Practices

This skill encodes the complete knowledge from TkDodo's 31-part "Practical React Query" blog series. TkDodo (Dominik Dorfmeister) is the maintainer of TanStack Query. These aren't theoretical suggestions — they're battle-tested patterns from the person who builds the library.

## Core Mental Model

TanStack Query is **not** a data fetching library — it's an **async state manager**. Understanding this distinction shapes everything:

- It manages **server state**: data you don't own, that lives on the backend, and that you only see snapshots of.
- The frontend never "owns" this data — it displays a point-in-time version and tries to keep it fresh.
- Server state (TanStack Query) and client state (UI toggles, modals, form inputs) are fundamentally different. Don't mix them. Use Zustand, Context, or local state for client-only concerns.
- Never sync server data into a separate state manager (Redux, Zustand). Let React Query be the single source of truth for server state.
- The QueryKey uniquely identifies your query globally — call `useQuery` with the same key anywhere and get the same data. This makes components decoupled and self-sufficient.

## Query Options API — The Primary Abstraction

Since v5, `queryOptions()` is the preferred way to define queries — not custom hooks. This is TkDodo's strongest recommendation for modern codebases.

Why `queryOptions` over custom hooks:
- Custom hooks only work in components and other hooks. `queryOptions` works everywhere: hooks, route loaders, event handlers, server-side code.
- Custom hooks share **logic** between components. But query definitions share **configuration**, which is better expressed as plain objects.
- `queryOptions` co-locates `queryKey` + `queryFn` + options, making the type system carry query type info through `getQueryData`, `setQueryData`, and `invalidateQueries`.

### Query Key Factories with queryOptions

Organize queries as factories per feature. Each level builds on the one above, enabling powerful fuzzy invalidation:

```typescript
import { queryOptions } from "@tanstack/react-query";

export const sessionQueries = {
  all: () =>
    queryOptions({
      queryKey: ["sessions"],
      queryFn: async () => {
        const res = await client.sessions.$get();
        if (!res.ok) throw new Error("Failed to fetch sessions");
        return (await res.json()).sessions;
      },
    }),

  live: () =>
    queryOptions({
      queryKey: [...sessionQueries.all().queryKey, "live"],
      queryFn: async () => {
        const res = await client.sessions.live.$get();
        if (!res.ok) throw new Error("Failed to fetch live session");
        return (await res.json()).session;
      },
      refetchInterval: 10_000,
    }),

  archive: () =>
    queryOptions({
      queryKey: [...sessionQueries.all().queryKey, "archive"],
      queryFn: async () => {
        const res = await client.sessions.archive.$get();
        if (!res.ok) throw new Error("Failed to fetch archive");
        return (await res.json()).sessions;
      },
    }),

  detail: (id: string) =>
    queryOptions({
      queryKey: [...sessionQueries.all().queryKey, id],
      queryFn: async () => {
        const res = await client.sessions[":id"].$get({ param: { id } });
        if (!res.ok) throw new Error("Failed to fetch session");
        return (await res.json()).session;
      },
    }),
};
```

Then use them cleanly everywhere:

```typescript
// In a component
const { data } = useQuery(sessionQueries.live());

// In a route loader (TanStack Router)
export const Route = createFileRoute("/sessions/$id")({
  loader: ({ context: { queryClient }, params: { id } }) =>
    queryClient.ensureQueryData(sessionQueries.detail(id)),
});

// In a mutation's onSuccess
onSuccess: () => {
  // Invalidates ALL session queries (live, archive, details) via fuzzy matching
  void queryClient.invalidateQueries({ queryKey: sessionQueries.all().queryKey });
};
```

Custom hooks can still wrap `queryOptions` when you need hook-specific logic (like `select` with component state):

```typescript
export function useSessionTitle(id: string) {
  return useQuery({
    ...sessionQueries.detail(id),
    select: (session) => session.title,
  });
}
```

### Query Key Rules

- **Parameters are dependencies.** Everything used inside `queryFn` **must** appear in `queryKey`. Think of it like `useEffect` dependencies, but without the referential stability headaches. Use ESLint plugin `@tanstack/eslint-plugin-query` to enforce this.
- Keys are hashed deterministically — object key order doesn't matter.
- Prefer object keys over positional arrays for named destructuring: `{ filters, sort }` beats `[filters, sort]`.
- Don't put `undefined` in keys — use default parameter values instead (e.g., `sorting: Sorting = {}`).

### `enabled` — Conditional Queries

Use `enabled` to control when a query runs. Disabled queries won't fetch automatically but stay subscribed:

```typescript
// Dependent query — only fetches when userId is available
useQuery({
  ...userQueries.detail(userId!),
  enabled: !!userId,
});
```

`enabled: false` pauses all automatic fetching (mount, window focus, interval). You can still trigger manual fetches with `refetch()`. This is the right tool for dependent/sequential queries and feature flags — not removing the query entirely.

## Defaults & Configuration

TanStack Query's defaults are aggressive on purpose — they keep data fresh:

| Setting | Default | Guidance |
|---------|---------|----------|
| `staleTime` | `0` (instantly stale) | **Customize this.** It's your most important setting. Set it based on how often your data actually changes. |
| `gcTime` | 5 minutes | Rarely needs changing. |
| `refetchOnWindowFocus` | `true` | Keep it on in production. If you see "unexpected" refetches, this is likely why — and it's a feature. |
| `refetchOnMount` | `true` | Keep it on unless you have a specific reason. |
| `refetchOnReconnect` | `true` | Keep it on. |
| `retry` | 3 (exponential backoff) | Good default. Set to `false` in tests. |
| `networkMode` | `'online'` | Pauses queries when offline. Use `'offlineFirst'` if you have a service worker/cache layer (first request must fire for the SW to intercept). Use `'always'` for queries that don't need network (e.g., IndexedDB). |

Only disable refetch flags if you truly understand why and your use case demands it. The defaults exist to keep your UI accurate.

## Status Checks — Data First

When rendering query results, check for data availability **first**, then error, and treat loading as the fallback:

```typescript
const { data, error, isPending } = useQuery(sessionQueries.detail(id));

// Check data FIRST — user sees stale data even during background refetch errors
if (data) {
  return <SessionView session={data} />;
}

if (error) {
  return <ErrorMessage error={error} />;
}

// Loading is the fallback — no data and no error means we're still loading
return <Skeleton />;
```

Why not check `isPending` first? Because during a background refetch failure, you'd replace perfectly good stale data with an error screen — confusing the user. Stale data is almost always better than nothing.

Two status dimensions:
- `status` (`pending` | `error` | `success`) tells you about **data** — do you have it or not?
- `fetchStatus` (`fetching` | `paused` | `idle`) tells you about the **queryFn** — is it running?
- `isPlaceholderData` — `true` when the displayed data is placeholder (from `placeholderData` option). Use it to show a visual hint (e.g., reduced opacity) so the user knows the data is temporary.

## Data Transformations with `select`

The `select` option is the right place to transform or derive data from a query:

```typescript
// Subscribe only to the count — won't re-render when todo names change
function useTodoCount() {
  return useQuery({
    ...todoQueries.all(),
    select: (todos) => todos.length,
  });
}

// Filter with component state — inline function is fine, re-runs on every render
// but structural sharing prevents unnecessary re-renders
function useFilteredTodos(status: "done" | "open") {
  return useQuery({
    ...todoQueries.all(),
    select: (todos) => todos.filter((t) => t.status === status),
  });
}
```

- `select` only runs when data exists — no `undefined` checks needed.
- Components only re-render when their selected slice actually changes (thanks to structural sharing applied twice: once on the queryFn result, once on the select result).
- For expensive computations, stabilize the selector with `useCallback` or extract to a module-level function. For simple selectors, inline is fine — structural sharing prevents unnecessary re-renders even without memoization.
- Don't transform in `queryFn` unless you want the **transformed** structure cached (you lose access to the original).
- TanStack Query uses **tracked queries** by default (since v4): it tracks which fields of the query result you access and only re-renders when those specific fields change. Opt out with `notifyOnChangeProps: 'all'` if needed.

## Error Handling

Three complementary approaches — use them together:

### 1. Inline error state
Check `error` / `isError` in your component and render error UI. Best for component-specific error recovery.

### 2. Error Boundaries with `throwOnError`
```typescript
useQuery({
  ...sessionQueries.detail(id),
  throwOnError: true, // All errors go to nearest Error Boundary
});

// Or selectively:
throwOnError: (error) => error.status >= 500  // Only server errors
```

### 3. Global QueryCache callbacks
```typescript
const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      // Fires ONCE per failed query — not per observer
      if (query.state.data !== undefined) {
        // Only show toast for background refetch failures (user already has data)
        toast.error(`Something went wrong: ${error.message}`);
      }
    },
  }),
});
```

The global callback is the right place for error toasts and monitoring — it fires exactly once per failing query, not once per component using it.

Note: `onSuccess` / `onError` / `onSettled` callbacks on `useQuery` were **removed in v5** because they ran per-observer (causing duplicate toasts) and didn't fire for cached reads (causing state sync bugs). Use the patterns above instead.

## Mutations & Invalidation

### `mutate` vs `mutateAsync`

`useMutation` returns two ways to trigger the mutation:
- **`mutate()`** — fire-and-forget. Handle results via the `onSuccess`/`onError` callbacks. This is the default choice.
- **`mutateAsync()`** — returns a Promise. Use only when you need to `await` the result (e.g., sequential mutations). Remember to handle errors yourself — `mutateAsync` rejects on error.

### Callback separation principle

`useMutation` callbacks (in the hook definition) are for **query-related side effects** — cache invalidation, refetching. `mutate()` callbacks (at the call site) are for **component-specific side effects** — navigation, closing modals, showing toasts:

```typescript
// Hook definition — cache concerns
const mutation = useMutation({
  mutationFn: createSession,
  onSuccess: () => {
    void queryClient.invalidateQueries({ queryKey: sessionQueries.all().queryKey });
  },
});

// Call site — UI concerns
mutation.mutate(data, {
  onSuccess: () => navigate("/sessions"),
});
```

### Global MutationCache callbacks

Like QueryCache, MutationCache supports global callbacks for cross-cutting concerns:

```typescript
const queryClient = new QueryClient({
  mutationCache: new MutationCache({
    onError: (error) => {
      toast.error(`Mutation failed: ${error.message}`);
    },
  }),
});
```

### Invalidation Strategies

Prefer invalidation over direct cache updates — it's simpler and avoids duplicating backend logic:

```typescript
export function useCreateSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { title: string }) => {
      const res = await client.api.sessions.$post({ json: data });
      if (!res.ok) throw new Error("Failed to create session");
      return res.json();
    },
    onSuccess: () => {
      // Fuzzy match: invalidates sessions list, archive, live, all details
      void queryClient.invalidateQueries({
        queryKey: sessionQueries.all().queryKey,
      });
    },
  });
}
```

Key mutation patterns:
- **Await invalidation** if you want the mutation to stay in `isPending` until fresh data arrives: `onSuccess: async () => { await queryClient.invalidateQueries(...) }`
- Invalidation only refetches **active** queries and marks the rest as stale — it's smart about network usage.
- For mutations that return the updated entity, you can use `setQueryData` for instant UI updates, but invalidation is usually simpler.

### Optimistic Updates — Use Sparingly

Only use optimistic updates for small, frequent mutations where instant feedback matters (toggle buttons, like counts). For most CRUD operations, a disabled button + loading indicator is better UX than optimistic updates that might flash incorrect state.

```typescript
useMutation({
  mutationFn: toggleTodo,
  onMutate: async (todoId) => {
    // 1. Cancel running queries (prevents overwriting our optimistic update)
    await queryClient.cancelQueries({ queryKey: todoQueries.all().queryKey });

    // 2. Snapshot current data for rollback
    const previous = queryClient.getQueryData(todoQueries.all().queryKey);

    // 3. Optimistically update
    queryClient.setQueryData(todoQueries.all().queryKey, (old) =>
      old?.map((t) => (t.id === todoId ? { ...t, done: !t.done } : t))
    );

    return { previous };
  },
  onError: (_err, _todoId, context) => {
    // 4. Rollback on error
    queryClient.setQueryData(todoQueries.all().queryKey, context?.previous);
  },
  onSettled: () => {
    // 5. Always refetch to ensure consistency
    void queryClient.invalidateQueries({ queryKey: todoQueries.all().queryKey });
  },
});
```

For concurrent optimistic updates (multiple mutations firing at once), use `mutationKey` + `isMutating` to guard invalidation:

```typescript
onSettled: () => {
  if (queryClient.isMutating({ mutationKey: ["toggleTodo"] }) === 1) {
    void queryClient.invalidateQueries({ queryKey: todoQueries.all().queryKey });
  }
},
```

## TypeScript — Let Inference Work

The golden rule: **don't pass generics to `useQuery` manually.** Let TypeScript infer everything from `queryFn`:

```typescript
// BAD — manually specifying generics
const { data } = useQuery<Session[], Error>({
  queryKey: ["sessions"],
  queryFn: fetchSessions,
});

// GOOD — inferred from queryFn's return type
const { data } = useQuery({
  queryKey: ["sessions"],
  queryFn: fetchSessions, // returns Promise<Session[]>
});
// data is automatically typed as Session[] | undefined
```

- Ensure your `queryFn` (or the API client function it calls) has an explicit return type.
- `queryOptions` makes this even better — the queryKey carries type info that flows into `getQueryData` and `setQueryData`.
- Register a global error type instead of specifying it per-query:

```typescript
declare module "@tanstack/react-query" {
  interface Register {
    defaultError: Error; // or your custom error type
  }
}
```

- For runtime type safety, validate API responses with a schema library (Valibot, Zod). This turns "having types" into actually "being type-safe."

## Placeholder & Initial Data

Two different mechanisms for showing data before a fetch completes:

| | `initialData` | `placeholderData` |
|---|---|---|
| **Level** | Cache level | Observer level |
| **Persisted?** | Yes, written to cache | No, never cached |
| **staleTime** | Respected (can prevent refetch) | Ignored (always refetches) |
| **On error** | Stays in cache | Disappears |
| **Use for** | Pre-filling from another query | Loading skeletons, "fake" data |

```typescript
// Seed detail view from list cache
useQuery({
  ...sessionQueries.detail(id),
  initialData: () =>
    queryClient
      .getQueryData(sessionQueries.archive().queryKey)
      ?.find((s) => s.id === id),
  initialDataUpdatedAt: () =>
    queryClient.getQueryState(sessionQueries.archive().queryKey)?.dataUpdatedAt,
});

// Show placeholder while loading
useQuery({
  ...sessionQueries.detail(id),
  placeholderData: keepPreviousData, // v5: replaces keepPreviousData option
});
```

When using `initialData` from another query, always set `initialDataUpdatedAt` — without it, TanStack Query assumes the data was fetched "now" and may skip necessary refetches.

To prevent Suspense waterfalls (where sequential `useSuspenseQuery` calls create a loading cascade), use `prefetchQuery` earlier in the lifecycle (e.g., in route loaders or parent components) to ensure the cache is warm before the suspending component mounts.

## Testing

```typescript
function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false }, // No retries in tests — avoids timeouts
    },
  });
}

function renderWithClient(ui: React.ReactElement) {
  const client = createTestQueryClient(); // NEW client per test
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>
  );
}
```

Critical rules:
- **New QueryClient per test** — shared clients leak cached data between tests.
- **`retry: false`** — default 3 retries with exponential backoff will make error tests timeout.
- **Never mock `useQuery` directly** — mock the API layer (network requests) instead. Mocking `useQuery` skips all React Query logic (caching, retries, dedup) and tests a fake version of your code.
- **Use MSW (Mock Service Worker)** — single source of truth for API mocking that works in tests, Storybook, and dev.

## Router Integration (TanStack Router)

Use route loaders to pre-fill the cache, and `useQuery` in components for freshness:

```typescript
// In route definition
export const Route = createFileRoute("/sessions/$id")({
  loader: ({ context: { queryClient }, params: { id } }) =>
    queryClient.ensureQueryData(sessionQueries.detail(id)),
  component: SessionPage,
});

// In component — still uses useQuery for background freshness
function SessionPage() {
  const { id } = Route.useParams();
  const { data } = useSuspenseQuery(sessionQueries.detail(id));
  return <SessionView session={data} />;
}
```

- `ensureQueryData` returns cached data if fresh, or fetches if stale — perfect for loaders.
- The loader pre-fills the cache so the component renders instantly on navigation.
- `useQuery` / `useSuspenseQuery` in the component keeps data fresh with background refetches.

## Forms

When forms need server data as defaults:
- Copy server state to form state and set a high `staleTime` (background updates are irrelevant while editing).
- For collaborative environments, keep background updates on and derive display from merged server + client state. Use controlled fields (not uncontrolled) so React can update values when server state changes.
- React Hook Form's `values` API reacts to external value changes. Combine with `resetOptions: { keepDirtyValues: true }` to preserve user edits while syncing untouched fields from the server.

## Infinite Queries

`useInfiniteQuery` manages paginated/infinite-scroll data. The key difference from `useQuery`: data is stored as an array of pages.

```typescript
useInfiniteQuery({
  queryKey: ["posts"],
  queryFn: ({ pageParam }) => fetchPosts(pageParam),
  initialPageParam: 0,
  getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  maxPages: 5, // Limit stored/refetched pages for performance
});
```

- `getNextPageParam` drives pagination — return `undefined` to signal no more pages.
- On refetch, TanStack Query re-fetches all loaded pages sequentially to maintain consistency.
- Use `maxPages` to cap how many pages are stored and refetched — important for long-lived sessions.
- `hasNextPage` is `true` when `getNextPageParam` returns a non-undefined value.

## Real-time / WebSocket Patterns

TanStack Query works well with event-driven updates. Two approaches:

1. **Event-driven invalidation** (simpler): receive events via WebSocket, call `invalidateQueries`. This only refetches active queries — ideal for push notifications.
2. **Direct cache updates**: receive full data via WebSocket, update cache with `setQueryData`. Better for high-frequency updates where you want to avoid refetching.

When all updates come through WebSocket, set `staleTime: Infinity` — time-based refetching is redundant when you receive push updates.

## Anti-patterns

| Don't | Instead |
|-------|---------|
| Pass generics to `useQuery` manually | Let TypeScript infer from `queryFn` |
| Sync server data to Redux/Zustand | Let TanStack Query be the source of truth |
| Use `setQueryData` as local state | Use `useState` for local state; `setQueryData` for cache updates after mutations |
| Disable all refetch flags | Customize `staleTime` instead |
| Use `onSuccess` to `setState` | Derive state from query data, or use global QueryCache callbacks |
| Share QueryClient between tests | Create a new one per test |
| Use inline functions for expensive `select` | Wrap in `useCallback` or extract to a stable reference |
| Check `isPending` before `data` | Check `data` first, then error, loading as fallback |
| Create custom hooks as the first abstraction | Use `queryOptions` factories first; wrap in hooks only when needed |
| Use `prefetchQuery` in loaders | Use `fetchQuery` or `ensureQueryData` (they throw on error) |
| Mock `useQuery` in tests | Mock the network layer (MSW) — mocking `useQuery` skips all React Query logic |

## Architecture Quick Reference

```
QueryClient
  └── QueryCache (in-memory JS object)
        └── Query (per queryKey — state machine, retry, dedup logic)
              └── QueryObserver (per useQuery call — bridges to React)
```

- **QueryClient**: Container, usually one per app.
- **QueryCache**: Serialized queryKey → Query instance mapping.
- **Query**: Holds data, status, meta. Executes queryFn with retry/cancel/dedup.
- **QueryObserver**: Created by `useQuery`. Subscribes to one Query, triggers re-renders via tracked props.
- Most logic is framework-agnostic in Query Core — only the observer layer is React-specific.
