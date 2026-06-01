export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

import EditorClient from "./EditorClient";

export default function EditorPage() {
  return <EditorClient />;
}
