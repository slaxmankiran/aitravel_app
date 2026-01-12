import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { type CreateTripRequest, type TripResponse } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { getVoyageHeaders } from "@/lib/voyageUid";

// GET /api/trips/:id
export function useTrip(id: number) {
  return useQuery({
    queryKey: [api.trips.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.trips.get.path, { id });
      const res = await fetch(url, {
        credentials: "include",
        headers: getVoyageHeaders(),
      });
      
      if (!res.ok) {
        if (res.status === 404) return null;
        throw new Error("Failed to fetch trip details");
      }
      
      const data = await res.json();
      return api.trips.get.responses[200].parse(data);
    },
    enabled: !!id && !isNaN(id),
    // Poll while feasibility is pending OR itinerary is not yet ready
    refetchInterval: (query) => {
      const data = query.state.data as TripResponse | undefined;
      if (!data) return 2000; // Keep polling if no data yet
      if (data.feasibilityStatus === "pending") return 2000; // Feasibility in progress
      if (data.feasibilityStatus === "yes" || data.feasibilityStatus === "warning") {
        // Feasibility done, but check if itinerary is ready
        const itinerary = data.itinerary as any;
        if (!itinerary || !itinerary.days || itinerary.days.length === 0) {
          return 2000; // Keep polling until itinerary is ready
        }
      }
      return false; // Stop polling - everything is ready
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
        adults: Number(data.adults) || 1,
        children: Number(data.children) || 0,
        infants: Number(data.infants) || 0,
      };
      
      // Client-side validation using the schema before sending
      const validated = api.trips.create.input.parse(payload);
      
      const res = await fetch(api.trips.create.path, {
        method: api.trips.create.method,
        headers: {
          "Content-Type": "application/json",
          ...getVoyageHeaders(),
        },
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

// PUT /api/trips/:id - Update existing trip in place
export function useUpdateTrip() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: CreateTripRequest }) => {
      // Ensure numeric types are actually numbers
      const payload = {
        ...data,
        budget: Number(data.budget),
        groupSize: Number(data.groupSize),
        adults: Number(data.adults) || 1,
        children: Number(data.children) || 0,
        infants: Number(data.infants) || 0,
      };

      // Client-side validation using the schema before sending
      const validated = api.trips.create.input.parse(payload);

      const res = await fetch(`/api/trips/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...getVoyageHeaders(),
        },
        body: JSON.stringify(validated),
        credentials: "include",
      });

      if (!res.ok) {
        if (res.status === 404) {
          throw new Error("Trip not found");
        }
        if (res.status === 403) {
          throw new Error("Not authorized to edit this trip");
        }
        if (res.status === 400) {
          const error = await res.json();
          throw new Error(error.message || "Invalid trip data");
        }
        throw new Error("Failed to update trip");
      }

      return api.trips.create.responses[201].parse(await res.json());
    },
    onSuccess: (data) => {
      // Invalidate the specific trip query to refetch fresh data
      queryClient.invalidateQueries({ queryKey: [api.trips.get.path, data.id] });
      // Invalidate trips list if user views My Trips
      queryClient.invalidateQueries({ queryKey: ['/api/trips'] });
    },
    onError: (error) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
