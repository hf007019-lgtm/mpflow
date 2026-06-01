import { getLandingContent } from "@/lib/db";
import { ContentForm } from "./form";

export default async function AdminContentPage() {
  const content = await getLandingContent();
  return (
    <div className="p-8">
      <ContentForm initial={content} />
    </div>
  );
}
