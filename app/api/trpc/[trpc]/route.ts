import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { TRPC_ENDPOINT } from "@/lib/constants/trpc";
import { appRouter, createContext } from "@/lib/trpc/server";

// Force Node.js runtime because snapshotsRouter imports jsdom, readability, etc.
export const runtime = "nodejs";

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: TRPC_ENDPOINT,
    req,
    router: appRouter,
    createContext,
  });

export { handler as GET, handler as POST };
