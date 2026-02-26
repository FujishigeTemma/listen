---
name: async-react-best-practices
description: >
  Best practices for building applications with React 19's Async Transition model
  combined with TanStack Router and TanStack Query. Covers the "everything is a
  Transition" paradigm, Suspense architecture, component design patterns (Boundary
  vs Leaf components, Action Props, AsyncBoundary), state ownership decisions
  (server state vs URL state vs ephemeral state), useTransition with async functions,
  useOptimistic, data-pending visual feedback, and file-based routing directory
  structure with co-location. Use this skill when designing component architecture,
  deciding where state should live, structuring a TanStack Router project, building
  design system components that handle async operations, or writing any code that
  involves useTransition, Suspense boundaries, useOptimistic, or startTransition.
  This complements tanstack-query-best-practices (which covers Query-specific APIs
  like queryOptions, query key factories, mutations, and caching) by focusing on the
  broader React async architecture that Query operates within.
---

# Async React Best Practices

This skill covers the architectural patterns for React 19's async model combined with TanStack Router/Query. For TanStack Query-specific APIs (queryOptions, query key factories, mutations, invalidation, caching configuration), see the `tanstack-query-best-practices` skill.

## The Async Transition Mental Model

React 19 introduces Async Transitions — the ability to pass async functions to `startTransition`. This is the foundation of the "everything is a Transition" worldview.

The core idea: **declare an entire async operation as a single intentional state transition**, and let React manage pending state, error propagation, and optimistic updates automatically.

```tsx
// Before: manual async state management scattered across the component
const [isPending, setIsPending] = useState(false)
const [error, setError] = useState(null)

const handleSubmit = async () => {
  setIsPending(true)
  try {
    await submit(data)
  } catch (e) {
    setError(e)
  } finally {
    setIsPending(false)
  }
}

// After: Transition absorbs the async complexity
const [isPending, startTransition] = useTransition()

const handleSubmit = () => {
  startTransition(async () => {
    const error = await updateProfile(name)
    if (error) setError(error)
    else redirect('/home')
  })
}
```

### What Transitions Manage

Three concerns that Transitions unify:

1. **Pending State** — `isPending` automatically becomes `true` when the transition starts and `false` when it completes. No manual `setIsLoading`.
2. **Optimistic Updates** — `useOptimistic` inside a transition provides instant UI feedback that auto-rolls back on failure.
3. **Error Propagation** — Errors thrown inside `startTransition` propagate to the nearest Error Boundary. No manual try/catch needed for UI error display.

### The AsyncContext Constraint

State updates after an `await` inside `startTransition` are **not** automatically marked as part of the transition. This is a JavaScript limitation — React loses the async context scope across await boundaries.

```tsx
startTransition(async () => {
  await saveData(data)
  // This state update is NOT part of the transition:
  setStatus('saved')

  // To keep it in the transition, re-wrap:
  startTransition(() => {
    setStatus('saved')
  })
})
```

This constraint will be resolved when TC39's AsyncContext proposal lands in JavaScript. Until then, re-wrap state updates after each `await` if they need to be part of the transition.

## The Architecture: Everything is a Transition

The target architecture wraps all user-initiated async operations in Transitions:

```
User Action
  → startTransition (async)
    → Async operation (fetch / mutation)
      → Suspense handles loading
      → ErrorBoundary handles errors
      → useOptimistic handles instant feedback
    → Commit (transition to confirmed new state)
```

In this model:
- **Navigation** is a Transition (TanStack Router wraps `<Link>` and `<Form>` navigation automatically)
- **Data mutations** are Transitions (wrap `mutate` calls in `startTransition`)
- **Filter/sort changes** that trigger new queries are Transitions (prevents Suspense fallback flash)

## Suspense + Transition: Preventing Fallback Flash

When a query key change triggers a new fetch inside a Suspense boundary, the default behavior shows the fallback (skeleton). Wrapping the state update that changes the query key in `startTransition` keeps the old content visible (optionally dimmed) while the new data loads:

