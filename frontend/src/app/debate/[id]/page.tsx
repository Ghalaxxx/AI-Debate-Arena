import DebateArena from "@/components/DebateArena";

interface DebatePageProps {
  params: {
    id: string;
  };
}

export default function DebatePage({ params }: DebatePageProps) {
  return <DebateArena debateId={params.id} />;
}
