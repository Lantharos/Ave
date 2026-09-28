import { upload } from "./transport";

export const uploadApi = {
    avatar: async (identityId: string, file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("identityId", identityId);

      return upload<{ avatarUrl: string }>("/api/upload/avatar", formData);
    },
};
