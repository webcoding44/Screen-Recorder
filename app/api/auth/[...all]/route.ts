import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";
export const runtime = "nodejs";
const authHandlers = toNextJsHandler(auth.handler);

export const { GET, POST } = authHandlers;
