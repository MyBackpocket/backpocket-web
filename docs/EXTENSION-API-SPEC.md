# Backpocket Browser Extension API Specification

This document outlines the authentication and API requirements for building a browser extension that allows users to quickly save links to their Backpocket account.

---

## Table of Contents

1. [Overview](#overview)
2. [Tech Stack](#tech-stack)
3. [Project Setup](#project-setup)
4. [Authentication](#authentication)
5. [API Architecture](#api-architecture)
6. [Core Endpoints](#core-endpoints)
7. [Type Definitions](#type-definitions)
8. [Implementation Guide](#implementation-guide)
9. [Error Handling](#error-handling)

---

## Overview

The Backpocket browser extension needs to:

1. **Authenticate users** via Clerk
2. **Create new saves** (bookmarks) from the current page
3. **Add tags** to saves (optional)
4. **List existing tags** for autocomplete/selection

### Base URL

```
Production: https://backpocket.dev
```

---

## Tech Stack

The extension is built with:

| Technology                                    | Purpose                              |
| --------------------------------------------- | ------------------------------------ |
| [WXT](https://wxt.dev/)                       | Next-gen web extension framework     |
| [Bun](https://bun.sh/)                        | JavaScript runtime & package manager |
| [React](https://react.dev/)                   | UI framework                         |
| [TypeScript](https://www.typescriptlang.org/) | Type safety                          |

### Why WXT?

[WXT](https://wxt.dev/) is a modern extension framework that provides:

- 🌐 **Cross-browser support** - Chrome, Firefox, Edge, Safari from one codebase
- ✅ **MV2 & MV3** - Build for both manifest versions
- ⚡ **Fast dev mode** - HMR for UI, fast reloads for background/content scripts
- 📂 **File-based entrypoints** - Manifest generated from project structure
- 🦾 **TypeScript first** - Full type safety out of the box
- 🎨 **Framework agnostic** - Works with React via Vite plugin

---

## Project Setup

### Prerequisites

```bash
# Install Bun if not already installed
curl -fsSL https://bun.sh/install | bash
```

### Initialize WXT Project

```bash
# Create new WXT project with React template
bunx wxt@latest init backpocket-extension -t react

cd backpocket-extension
```

### Install Dependencies

```bash
# Core dependencies
bun add @clerk/chrome-extension

# Dev dependencies (if not already included)
bun add -d @types/chrome
```

### Project Structure (WXT)

```
backpocket-extension/
├── entrypoints/
│   ├── popup/              # Extension popup UI
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.html
│   ├── background.ts       # Service worker
│   └── content.ts          # Content script (if needed)
├── components/
│   └── SaveForm.tsx
├── lib/
│   ├── api.ts              # Backpocket API client
│   └── types.ts            # Shared types
├── public/
│   └── icon/               # Extension icons
├── wxt.config.ts           # WXT configuration
└── package.json
```

### WXT Configuration

```typescript
// wxt.config.ts
import { defineConfig } from "wxt";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "Backpocket",
    description: "Save links to your Backpocket",
    permissions: ["activeTab", "storage"],
    host_permissions: ["https://backpocket.dev/*"],
  },
});
```

### Development

```bash
# Start dev server with HMR
bun run dev

# Build for production
bun run build

# Build for specific browser
bun run build:chrome
bun run build:firefox
```

---

## Authentication

Backpocket uses [Clerk](https://clerk.com) for authentication.

### Clerk Configuration

| Environment Variable                | Description                                 |
| ----------------------------------- | ------------------------------------------- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key (required for client) |

### Authentication Flow for Browser Extension

The extension should use Clerk's browser extension authentication pattern:

#### Option 1: Clerk Browser Extension SDK (Recommended)

Use `@clerk/chrome-extension` package:

```bash
bun add @clerk/chrome-extension
```

```typescript
import {
  ClerkProvider,
  SignedIn,
  SignedOut,
  SignInButton,
  useAuth,
} from "@clerk/chrome-extension";

// In your extension popup
function App() {
  return (
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY}>
      <SignedIn>
        <SaveLinkUI />
      </SignedIn>
      <SignedOut>
        <SignInButton />
      </SignedOut>
    </ClerkProvider>
  );
}
```

#### Option 2: OAuth Flow with Token Exchange

1. Open Clerk hosted sign-in page in a popup/tab
2. Handle the OAuth callback
3. Store the session token securely in extension storage

### Session Token

After authentication, Clerk provides a session token. This token must be included in API requests.

**Header Format:**

```http
Authorization: Bearer <clerk_session_token>
```

Or Clerk automatically handles this via cookies if using the same domain.

### Getting the Auth Token

```typescript
import { useAuth } from "@clerk/chrome-extension";

function SaveLinkComponent() {
  const { getToken } = useAuth();

  async function saveLink(url: string, tags: string[]) {
    const token = await getToken();

    // Use token in API calls
    const response = await fetch(
      "https://backpocket.dev/api/trpc/space.createSave",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          json: {
            url,
            tagNames: tags,
          },
        }),
      }
    );
  }
}
```

---

## API Architecture

Backpocket uses [tRPC](https://trpc.io) for its API layer.

### Endpoint Structure

```
POST /api/trpc/<router>.<procedure>
```

All tRPC calls use POST for mutations and can use GET for queries.

### Router Namespaces

| Router     | Auth Required | Description                      |
| ---------- | ------------- | -------------------------------- |
| `space.*`  | ✅ Yes        | User's personal space operations |
| `public.*` | ❌ No         | Public read-only operations      |

---

## Core Endpoints

### 1. Create Save (Primary)

**Endpoint:** `POST /api/trpc/space.createSave`

Creates a new bookmark/save in the user's space.

**Request Body:**

```json
{
  "json": {
    "url": "https://example.com/article",
    "title": "Optional custom title",
    "visibility": "private",
    "tagNames": ["reading", "tech"],
    "note": "Optional description/note"
  }
}
```

**Input Schema:**

| Field           | Type                                  | Required | Default     | Description                                 |
| --------------- | ------------------------------------- | -------- | ----------- | ------------------------------------------- |
| `url`           | `string`                              | ✅ Yes   | -           | Valid URL to save                           |
| `title`         | `string`                              | ❌ No    | null        | Custom title (auto-fetched if not provided) |
| `visibility`    | `"private" \| "public" \| "unlisted"` | ❌ No    | `"private"` | Save visibility                             |
| `tagNames`      | `string[]`                            | ❌ No    | `[]`        | Tag names to attach                         |
| `collectionIds` | `string[]`                            | ❌ No    | `[]`        | Collection IDs to add to                    |
| `note`          | `string`                              | ❌ No    | null        | Description/notes                           |

**Response:**

```json
{
  "result": {
    "data": {
      "id": "uuid",
      "spaceId": "uuid",
      "url": "https://example.com/article",
      "title": "Article Title",
      "description": null,
      "siteName": null,
      "imageUrl": null,
      "contentType": null,
      "visibility": "private",
      "isArchived": false,
      "isFavorite": false,
      "createdBy": "user_xxx",
      "savedAt": "2024-01-01T00:00:00.000Z",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z",
      "tags": [
        {
          "id": "uuid",
          "spaceId": "uuid",
          "name": "reading",
          "createdAt": "2024-01-01T00:00:00.000Z",
          "updatedAt": "2024-01-01T00:00:00.000Z"
        }
      ],
      "collections": []
    }
  }
}
```

**Notes:**

- Tags are automatically created if they don't exist
- Tag names are normalized to lowercase and trimmed
- A user's space is auto-created on first save if it doesn't exist

---

### 2. List Tags

**Endpoint:** `GET /api/trpc/space.listTags` or `POST /api/trpc/space.listTags`

Fetches all tags for the authenticated user. Useful for autocomplete.

**Request Body (POST):**

```json
{
  "json": {}
}
```

**Response:**

```json
{
  "result": {
    "data": [
      {
        "id": "uuid",
        "spaceId": "uuid",
        "name": "reading",
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:00:00.000Z",
        "_count": {
          "saves": 5
        }
      },
      {
        "id": "uuid",
        "spaceId": "uuid",
        "name": "tech",
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:00:00.000Z",
        "_count": {
          "saves": 12
        }
      }
    ]
  }
}
```

---

### 3. Create Tag (Optional)

**Endpoint:** `POST /api/trpc/space.createTag`

Pre-create a tag before saving (not required - tags auto-create via `createSave`).

**Request Body:**

```json
{
  "json": {
    "name": "new-tag"
  }
}
```

**Input Schema:**

| Field  | Type     | Required | Description           |
| ------ | -------- | -------- | --------------------- |
| `name` | `string` | ✅ Yes   | Tag name (min 1 char) |

**Response:**

```json
{
  "result": {
    "data": {
      "id": "uuid",
      "spaceId": "uuid",
      "name": "new-tag",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z",
      "_count": {
        "saves": 0
      }
    }
  }
}
```

---

## Type Definitions

### Save

```typescript
interface Save {
  id: string;
  spaceId: string;
  url: string;
  title: string | null;
  description: string | null;
  siteName: string | null;
  imageUrl: string | null;
  contentType: string | null;
  visibility: "private" | "public" | "unlisted";
  isArchived: boolean;
  isFavorite: boolean;
  createdBy: string;
  savedAt: string; // ISO date string
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
  tags?: Tag[];
  collections?: Collection[];
}
```

### Tag

```typescript
interface Tag {
  id: string;
  spaceId: string;
  name: string;
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
  _count?: {
    saves: number;
  };
}
```

### CreateSaveInput

```typescript
interface CreateSaveInput {
  url: string; // Required, valid URL
  title?: string; // Optional
  visibility?: "private" | "public" | "unlisted"; // Default: "private"
  tagNames?: string[]; // Optional
  collectionIds?: string[]; // Optional
  note?: string; // Optional
}
```

---

## Implementation Guide

### Minimal Extension Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    Browser Extension                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. User clicks extension icon                               │
│           │                                                  │
│           ▼                                                  │
│  2. Check Clerk auth status                                  │
│           │                                                  │
│     ┌─────┴─────┐                                           │
│     │           │                                           │
│     ▼           ▼                                           │
│  Logged In   Not Logged In                                  │
│     │           │                                           │
│     │           ▼                                           │
│     │     Show Sign-In UI ──────────────────┐               │
│     │           │                            │               │
│     │           ▼                            │               │
│     │     Clerk OAuth Flow                   │               │
│     │           │                            │               │
│     │           ▼                            │               │
│     │     Store Session ◄────────────────────┘               │
│     │           │                                           │
│     ▼           ▼                                           │
│  3. Get current tab URL & title                              │
│           │                                                  │
│           ▼                                                  │
│  4. Show quick-save UI                                       │
│     ┌─────────────────────────────────────┐                 │
│     │  URL: [current-page-url]            │                 │
│     │  Title: [editable title]            │                 │
│     │  Tags: [autocomplete input]         │                 │
│     │           [Save] [Cancel]           │                 │
│     └─────────────────────────────────────┘                 │
│           │                                                  │
│           ▼                                                  │
│  5. POST /api/trpc/space.createSave                         │
│           │                                                  │
│           ▼                                                  │
│  6. Show success/error feedback                              │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Example Implementation (WXT + React)

#### API Client (`lib/api.ts`)

```typescript
// lib/api.ts
const API_BASE = "https://backpocket.dev";

export interface Tag {
  id: string;
  name: string;
  _count?: { saves: number };
}

export interface CreateSaveInput {
  url: string;
  title?: string;
  tagNames?: string[];
  visibility?: "private" | "public" | "unlisted";
}

export async function createSave(input: CreateSaveInput, token: string) {
  const res = await fetch(`${API_BASE}/api/trpc/space.createSave`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ json: input }),
  });

  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.result.data;
}

export async function listTags(token: string): Promise<Tag[]> {
  const res = await fetch(`${API_BASE}/api/trpc/space.listTags`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ json: {} }),
  });

  const data = await res.json();
  return data.result?.data || [];
}
```

#### Popup Entry (`entrypoints/popup/App.tsx`)

```typescript
// entrypoints/popup/App.tsx
import {
  ClerkProvider,
  SignedIn,
  SignedOut,
  SignInButton,
  useAuth,
} from "@clerk/chrome-extension";
import { useState, useEffect } from "react";
import { createSave, listTags, type Tag } from "../../lib/api";

const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

function SaveLinkForm() {
  const { getToken } = useAuth();
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [existingTags, setExistingTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Get current tab info on mount
  useEffect(() => {
    browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
      if (tabs[0]) {
        setUrl(tabs[0].url || "");
        setTitle(tabs[0].title || "");
      }
    });

    // Fetch existing tags for autocomplete
    fetchTags();
  }, []);

  async function fetchTags() {
    try {
      const token = await getToken();
      if (!token) return;
      const tags = await listTags(token);
      setExistingTags(tags);
    } catch (err) {
      console.error("Failed to fetch tags:", err);
    }
  }

  async function handleSave() {
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");

      await createSave(
        {
          url,
          title: title || undefined,
          tagNames: tags.length > 0 ? tags : undefined,
          visibility: "private",
        },
        token
      );

      setSuccess(true);
      // Auto-close after success
      setTimeout(() => window.close(), 1500);
    } catch (err) {
      console.error("Save failed:", err);
      alert("Failed to save link");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return <div className="success">✓ Saved to Backpocket!</div>;
  }

  return (
    <div className="save-form">
      <input
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="URL"
        disabled
      />
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title (optional)"
      />
      {/* TagInput component for autocomplete */}
      <TagInput
        value={tags}
        onChange={setTags}
        suggestions={existingTags.map((t) => t.name)}
      />
      <button onClick={handleSave} disabled={loading || !url}>
        {loading ? "Saving..." : "Save"}
      </button>
    </div>
  );
}

export default function App() {
  return (
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY}>
      <div className="popup">
        <SignedOut>
          <div className="auth-prompt">
            <p>Sign in to save links</p>
            <SignInButton />
          </div>
        </SignedOut>
        <SignedIn>
          <SaveLinkForm />
        </SignedIn>
      </div>
    </ClerkProvider>
  );
}
```

#### Popup Entry Point (`entrypoints/popup/main.tsx`)

```typescript
// entrypoints/popup/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./style.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

#### Environment Variables

Create a `.env` file in the extension root:

```bash
# .env
VITE_CLERK_PUBLISHABLE_KEY=pk_live_xxx
```

> **Note:** WXT uses Vite under the hood, so environment variables must be prefixed with `VITE_` to be exposed to the client.

---

## Error Handling

### tRPC Error Format

```json
{
  "error": {
    "message": "Error description",
    "code": -32600,
    "data": {
      "code": "UNAUTHORIZED",
      "httpStatus": 401,
      "path": "space.createSave"
    }
  }
}
```

### Common Error Codes

| tRPC Code               | HTTP Status | Description        |
| ----------------------- | ----------- | ------------------ |
| `UNAUTHORIZED`          | 401         | Not authenticated  |
| `NOT_FOUND`             | 404         | Resource not found |
| `BAD_REQUEST`           | 400         | Invalid input      |
| `INTERNAL_SERVER_ERROR` | 500         | Server error       |

### Error Handling Example

```typescript
async function apiCall(endpoint: string, input: object, token: string) {
  const res = await fetch(`${API_BASE}/api/trpc/${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ json: input }),
  });

  const data = await res.json();

  if (data.error) {
    const errorCode = data.error.data?.code;

    switch (errorCode) {
      case "UNAUTHORIZED":
        // Redirect to sign-in
        throw new Error("Please sign in again");
      case "BAD_REQUEST":
        throw new Error(data.error.message || "Invalid input");
      default:
        throw new Error("Something went wrong");
    }
  }

  return data.result.data;
}
```

---

## CORS & Security Notes

1. **CORS**: The API should allow requests from the extension origin. Browser extensions typically have unique origins like `chrome-extension://<extension-id>`.

2. **Content Security Policy**: Ensure your extension's manifest allows connections to `https://backpocket.dev`.

3. **Token Storage**: Store Clerk session tokens securely using `browser.storage.session` (session-only) or `browser.storage.local` (persistent). WXT provides a cross-browser `browser` API.

4. **WXT Storage Module**: Consider using `@wxt-dev/storage` for type-safe, reactive storage:

```bash
bun add @wxt-dev/storage
```

### WXT Manifest Configuration

In WXT, manifest permissions are configured in `wxt.config.ts`:

```typescript
// wxt.config.ts
import { defineConfig } from "wxt";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "Backpocket",
    description: "Save links to your Backpocket",
    permissions: ["activeTab", "storage"],
    host_permissions: ["https://backpocket.dev/*"],
    // Required for Clerk OAuth flow
    web_accessible_resources: [
      {
        resources: ["*.html"],
        matches: ["https://backpocket.dev/*"],
      },
    ],
  },
});
```

### Cross-Browser API

WXT provides a unified `browser` API that works across Chrome, Firefox, and other browsers:

```typescript
// Use browser.* instead of chrome.*
// WXT handles the polyfill automatically

// Get current tab
const [tab] = await browser.tabs.query({ active: true, currentWindow: true });

// Storage
await browser.storage.local.set({ key: "value" });
const { key } = await browser.storage.local.get("key");
```

---

## Quick Reference

### Essential Endpoints for Extension

| Action       | Endpoint           | Method   |
| ------------ | ------------------ | -------- |
| Save a link  | `space.createSave` | POST     |
| Get all tags | `space.listTags`   | GET/POST |

### Minimal Save Request

```bash
curl -X POST https://backpocket.dev/api/trpc/space.createSave \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"json":{"url":"https://example.com","tagNames":["test"]}}'
```

### WXT Commands

| Command                 | Description                                       |
| ----------------------- | ------------------------------------------------- |
| `bun run dev`           | Start dev server with HMR                         |
| `bun run dev:firefox`   | Dev mode for Firefox                              |
| `bun run build`         | Production build (all browsers)                   |
| `bun run build:chrome`  | Build for Chrome only                             |
| `bun run build:firefox` | Build for Firefox only                            |
| `bun run zip`           | Create extension zip for publishing               |
| `bun run submit`        | Submit to browser stores (via `@wxt-dev/publish`) |

### Key Dependencies

```json
{
  "dependencies": {
    "@clerk/chrome-extension": "^1.x",
    "react": "^18.x",
    "react-dom": "^18.x"
  },
  "devDependencies": {
    "wxt": "^0.20.x",
    "@wxt-dev/module-react": "^1.x",
    "typescript": "^5.x"
  }
}
```

---

## Resources

- [WXT Documentation](https://wxt.dev/)
- [WXT React Module](https://wxt.dev/guide/go-further/entrypoints/popup.html)
- [Clerk Chrome Extension SDK](https://clerk.com/docs/references/chrome-extension/overview)
- [tRPC Documentation](https://trpc.io/docs)

---

## Support

For questions or issues, open an issue in the Backpocket repository or contact the maintainers.
