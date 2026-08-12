import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions, type CookieRequestLike } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { stripeCheckoutIsReady } from "./stripeBoundary";
import { aiRouter } from "./aiRouter";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req as unknown as CookieRequestLike);
      const response = ctx.res as unknown as { clearCookie: (name: string, options: Record<string, unknown>) => void };
      response.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),
  ai: aiRouter,
  payments: router({
    /** Availability only: payment creation and fulfillment remain unavailable until server secrets are configured. */
    capabilities: publicProcedure.query(() => ({ stripeCheckoutAvailable: stripeCheckoutIsReady() })),
  }),

  // TODO: add feature routers here, e.g.
  // todo: router({
  //   list: protectedProcedure.query(({ ctx }) =>
  //     db.getUserTodos(ctx.user.id)
  //   ),
  // }),
});

export type AppRouter = typeof appRouter;
