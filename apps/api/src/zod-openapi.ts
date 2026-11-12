import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

/** Must run before any schema module is evaluated: Zod 4 adds `.openapi` only to schemas created afterwards. */
extendZodWithOpenApi(z);
