import DebateReplay from "@/components/DebateReplay";

interface ReplayPageProps {
  params: {
    id: string;
  };
}

export default function ReplayPage({ params }: ReplayPageProps) {
  return <DebateReplay debateId={params.id} />;
}