```tsx
function PostsFilter() {
  const [isPending, startTransition] = useTransition()
  const [filter, setFilter] = useState('all')

  const handleFilter = (newFilter: string) => {
    startTransition(() => {
      setFilter(newFilter) // Query key changes but fallback won't show
    })
  }

  return (
    <div style={{ opacity: isPending ? 0.7 : 1 }}>
      <FilterButtons onFilter={handleFilter} />
      <Suspense fallback={<PostsSkeleton />}>
        <PostsList filter={filter} />
      </Suspense>
    </div>
  )
}
```

This is the most important pattern when combining TanStack Query's `useSuspenseQuery` with dynamic parameters. Without the Transition wrapper, every filter change would flash the skeleton.

## Mutation + Transition + useOptimistic

For mutations that need instant UI feedback, combine TanStack Query's `useMutation` with React's `useTransition` and `useOptimistic`:

```tsx
function useOptimisticMutation<TData, TVariables>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  queryKey: readonly unknown[],
) {
  const queryClient = useQueryClient()
  const [isPending, startTransition] = useTransition()

  const execute = (
    variables: TVariables,
    optimisticUpdate: (old: TData | undefined) => TData,
  ) => {
    startTransition(async () => {
      queryClient.setQueryData(queryKey, optimisticUpdate)
      await mutationFn(variables)
      await queryClient.invalidateQueries({ queryKey })
    })
  }

  return { execute, isPending }
}
```

For most CRUD operations, TanStack Query's built-in mutation + invalidation is simpler and sufficient. Reserve the Transition + useOptimistic pattern for interactions where instant feedback is critical (toggles, likes, drag-and-drop reordering).

## Component Classification

Components fall into two categories based on their relationship with async boundaries:

### Boundary Components

Positioned at route boundaries, Suspense boundaries, or Error Boundary boundaries. They are the "contract points" — they define what data is fetched and what loading/error states look like.

```tsx
// A route component is a Boundary Component
function PostsPage() {
  return (
    <AsyncBoundary fallback={<PostsSkeleton />}>
      <PostsList />
    </AsyncBoundary>
  )
}

// PostsList uses useSuspenseQuery — it suspends, and the
// boundary above catches it
function PostsList() {
  const { data, isFetching } = useSuspenseQuery(postsQueryOptions())
  return (
    <div data-pending={isFetching || undefined}>
      {data.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  )
}
```

### Leaf Components

Below the boundaries. They receive data via props or context and manage only their own ephemeral state (form inputs, hover, accordion open/close). They don't fetch data or suspend.

```tsx
// A Leaf Component — pure UI, local state only
function PostCard({ post }: { post: Post }) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div className="rounded-lg border p-4">
      <h3>{post.title}</h3>
      {isExpanded && <p>{post.body}</p>}
      <button onClick={() => setIsExpanded(!isExpanded)}>
        {isExpanded ? 'Collapse' : 'Expand'}
      </button>
    </div>
  )
}
```

## State Ownership Decision Framework

The central question for every piece of state: **who owns it?**

### Server State → TanStack Query

Any data that originates from the backend. Don't copy it into a separate store. TanStack Query manages caching, synchronization, and lifecycle. Define queries with `queryOptions` factories (see `tanstack-query-best-practices` skill).

### URL State → TanStack Router Search Params

Filters, pagination, sort order, active tab — anything that should survive a page refresh or be shareable via URL. TanStack Router's type-safe `search` params replace a surprising amount of what people reach for Zustand/Redux for.

```tsx
// Route definition with typed search params
export const Route = createFileRoute('/posts')({
  validateSearch: (search: Record<string, unknown>) => ({
    filter: (search.filter as string) || 'all',
    page: Number(search.page) || 1,
    sort: (search.sort as 'date' | 'title') || 'date',
  }),
  // ...
})

// In component — read and update search params
function PostsPage() {
  const { filter, page, sort } = Route.useSearch()
  const navigate = Route.useNavigate()

  const updateFilter = (newFilter: string) => {
    startTransition(() => {
      navigate({ search: (prev) => ({ ...prev, filter: newFilter, page: 1 }) })
    })
  }
  // ...
}
```

