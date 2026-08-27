import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getParentContext } from "@/lib/parent.functions";

export const parentQueryKey = (guid: string) => ["parent", guid];

// The layout and both tabs read this; the shared key means one fetch, and a
// mutation on either tab invalidates the same cache entry.
export function useParentContext(guid: string) {
  const fetchCtx = useServerFn(getParentContext);
  return useQuery({
    queryKey: parentQueryKey(guid),
    queryFn: () => fetchCtx({ data: { guid } }),
    retry: false,
  });
}
