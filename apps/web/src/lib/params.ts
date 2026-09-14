import { use } from "react";
export function useParamsPromise<T extends object>(params: Promise<T>): T {
  return use(params);
}
