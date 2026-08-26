import { request, upload } from "./transport";

export const uploadApi = {
    avatar: async (identityId: string, file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("identityId", identityId);

      return upload<{ avatarUrl: string }>("/api/upload/avatar", formData);
    },

    banner: async (identityId: string, file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("identityId", identityId);

      return upload<{ bannerUrl: string }>("/api/upload/banner", formData);
    },

    deleteAvatar: (identityId: string) =>
      request<{ success: boolean }>(`/api/upload/avatar/${identityId}`, {
        method: "DELETE",
      }),

    deleteBanner: (identityId: string) =>
      request<{ success: boolean }>(`/api/upload/banner/${identityId}`, {
        method: "DELETE",
      }),
};
