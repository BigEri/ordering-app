import { VirtualPosLive } from "../../components/VirtualPosLive";
import { readVirtualPosEvents } from "../../lib/pos/virtualPosLog";

export const dynamic = "force-dynamic";

export default async function VirtualPosPage() {
  const initialEvents = await readVirtualPosEvents(200);
  return <VirtualPosLive initialEvents={initialEvents} />;
}
