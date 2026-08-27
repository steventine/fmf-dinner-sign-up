import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getDinnerIdeas } from "@/lib/dinner-ideas.functions";

export type DinnerIdeasData = Awaited<ReturnType<typeof getDinnerIdeas>>;
export type DinnerSource = DinnerIdeasData["sources"][number];

// Shared by the Dinner ideas section and the sign-up dialog's peek, so both read
// one fetch. Lives outside the component file to keep Fast Refresh working there.
export function useDinnerIdeas(guid: string) {
  const fetchIdeas = useServerFn(getDinnerIdeas);
  return useQuery({
    queryKey: ["dinner-ideas", guid],
    queryFn: () => fetchIdeas({ data: { guid } }),
  });
}
