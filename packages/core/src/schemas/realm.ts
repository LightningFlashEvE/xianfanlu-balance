import { z } from "zod";

export const realmSchema = z.object({
  name: z.string().min(1),
  multiplier: z.number().positive(),
});

export type Realm = z.infer<typeof realmSchema>;
