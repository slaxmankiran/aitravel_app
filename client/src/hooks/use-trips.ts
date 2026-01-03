import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { type CreateTripRequest, type TripResponse } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

// GET /api/trips/:id
export function useTrip(id: number) {
  return useQuery({
    queryKey: [api.trips.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.trips.get.path, { id });
      const res = await fetch(url, { credentials: "include" });
      
      if (!res.ok) {
        if (res.status === 404) return null;
        throw new Error("Failed to fetch trip details");
      }
      
      const data = await res.json();
      return api.trips.get.responses[200].parse(data);
    },
    enabled: !!id && !isNaN(id),
    // Poll while status is 'pending' to get AI results
    refetchInterval: (query) => {
      const data = query.state.data as TripResponse | undefined;
      return data?.feasibilityStatus === "pending" ? 2000 : false;
    }
  });
}

// POST /api/trips
export function useCreateTrip() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: CreateTripRequest) => {
      // Ensure numeric types are actually numbers (zod coerce handles this often, but good to be safe)
      const payload = {
        ...data,
        budget: Number(data.budget),
        groupSize: Number(data.groupSize),
      };
      
      // Client-side validation using the schema before sending
      const validated = api.trips.create.input.parse(payload);
      
      const res = await fetch(api.trips.create.path, {
        method: api.trips.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
        credentials: "include",
      });

      if (!res.ok) {
        if (res.status === 400) {
          const error = api.trips.create.responses[400].parse(await res.json());
          throw new Error(error.message);
        }
        throw new Error("Failed to analyze trip feasibility");
      }

      return api.trips.create.responses[201].parse(await res.json());
    },
    onError: (error) => {
      toast({
        title: "Analysis Failed",
        description: error.message,
        variant: "destructive",
      });
    },
    // We don't invalidate list query because we don't have a list view in this MVP
    // but we return the data so the UI can redirect to the details page
  });
}
