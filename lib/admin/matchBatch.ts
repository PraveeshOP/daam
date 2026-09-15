/**
 * Lives here rather than in app/admin/actions/matches.ts because that file is `"use server"`,
 * and such a module may only export async functions — exporting a plain constant from it fails
 * the build outright. Both the Server Action and the client button import it from here.
 */
export const ACCEPT_ALL_BATCH_SIZE = 100;
