/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as deals from "../deals.js";
import type * as emailTracking from "../emailTracking.js";
import type * as entries from "../entries.js";
import type * as evsf from "../evsf.js";
import type * as fields from "../fields.js";
import type * as folderNotifications from "../folderNotifications.js";
import type * as folderSettings from "../folderSettings.js";
import type * as folders from "../folders.js";
import type * as members from "../members.js";
import type * as pipeline from "../pipeline.js";
import type * as reminders from "../reminders.js";
import type * as tables from "../tables.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  deals: typeof deals;
  emailTracking: typeof emailTracking;
  entries: typeof entries;
  evsf: typeof evsf;
  fields: typeof fields;
  folderNotifications: typeof folderNotifications;
  folderSettings: typeof folderSettings;
  folders: typeof folders;
  members: typeof members;
  pipeline: typeof pipeline;
  reminders: typeof reminders;
  tables: typeof tables;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
