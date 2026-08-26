import { ApiError, rawRequest, request } from "./transport";

export const mydataApi = {
    export: async () => {
      const response = await rawRequest("/api/mydata/export");
      if (!response.ok) {
        const data = await response.json() as { error?: string };
        throw new ApiError(response.status, data.error || "Export failed");
      }
      return response.blob();
    },

    delete: () =>
      request<{ success: boolean; message: string }>("/api/mydata", {
        method: "DELETE",
      }),
};
