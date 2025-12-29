import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { TRPC_ENDPOINT } from "@/lib/constants/trpc";
import { appRouter, createContext } from "@/lib/trpc/server";

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: TRPC_ENDPOINT,
    req,
    router: appRouter,
    createContext,
  });

export { handler as GET, handler as POST };
