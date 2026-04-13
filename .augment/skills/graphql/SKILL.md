---
name: graphql
description: "Use when writing GraphQL schemas, resolvers, or client queries. Covers proper typing, N+1 prevention, and error handling."
---

# graphql

## When to use

GraphQL schema design, resolvers, client queries, service integration.

## Schema design

```graphql
type User {
  id: ID!
  name: String!
  email: String!
  projects: [Project!]!
  createdAt: DateTime!
}

type Project {
  id: ID!
  title: String!
  status: ProjectStatus!
  owner: User!
}

enum ProjectStatus {
  DRAFT
  ACTIVE
  COMPLETED
  ARCHIVED
}

type Query {
  user(id: ID!): User
  users(first: Int = 10, after: String): UserConnection!
  project(id: ID!): Project
}

type Mutation {
  createProject(input: CreateProjectInput!): Project!
  updateProject(id: ID!, input: UpdateProjectInput!): Project!
  deleteProject(id: ID!): Boolean!
}

input CreateProjectInput {
  title: String!
  status: ProjectStatus = DRAFT
}
```

### Schema rules

- Use **non-null (`!`)** by default — make fields nullable only when they can genuinely be null.
- Use **enums** for fixed sets of values.
- Use **input types** for mutations — not inline arguments.
- Use **connections** (Relay-style) for paginated lists.
- Name mutations as verbs: `createUser`, `updateProject`, `deleteComment`.

## N+1 prevention (DataLoader)

The most critical performance concern in GraphQL:

```ts
// ❌ N+1 — each user triggers a separate DB query for projects
const resolvers = {
  User: {
    projects: (user) => db.projects.findByUserId(user.id), // Called N times
  },
}

// ✅ DataLoader — batches into a single query
import DataLoader from 'dataloader'

const projectLoader = new DataLoader(async (userIds: string[]) => {
  const projects = await db.projects.findByUserIds(userIds)
  return userIds.map(id => projects.filter(p => p.userId === id))
})

const resolvers = {
  User: {
    projects: (user) => projectLoader.load(user.id), // Batched
  },
}
```

**Always use DataLoader** (or equivalent) for relationship resolvers.

## Error handling

```ts
// Structured errors with extensions
throw new GraphQLError('Project not found', {
  extensions: {
    code: 'NOT_FOUND',
    argumentName: 'id',
  },
})

// Validation errors
throw new GraphQLError('Invalid input', {
  extensions: {
    code: 'VALIDATION_ERROR',
    validationErrors: [
      { field: 'title', message: 'Title is required' },
    ],
  },
})
```

## Client queries

```ts
// Query with variables
const GET_USER = gql`
  query GetUser($id: ID!) {
    user(id: $id) {
      id
      name
      email
      projects {
        id
        title
        status
      }
    }
  }
`

// Only request fields you need — avoid over-fetching
```

### Client rules

- **Request only needed fields** — don't select everything.
- **Use fragments** for shared field sets across queries.
- **Use variables** — never interpolate values into query strings.
- **Handle loading, error, and empty states** in the UI.

## Pagination (Relay-style connections)

```graphql
type UserConnection {
  edges: [UserEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

type UserEdge {
  node: User!
  cursor: String!
}

type PageInfo {
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
  startCursor: String
  endCursor: String
}
```

## Core rules

- **Always use DataLoader** for relationship resolvers (N+1 prevention).
- **Always validate input** in mutations before processing.
- **Always handle errors** with structured error codes.
- **Use TypeScript** for resolvers — type the context, args, and return values.
- **Keep resolvers thin** — delegate to services/repositories.
- **Use persisted queries** in production for security and performance.

## Gotcha: N+1 even worse in GraphQL (DataLoader!), opaque IDs, nullable where appropriate.

## Do NOT: unbounded queries, skip auth, logic in resolvers, string interpolation in queries.
