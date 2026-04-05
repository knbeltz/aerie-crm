import { redirect } from "next/navigation";

// The old folder overview page has been replaced by the workspace system.
// Visiting /folders/[folderId] now immediately redirects to the Dashboard
// section of that folder's workspace.
export default function FolderRootPage({
  params,
}: {
  params: { folderId: string };
}) {
  redirect(`/folders/${params.folderId}/dashboard`);
}
