import { activityApi } from "./api/activity";
import { devicesApi } from "./api/devices";
import { encryptionApi } from "./api/encryption";
import { identitiesApi } from "./api/identities";
import { loginApi } from "./api/login";
import { mydataApi } from "./api/mydata";
import { oauthApi } from "./api/oauth";
import { registerApi } from "./api/register";
import { securityApi } from "./api/security";
import { signingApi } from "./api/signing";
import { uploadApi } from "./api/upload";

export { ApiError, clearD1Bookmark } from "./api/transport";
export type * from "./api/types";

export const api = {
  register: registerApi,
  login: loginApi,
  devices: devicesApi,
  identities: identitiesApi,
  security: securityApi,
  activity: activityApi,
  mydata: mydataApi,
  encryption: encryptionApi,
  oauth: oauthApi,
  signing: signingApi,
  upload: uploadApi,
};