Before reaching for a client-side store, ask: "Could this be a search param?"

### Ephemeral State → useState / useReducer

UI state tied to a component's lifecycle: form input values, accordion open/close, hover, focus, drag position. Keep it in the component. Lift up only when a sibling genuinely needs it — not preemptively.

### Global Client State → Context or Zustand (Minimal)

Auth tokens, theme preference, toast queue — the small remainder after server state goes to Query and shareable state goes to URL. If using Zustand, keep slices small and separate. A monolithic store is an anti-pattern.

### The Data Flow

```
URL (TanStack Router search/params)
  ↓ drives query parameters
TanStack Query (server state cache)
  ↓ provides data
Boundary Component (Suspense/Error boundary + data fetching)
  ↓ passes via props
Leaf Component (ephemeral local state + UI)
  ↓ user action
Mutation (startTransition + useMutation → invalidateQueries)
  ↓ triggers refetch
TanStack Query cache update
```

## Design System Patterns for Async React

### AsyncBoundary Component

Combine Suspense and ErrorBoundary into a reusable boundary. Use `QueryErrorResetBoundary` from TanStack Query to enable retry-from-error:

```tsx
import { QueryErrorResetBoundary } from '@tanstack/react-query'
import { ErrorBoundary } from 'react-error-boundary'

interface AsyncBoundaryProps {
  fallback?: React.ReactNode
  errorFallback?: React.ReactNode
  children: React.ReactNode
}

function AsyncBoundary({ fallback, errorFallback, children }: AsyncBoundaryProps) {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <ErrorBoundary
          onReset={reset}
          fallbackRender={({ resetErrorBoundary }) =>
            errorFallback ?? <DefaultError onRetry={resetErrorBoundary} />
          }
        >
          <Suspense fallback={fallback ?? <DefaultSkeleton />}>
            {children}
          </Suspense>
        </ErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  )
}
```

### Action Props Pattern

Buttons and forms that trigger async operations accept an `action` prop (a function returning a Promise). The component wraps it in `startTransition` internally:

```tsx
interface ButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> {
  action?: () => Promise<void>
  onClick?: React.MouseEventHandler<HTMLButtonElement>
  children: React.ReactNode
}

function Button({ action, onClick, children, disabled, ...props }: ButtonProps) {
  const [isPending, startTransition] = useTransition()

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (action) {
      startTransition(async () => {
        await action()
      })
    } else {
      onClick?.(e)
    }
  }

  return (
    <button
      {...props}
      onClick={handleClick}
      disabled={disabled || isPending}
      data-pending={isPending || undefined}
      aria-busy={isPending}
    >
      {isPending ? <Spinner size="sm" /> : null}
      {children}
    </button>
  )
}
```

The name `action` has no special React meaning — it's a convention signaling "this handler will be wrapped in a Transition."

### Pending State Visual Feedback

Standardize on `data-pending` attribute for CSS-driven pending states:

```css
[data-pending] {
  opacity: 0.6;
  cursor: wait;
  pointer-events: none;
  transition: opacity 150ms ease;
}
```

Use `isFetching` from `useSuspenseQuery` (not `isPending`, which is always `false` for suspense queries with cached data) to set `data-pending` on containers during background refetches.

### Form Component with Transition

```tsx
interface FormProps<T> {
  action: (data: T) => Promise<void>
  schema?: ZodSchema<T>
  children: React.ReactNode
  onSuccess?: () => void
}

function Form<T>({ action, schema, children, onSuccess }: FormProps<T>) {
  const [isPending, startTransition] = useTransition()
  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const rawData = Object.fromEntries(formData)

    startTransition(async () => {
      if (schema) {
        const result = schema.safeParse(rawData)
        if (!result.success) {
          setErrors(result.error.flatten().fieldErrors as Record<string, string>)
          return
        }
        await action(result.data)
      } else {
        await action(rawData as T)
      }
      onSuccess?.()
    })
  }

  return (
    <FormContext.Provider value={{ isPending, errors }}>
      <form onSubmit={handleSubmit} aria-busy={isPending}>
        {children}
      </form>
    </FormContext.Provider>
  )
}
```

