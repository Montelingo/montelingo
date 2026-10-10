import type { Schemas } from "@app/api-client";

import type { CurrentUser } from "../model/user";

export function toCurrentUser(resource: Schemas["CurrentUser"]): CurrentUser {
  return {
    id: resource.id,
    email: resource.email,
    createdAt: resource.created_at,
  };
}
