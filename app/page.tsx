import { RextflexChat } from "@/components/chat/rextflex-chat";
import { requireUser } from "@/lib/session";

export default async function Page() {
  const user = await requireUser();
  return <RextflexChat user={{ email: user.email, image: user.image ?? undefined, name: user.name }} />;
}