### Component Design Summary

| Category | Pattern |
|---|---|
| Button / IconButton | `action` prop wraps handler in Transition; reflect `isPending` in UI |
| Form | `startTransition` + validation + Error Boundary propagation |
| Data display (Table, List) | `useSuspenseQuery`; `isFetching` drives `data-pending` |
| Navigation | Delegate to TanStack Router's `<Link>` (auto-Transition) |
| Layout | Provide `AsyncBoundary` (Suspense + ErrorBoundary) |
| Modal / Dialog | Open action as Transition; internal content fetched via Suspense |

## TanStack Router Integration

### Route Loaders and Suspense

Loaders pre-fill the Query cache before the component renders. The component reads from cache via `useSuspenseQuery`. This eliminates loading waterfalls:

```tsx
export const Route = createFileRoute('/posts/$postId')({
  loader: ({ context: { queryClient }, params: { postId } }) =>
    queryClient.ensureQueryData(postQueryOptions(postId)),
  component: PostPage,
})

function PostPage() {
  const { postId } = Route.useParams()
  const { data } = useSuspenseQuery(postQueryOptions(postId))
  return <PostView post={data} />
}
```

The loader starts the fetch during navigation (which is itself a Transition). By the time the component mounts, data is already in the cache.

### Navigation as Transition

TanStack Router automatically wraps `<Link>` and `<Form>` navigation in async Transitions. For programmatic navigation or other async operations, wrap manually:

```tsx
const navigate = useNavigate()
const [isPending, startTransition] = useTransition()

const handleAction = () => {
  startTransition(async () => {
    await performAction()
    navigate({ to: '/result' })
  })
}
```

## Directory Structure

Organize by route with co-located private directories. This follows the principle of "close by feature, not by file type":

```
src/
├── routes/                        # TanStack Router file-based routing
│   ├── __root.tsx                 # Root layout (providers, global error boundary)
│   ├── _auth.tsx                  # Authenticated layout route
│   ├── _auth.dashboard/
│   │   ├── index.tsx              # /dashboard route
│   │   ├── -components/           # Private to this route
│   │   │   ├── DashboardHeader.tsx
│   │   │   └── StatsCard.tsx
│   │   └── -hooks/                # Private hooks for this route
│   │       └── useStatsAnimation.ts
│   └── _auth.posts/
│       ├── index.tsx              # /posts route
│       ├── $postId.tsx            # /posts/:postId route
│       └── -components/
│           └── PostEditor.tsx
│
├── components/                    # Shared across multiple routes
│   ├── ui/                        # Generic primitives (Button, Input, AsyncBoundary)
│   └── shared/                    # Domain-shared components (UserAvatar, etc.)
│
├── queries/                       # queryOptions factories (per domain)
│   ├── posts.ts
│   └── users.ts
│
├── api/                           # Fetcher functions (called by queryOptions)
│   ├── posts.ts
│   └── users.ts
│
├── hooks/                         # Shared custom hooks
│   └── useDebounce.ts
│
├── stores/                        # Global client state (minimal)
│   └── auth.ts
│
└── lib/                           # Utilities and configuration
    ├── queryClient.ts
    └── router.ts
```

The `-` prefix on `-components/` and `-hooks/` prevents TanStack Router from interpreting these directories as route segments.

### Co-location Principle

Route-specific components, hooks, and utilities live inside the route directory. Only extract to shared directories (`components/`, `hooks/`) when genuinely used by multiple routes. Start co-located, promote to shared only when needed.

## Summary

The guiding principle: **Server state belongs to Query, URL state belongs to Router, ephemeral state belongs to the component, and Transitions unify async operations across all of them.**

Don't design a global store first and then build features into it. Instead, keep state in components and ask: "Does this need to be lifted? Or can Query, Router, or a Transition handle it?"
